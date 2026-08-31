// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./CustomToken.sol";
import "./interfaces/ITokenFactory.sol";

/**
 * @title TokenFactory
 * @author Web3 Platform
 * @notice Factory contract that deploys and tracks CustomToken (ERC20) instances.
 *         Any connected wallet can create a token; ownership of the resulting
 *         token is granted directly to the creator.
 *
 * @dev Inherits Ownable (admin functions) and Pausable (emergency stop).
 */
contract TokenFactory is ITokenFactory, Ownable, Pausable {
    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev All deployed token addresses, in creation order.
    address[] private _allTokens;

    /// @dev creator wallet => list of their token addresses.
    mapping(address => address[]) private _tokensByCreator;

    /// @dev Quick lookup: is this a factory-deployed token?
    mapping(address => bool) public isFactoryToken;

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Write Functions ─────────────────────────────────────────────────────

    /**
     * @notice Deploy a new ERC20 token on behalf of the caller.
     * @param name         Token name (e.g. "My Token").
     * @param symbol       Token symbol (e.g. "MYT").
     * @param initialSupply Number of tokens to mint initially (whole units).
     *
     * @return tokenAddress The address of the newly deployed token.
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply
    ) external override whenNotPaused returns (address tokenAddress) {
        require(bytes(name).length > 0,   "TokenFactory: empty name");
        require(bytes(symbol).length > 0, "TokenFactory: empty symbol");
        require(initialSupply > 0,        "TokenFactory: zero supply");

        // Deploy token; creator is msg.sender, owner is also msg.sender
        CustomToken token = new CustomToken(
            name,
            symbol,
            initialSupply,
            0,            // maxSupply = 0 → unlimited (creator can mint freely)
            msg.sender,
            msg.sender
        );

        tokenAddress = address(token);

        _allTokens.push(tokenAddress);
        _tokensByCreator[msg.sender].push(tokenAddress);
        isFactoryToken[tokenAddress] = true;

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, initialSupply);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function pause()   external override onlyOwner { _pause(); }
    function unpause() external override onlyOwner { _unpause(); }

    // ─── Read Functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns all token addresses created by a specific wallet.
     */
    function getTokensByCreator(address creator)
        external
        view
        override
        returns (address[] memory)
    {
        return _tokensByCreator[creator];
    }

    /**
     * @notice Returns the total number of tokens deployed through this factory.
     */
    function getTotalTokens() external view override returns (uint256) {
        return _allTokens.length;
    }

    /**
     * @notice Paginated list of all token addresses.
     * @param offset Start index.
     * @param limit  Maximum results to return.
     */
    function getAllTokens(uint256 offset, uint256 limit)
        external
        view
        override
        returns (address[] memory)
    {
        uint256 total = _allTokens.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        address[] memory slice = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            slice[i - offset] = _allTokens[i];
        }
        return slice;
    }
}
