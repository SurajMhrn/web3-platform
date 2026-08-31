// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PlatformRegistry
 * @author Web3 Platform
 * @notice Central on-chain registry that stores the addresses of all platform
 *         smart contracts. This is the single source of truth for contract
 *         discovery — frontends and other contracts look up addresses here
 *         instead of having them hardcoded.
 *
 * @dev Only the contract owner (deployer / multisig) can set addresses,
 *      ensuring only audited and approved contracts are registered.
 */
contract PlatformRegistry is Ownable {
    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev name (bytes32 key) => deployed contract address
    mapping(bytes32 => address) private _contracts;

    /// @dev Ordered list of registered contract name keys (for enumeration)
    bytes32[] private _contractKeys;

    // ─── Events ──────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a contract address is registered or updated.
     * @param name       The bytes32-encoded contract name (indexed, for filtering).
     * @param addr       The deployed contract address.
     * @param updater    The owner who performed the update.
     * @param contractName The human-readable contract name, so off-chain indexers
     *                     don't need a pre-known key list to resolve `name`.
     */
    event ContractRegistered(
        bytes32 indexed name,
        address indexed addr,
        address indexed updater,
        string contractName
    );

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Write Functions ─────────────────────────────────────────────────────

    /**
     * @notice Register or update a contract address.
     * @param _name A human-readable contract name (e.g. "UserRegistry").
     * @param _addr The deployed contract address. Must be non-zero.
     */
    function setContract(string calldata _name, address _addr) external onlyOwner {
        require(_addr != address(0), "PlatformRegistry: zero address");
        require(bytes(_name).length > 0, "PlatformRegistry: empty name");

        bytes32 key = keccak256(bytes(_name));

        // Track key for enumeration (only add if new)
        if (_contracts[key] == address(0)) {
            _contractKeys.push(key);
        }

        _contracts[key] = _addr;
        emit ContractRegistered(key, _addr, msg.sender, _name);
    }

    // ─── Read Functions ──────────────────────────────────────────────────────

    /**
     * @notice Look up a registered contract address by name.
     * @param _name The human-readable contract name.
     * @return The registered address, or address(0) if not found.
     */
    function getContract(string calldata _name) external view returns (address) {
        return _contracts[keccak256(bytes(_name))];
    }

    /**
     * @notice Look up a contract address by its bytes32 key directly.
     */
    function getContractByKey(bytes32 _key) external view returns (address) {
        return _contracts[_key];
    }

    /**
     * @notice Returns the total number of registered contracts.
     */
    function getTotalContracts() external view returns (uint256) {
        return _contractKeys.length;
    }
}
