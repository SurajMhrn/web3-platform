// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITokenFactory
 * @notice Interface for the TokenFactory contract.
 */
interface ITokenFactory {
    // ─── Events ──────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new ERC20 token is deployed through the factory.
     * @param tokenAddress The address of the newly deployed token contract.
     * @param creator      The wallet address of the creator.
     * @param name         The token's name.
     * @param symbol       The token's symbol.
     * @param initialSupply The initial supply minted to the creator.
     */
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply
    );

    // ─── Functions ────────────────────────────────────────────────────────────

    /**
     * @notice Deploys a new ERC20 CustomToken and records it.
     * @param name         Human-readable token name.
     * @param symbol       Token ticker symbol (e.g. "MYT").
     * @param initialSupply Number of tokens to mint to the creator (before decimals).
     * @return tokenAddress The address of the newly deployed token contract.
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply
    ) external returns (address tokenAddress);

    /**
     * @notice Returns all token addresses created by a specific wallet.
     */
    function getTokensByCreator(address creator) external view returns (address[] memory);

    /**
     * @notice Returns the total number of tokens deployed through this factory.
     */
    function getTotalTokens() external view returns (uint256);

    /**
     * @notice Returns a paginated list of all deployed token addresses.
     */
    function getAllTokens(uint256 offset, uint256 limit) external view returns (address[] memory);

    /**
     * @notice Pause the contract — disables createToken. Owner-only.
     */
    function pause() external;

    /**
     * @notice Unpause the contract. Owner-only.
     */
    function unpause() external;
}
