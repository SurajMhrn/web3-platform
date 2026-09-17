// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IUserRegistry.sol";

/**
 * @title UserRegistry
 * @author Web3 Platform
 * @notice On-chain registry that tracks platform users and their roles.
 *         Supports registration, profile updates, and admin-controlled deactivation.
 * @dev Inherits Ownable (admin functions) and Pausable (emergency stop).
 */
contract UserRegistry is IUserRegistry, Ownable, Pausable {
    // ─── Roles ────────────────────────────────────────────────────────────────

    string public constant ROLE_USER = "user";
    string public constant ROLE_MODERATOR = "moderator";
    string public constant ROLE_ADMIN = "admin";

    /// @dev Every self-registration starts here; only the owner can change it.
    string public constant DEFAULT_ROLE = ROLE_USER;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev Mapping from wallet address to user info struct
    mapping(address => UserInfo) private _users;

    /// @dev Ordered list of all registered wallet addresses
    address[] private _registeredAddresses;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param initialOwner Address that will own this contract (deployer by default).
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyRegistered(address _addr) {
        require(_users[_addr].isRegistered, "UserRegistry: address not registered");
        _;
    }

    // ─── Write Functions ─────────────────────────────────────────────────────

    /**
     * @notice Register the calling wallet as a platform user.
     * @dev Self-registration always assigns DEFAULT_ROLE. The role used to be a
     *      caller-supplied string, which meant any wallet could register itself
     *      as "admin" and any off-chain system trusting this registry would
     *      believe it. Granting a privileged role is now owner-only —
     *      see setUserRole.
     * @param _username Non-empty display name.
     * @param _email    Off-chain email identifier (stored on-chain for auditability).
     */
    function registerUser(
        string calldata _username,
        string calldata _email
    ) external override whenNotPaused {
        require(!_users[msg.sender].isRegistered, "UserRegistry: already registered");
        require(bytes(_username).length > 0, "UserRegistry: username cannot be empty");
        require(bytes(_email).length > 0,    "UserRegistry: email cannot be empty");

        _users[msg.sender] = UserInfo({
            username:      _username,
            email:         _email,
            role:          DEFAULT_ROLE,
            registeredAt:  block.timestamp,
            updatedAt:     block.timestamp,
            isRegistered:  true,
            isActive:      true
        });

        _registeredAddresses.push(msg.sender);

        emit UserRegistered(msg.sender, _username, DEFAULT_ROLE, block.timestamp);
    }

    /**
     * @notice Set a registered user's platform role. Owner-only.
     * @dev Restricted to the known role set so a typo can't mint an
     *      unrecognized role that off-chain checks would silently treat as
     *      unprivileged — or worse, fail open on.
     * @param _userAddress The wallet address whose role is changing.
     * @param _role        One of "user", "moderator", "admin".
     */
    function setUserRole(address _userAddress, string calldata _role)
        external
        override
        onlyOwner
        onlyRegistered(_userAddress)
    {
        require(_isValidRole(_role), "UserRegistry: unknown role");

        string memory previousRole = _users[_userAddress].role;
        _users[_userAddress].role = _role;
        _users[_userAddress].updatedAt = block.timestamp;

        emit UserRoleChanged(_userAddress, previousRole, _role, block.timestamp);
    }

    /// @dev Roles are compared by hash because Solidity cannot compare strings directly.
    function _isValidRole(string calldata _role) private pure returns (bool) {
        bytes32 roleHash = keccak256(bytes(_role));
        return
            roleHash == keccak256(bytes(ROLE_USER)) ||
            roleHash == keccak256(bytes(ROLE_MODERATOR)) ||
            roleHash == keccak256(bytes(ROLE_ADMIN));
    }

    /**
     * @notice Update the calling user's username and email.
     * @dev Only the wallet owner can update their own profile.
     */
    function updateUser(
        string calldata _username,
        string calldata _email
    ) external override whenNotPaused onlyRegistered(msg.sender) {
        require(_users[msg.sender].isActive, "UserRegistry: account deactivated");
        require(bytes(_username).length > 0, "UserRegistry: username cannot be empty");
        require(bytes(_email).length > 0,    "UserRegistry: email cannot be empty");

        _users[msg.sender].username  = _username;
        _users[msg.sender].email     = _email;
        _users[msg.sender].updatedAt = block.timestamp;

        emit UserUpdated(msg.sender, _username, block.timestamp);
    }

    /**
     * @notice Deactivate a user's account. Only callable by the contract owner.
     * @param _userAddress The wallet address to deactivate.
     */
    function deactivateUser(address _userAddress)
        external
        override
        onlyOwner
        onlyRegistered(_userAddress)
    {
        require(_users[_userAddress].isActive, "UserRegistry: already deactivated");

        _users[_userAddress].isActive  = false;
        _users[_userAddress].updatedAt = block.timestamp;

        emit UserDeactivated(_userAddress, block.timestamp);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Pause the contract — disables registerUser and updateUser.
     */
    function pause() external override onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract.
     */
    function unpause() external override onlyOwner {
        _unpause();
    }

    // ─── Read Functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns whether a wallet address has registered.
     */
    function isUserRegistered(address _userAddress) external view override returns (bool) {
        return _users[_userAddress].isRegistered;
    }

    /**
     * @notice Returns whether a registered user is currently active.
     */
    function isUserActive(address _userAddress) external view override returns (bool) {
        return _users[_userAddress].isActive;
    }

    /**
     * @notice Returns the full UserInfo struct for a given address.
     */
    function getUser(address _userAddress) external view override returns (UserInfo memory) {
        return _users[_userAddress];
    }

    /**
     * @notice Returns the total number of registered users.
     */
    function getTotalUsers() external view override returns (uint256) {
        return _registeredAddresses.length;
    }

    /**
     * @notice Returns a paginated slice of registered addresses.
     * @param offset Start index.
     * @param limit  Maximum number of results.
     */
    function getRegisteredAddresses(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory)
    {
        uint256 total = _registeredAddresses.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        address[] memory slice = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            slice[i - offset] = _registeredAddresses[i];
        }
        return slice;
    }
}
