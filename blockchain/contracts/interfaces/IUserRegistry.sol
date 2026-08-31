// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IUserRegistry
 * @notice Interface for the UserRegistry contract.
 *         Provides a clean ABI boundary for external integrations.
 */
interface IUserRegistry {
    // ─── Structs ─────────────────────────────────────────────────────────────

    struct UserInfo {
        string username;
        string email;
        string role;
        uint256 registeredAt;
        uint256 updatedAt;
        bool isRegistered;
        bool isActive;
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    event UserRegistered(
        address indexed userAddress,
        string username,
        string role,
        uint256 timestamp
    );

    event UserUpdated(
        address indexed userAddress,
        string username,
        uint256 timestamp
    );

    event UserDeactivated(
        address indexed userAddress,
        uint256 timestamp
    );

    // ─── Write Functions ─────────────────────────────────────────────────────

    /**
     * @notice Register the calling wallet as a platform user.
     * @param _username Non-empty display name.
     * @param _email    Non-empty off-chain email identifier.
     * @param _role     Platform role string (e.g. "user", "admin").
     */
    function registerUser(
        string calldata _username,
        string calldata _email,
        string calldata _role
    ) external;

    /**
     * @notice Update the calling user's username and email.
     * @param _username Non-empty display name.
     * @param _email    Non-empty off-chain email identifier.
     */
    function updateUser(
        string calldata _username,
        string calldata _email
    ) external;

    /**
     * @notice Deactivate a registered user's account. Owner-only.
     * @param _userAddress The wallet address to deactivate.
     */
    function deactivateUser(address _userAddress) external;

    /**
     * @notice Pause the contract — disables registerUser and updateUser. Owner-only.
     */
    function pause() external;

    /**
     * @notice Unpause the contract. Owner-only.
     */
    function unpause() external;

    // ─── Read Functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns whether a wallet address has registered.
     */
    function isUserRegistered(address _userAddress) external view returns (bool);

    /**
     * @notice Returns whether a registered user is currently active.
     */
    function isUserActive(address _userAddress) external view returns (bool);

    /**
     * @notice Returns the full UserInfo struct for a given address.
     */
    function getUser(address _userAddress) external view returns (UserInfo memory);

    /**
     * @notice Returns the total number of registered users.
     */
    function getTotalUsers() external view returns (uint256);
}
