import { expect } from "chai";
import { ethers } from "hardhat";
import { CustomToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CustomToken", function () {
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let other: SignerWithAddress;

  const NAME = "My Token";
  const SYMBOL = "MYT";
  const INITIAL_SUPPLY = 1000n; // whole units, decimals applied on-chain
  const DECIMALS = 18n;
  const UNIT = 10n ** DECIMALS;

  async function deployToken(
    initialSupply = INITIAL_SUPPLY,
    maxSupply = 0n,
    creatorAddr?: string,
    initialOwnerAddr?: string
  ): Promise<CustomToken> {
    const Factory = await ethers.getContractFactory("CustomToken");
    const token = await Factory.deploy(
      NAME,
      SYMBOL,
      initialSupply,
      maxSupply,
      creatorAddr ?? creator.address,
      initialOwnerAddr ?? creator.address
    );
    await token.waitForDeployment();
    return token as unknown as CustomToken;
  }

  beforeEach(async function () {
    [owner, creator, other] = await ethers.getSigners();
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should mint the initial supply to the creator", async function () {
      const token = await deployToken();
      expect(await token.balanceOf(creator.address)).to.equal(INITIAL_SUPPLY * UNIT);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY * UNIT);
    });

    it("Should set name and symbol", async function () {
      const token = await deployToken();
      expect(await token.name()).to.equal(NAME);
      expect(await token.symbol()).to.equal(SYMBOL);
    });

    it("Should record the creator", async function () {
      const token = await deployToken();
      expect(await token.creator()).to.equal(creator.address);
    });

    it("Should transfer ownership to initialOwner", async function () {
      const token = await deployToken(INITIAL_SUPPLY, 0n, creator.address, other.address);
      expect(await token.owner()).to.equal(other.address);
    });

    it("Should store maxSupply", async function () {
      const token = await deployToken(INITIAL_SUPPLY, 5000n);
      expect(await token.maxSupply()).to.equal(5000n);
    });

    it("Should revert on zero creator address", async function () {
      const Factory = await ethers.getContractFactory("CustomToken");
      await expect(
        Factory.deploy(NAME, SYMBOL, INITIAL_SUPPLY, 0n, ethers.ZeroAddress, owner.address)
      ).to.be.revertedWith("CustomToken: zero creator address");
    });

    it("Should revert when initial supply exceeds max supply", async function () {
      const Factory = await ethers.getContractFactory("CustomToken");
      await expect(
        Factory.deploy(NAME, SYMBOL, 1000n, 500n, creator.address, creator.address)
      ).to.be.revertedWith("CustomToken: initial supply exceeds max supply");
    });

    it("Should allow initialSupply == maxSupply exactly", async function () {
      const token = await deployToken(1000n, 1000n);
      expect(await token.totalSupply()).to.equal(1000n * UNIT);
    });
  });

  // ─── mint ───────────────────────────────────────────────────────────────────

  describe("mint", function () {
    it("Should allow the owner (creator) to mint more tokens when unlimited (maxSupply = 0)", async function () {
      const token = await deployToken(INITIAL_SUPPLY, 0n);
      await expect(token.connect(creator).mint(other.address, 100n))
        .to.emit(token, "TokensMinted")
        .withArgs(other.address, 100n * UNIT);

      expect(await token.balanceOf(other.address)).to.equal(100n * UNIT);
      expect(await token.totalSupply()).to.equal((INITIAL_SUPPLY + 100n) * UNIT);
    });

    it("Should revert if a non-owner tries to mint", async function () {
      const token = await deployToken();
      await expect(
        token.connect(other).mint(other.address, 10n)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should allow minting up to the cap", async function () {
      const token = await deployToken(400n, 1000n);
      await token.connect(creator).mint(creator.address, 600n);
      expect(await token.totalSupply()).to.equal(1000n * UNIT);
    });

    it("Should revert when minting would exceed the cap", async function () {
      const token = await deployToken(400n, 1000n);
      await expect(
        token.connect(creator).mint(creator.address, 601n)
      ).to.be.revertedWith("CustomToken: max supply exceeded");
    });
  });

  // ─── Burn (ERC20Burnable) ───────────────────────────────────────────────────

  describe("burn", function () {
    it("Should allow a holder to burn their own tokens", async function () {
      const token = await deployToken();
      await token.connect(creator).burn(100n * UNIT);
      expect(await token.balanceOf(creator.address)).to.equal((INITIAL_SUPPLY - 100n) * UNIT);
      expect(await token.totalSupply()).to.equal((INITIAL_SUPPLY - 100n) * UNIT);
    });

    it("Should revert burning more than balance", async function () {
      const token = await deployToken();
      await expect(
        token.connect(creator).burn((INITIAL_SUPPLY + 1n) * UNIT)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  // ─── Permit (ERC20Permit / EIP-2612) ────────────────────────────────────────

  describe("permit", function () {
    it("Should approve via a signed permit without an on-chain approve() call", async function () {
      const token = await deployToken();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const value = 50n * UNIT;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const nonce = await token.nonces(creator.address);

      const domain = {
        name: NAME,
        version: "1",
        chainId,
        verifyingContract: await token.getAddress(),
      };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const message = {
        owner: creator.address,
        spender: other.address,
        value,
        nonce,
        deadline,
      };

      const signature = await creator.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(signature);

      await token.permit(creator.address, other.address, value, deadline, v, r, s);

      expect(await token.allowance(creator.address, other.address)).to.equal(value);
    });
  });
});
