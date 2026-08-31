// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title CustomToken
 * @author Web3 Platform
 * @notice A standard ERC20 token with burn and permit support,
 *         deployed by the TokenFactory for platform users.
 *
 * @dev The deployer (TokenFactory) receives the full initial supply.
 *      Ownership is then transferred to the creator wallet so they can
 *      mint additional tokens if desired.
 */
contract CustomToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice The platform user who created this token.
    address public immutable creator;

    /// @notice Maximum additional tokens that can be minted after deployment.
    ///         0 means no extra minting allowed (fixed supply).
    uint256 public immutable maxSupply;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TokensMinted(address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param name_         Token name.
     * @param symbol_       Token ticker.
     * @param initialSupply Tokens minted at deployment (in whole units, decimals = 18).
     * @param maxSupply_    Hard-cap on total supply. 0 = unlimited.
     * @param creator_      The wallet that created this token.
     * @param initialOwner  Address that receives ownership (the creator).
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 maxSupply_,
        address creator_,
        address initialOwner
    )
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        Ownable(initialOwner)
    {
        require(creator_ != address(0), "CustomToken: zero creator address");
        require(
            maxSupply_ == 0 || initialSupply <= maxSupply_,
            "CustomToken: initial supply exceeds max supply"
        );

        creator = creator_;
        maxSupply = maxSupply_;

        // Mint initial supply to the creator directly
        _mint(creator_, initialSupply * (10 ** decimals()));
    }

    // ─── Owner Functions ─────────────────────────────────────────────────────

    /**
     * @notice Mint additional tokens (only owner / creator).
     * @param to     Recipient address.
     * @param amount Amount in whole token units.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        uint256 weiAmount = amount * (10 ** decimals());
        if (maxSupply > 0) {
            require(
                totalSupply() + weiAmount <= maxSupply * (10 ** decimals()),
                "CustomToken: max supply exceeded"
            );
        }
        _mint(to, weiAmount);
        emit TokensMinted(to, weiAmount);
    }
}
