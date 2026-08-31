import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { TokenFactory, CustomToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TokenFactory", function () {
  let factory: TokenFactory;
  let owner: SignerWithAddress;
  let creator1: SignerWithAddress;
  let creator2: SignerWithAddress;

  beforeEach(async function () {
    [owner, creator1, creator2] = await ethers.getSigners();

    const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
    factory = await TokenFactoryContract.deploy(owner.address);
    await factory.waitForDeployment();
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should start with zero tokens", async function () {
      expect(await factory.getTotalTokens()).to.equal(0);
    });

    it("Should start unpaused", async function () {
      expect(await factory.paused()).to.equal(false);
    });
  });

  // ─── createToken ────────────────────────────────────────────────────────────

  describe("createToken", function () {
    it("Should deploy a token and emit TokenCreated", async function () {
      const tx = await factory.connect(creator1).createToken("My Token", "MYT", 1000n);
      await expect(tx)
        .to.emit(factory, "TokenCreated")
        .withArgs(anyValue, creator1.address, "My Token", "MYT", 1000n);
    });

    it("Should record the token in _allTokens / getAllTokens", async function () {
      await factory.connect(creator1).createToken("My Token", "MYT", 1000n);
      const all = await factory.getAllTokens(0, 10);
      expect(all.length).to.equal(1);
      expect(await factory.getTotalTokens()).to.equal(1);
    });

    it("Should record the token under the creator", async function () {
      await factory.connect(creator1).createToken("My Token", "MYT", 1000n);
      const mine = await factory.getTokensByCreator(creator1.address);
      expect(mine.length).to.equal(1);

      const others = await factory.getTokensByCreator(creator2.address);
      expect(others.length).to.equal(0);
    });

    it("Should mark the deployed token as a factory token", async function () {
      const tx = await factory.connect(creator1).createToken("My Token", "MYT", 1000n);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "TokenCreated");
      const tokenAddress = event!.args.tokenAddress as string;

      expect(await factory.isFactoryToken(tokenAddress)).to.equal(true);

      const CustomTokenFactory = await ethers.getContractFactory("CustomToken");
      const token = CustomTokenFactory.attach(tokenAddress) as unknown as CustomToken;
      expect(await token.creator()).to.equal(creator1.address);
      expect(await token.owner()).to.equal(creator1.address);
      expect(await token.balanceOf(creator1.address)).to.equal(1000n * 10n ** 18n);
    });

    it("Should support multiple independent creators", async function () {
      await factory.connect(creator1).createToken("Token A", "TKA", 100n);
      await factory.connect(creator2).createToken("Token B", "TKB", 200n);
      await factory.connect(creator2).createToken("Token C", "TKC", 300n);

      expect(await factory.getTotalTokens()).to.equal(3);
      expect((await factory.getTokensByCreator(creator1.address)).length).to.equal(1);
      expect((await factory.getTokensByCreator(creator2.address)).length).to.equal(2);
    });

    it("Should revert on empty name", async function () {
      await expect(
        factory.connect(creator1).createToken("", "MYT", 1000n)
      ).to.be.revertedWith("TokenFactory: empty name");
    });

    it("Should revert on empty symbol", async function () {
      await expect(
        factory.connect(creator1).createToken("My Token", "", 1000n)
      ).to.be.revertedWith("TokenFactory: empty symbol");
    });

    it("Should revert on zero initial supply", async function () {
      await expect(
        factory.connect(creator1).createToken("My Token", "MYT", 0n)
      ).to.be.revertedWith("TokenFactory: zero supply");
    });

    it("Should revert when paused", async function () {
      await factory.connect(owner).pause();
      await expect(
        factory.connect(creator1).createToken("My Token", "MYT", 1000n)
      ).to.be.revertedWithCustomError(factory, "EnforcedPause");
    });
  });

  // ─── getTokensByCreator / getAllTokens ──────────────────────────────────────

  describe("View functions", function () {
    it("getTokensByCreator returns empty array for a creator with no tokens", async function () {
      const tokens = await factory.getTokensByCreator(creator1.address);
      expect(tokens.length).to.equal(0);
    });

    it("getAllTokens handles an out-of-range offset", async function () {
      await factory.connect(creator1).createToken("My Token", "MYT", 1000n);
      const page = await factory.getAllTokens(999, 10);
      expect(page.length).to.equal(0);
    });

    it("getAllTokens returns a partial page when limit exceeds remaining items", async function () {
      await factory.connect(creator1).createToken("A", "A", 1n);
      await factory.connect(creator1).createToken("B", "B", 1n);
      await factory.connect(creator1).createToken("C", "C", 1n);

      const page = await factory.getAllTokens(2, 10);
      expect(page.length).to.equal(1);
    });

    it("getAllTokens respects offset and limit together", async function () {
      await factory.connect(creator1).createToken("A", "A", 1n);
      await factory.connect(creator1).createToken("B", "B", 1n);
      await factory.connect(creator1).createToken("C", "C", 1n);

      const page = await factory.getAllTokens(1, 1);
      const all = await factory.getAllTokens(0, 10);
      expect(page.length).to.equal(1);
      expect(page[0]).to.equal(all[1]);
    });
  });

  // ─── Pause / Unpause ────────────────────────────────────────────────────────

  describe("Pause / Unpause", function () {
    it("Owner can pause and unpause", async function () {
      await factory.connect(owner).pause();
      expect(await factory.paused()).to.equal(true);

      await factory.connect(owner).unpause();
      expect(await factory.paused()).to.equal(false);
    });

    it("Non-owner cannot pause", async function () {
      await expect(
        factory.connect(creator1).pause()
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Non-owner cannot unpause", async function () {
      await factory.connect(owner).pause();
      await expect(
        factory.connect(creator1).unpause()
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });
});
