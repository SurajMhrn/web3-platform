import { expect } from "chai";
import { ethers } from "hardhat";
import { PlatformRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PlatformRegistry", function () {
  let platformRegistry: PlatformRegistry;
  let owner: SignerWithAddress;
  let nonOwner: SignerWithAddress;
  const DUMMY_ADDRESS = "0x0000000000000000000000000000000000000001";
  const ANOTHER_ADDRESS = "0x0000000000000000000000000000000000000002";

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();

    const PlatformRegistryFactory = await ethers.getContractFactory("PlatformRegistry");
    platformRegistry = await PlatformRegistryFactory.deploy(owner.address);
    await platformRegistry.waitForDeployment();
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await platformRegistry.owner()).to.equal(owner.address);
    });

    it("Should start with zero registered contracts", async function () {
      expect(await platformRegistry.getTotalContracts()).to.equal(0);
    });
  });

  // ─── setContract ────────────────────────────────────────────────────────────

  describe("setContract", function () {
    it("Should register a contract address", async function () {
      await expect(
        platformRegistry.connect(owner).setContract("UserRegistry", DUMMY_ADDRESS)
      ).to.emit(platformRegistry, "ContractRegistered");

      expect(await platformRegistry.getContract("UserRegistry")).to.equal(DUMMY_ADDRESS);
    });

    it("Should emit ContractRegistered with the exact key hash, address, updater, and readable name", async function () {
      const key = ethers.keccak256(ethers.toUtf8Bytes("UserRegistry"));
      await expect(
        platformRegistry.connect(owner).setContract("UserRegistry", DUMMY_ADDRESS)
      )
        .to.emit(platformRegistry, "ContractRegistered")
        .withArgs(key, DUMMY_ADDRESS, owner.address, "UserRegistry");
    });

    it("Should update an existing contract address", async function () {
      await platformRegistry.connect(owner).setContract("UserRegistry", DUMMY_ADDRESS);
      await platformRegistry.connect(owner).setContract("UserRegistry", ANOTHER_ADDRESS);

      expect(await platformRegistry.getContract("UserRegistry")).to.equal(ANOTHER_ADDRESS);
    });

    it("Should not double-count keys on update", async function () {
      await platformRegistry.connect(owner).setContract("UserRegistry", DUMMY_ADDRESS);
      await platformRegistry.connect(owner).setContract("UserRegistry", ANOTHER_ADDRESS);

      // Only 1 unique key should exist
      expect(await platformRegistry.getTotalContracts()).to.equal(1);
    });

    it("Should revert if called by non-owner", async function () {
      await expect(
        platformRegistry.connect(nonOwner).setContract("UserRegistry", DUMMY_ADDRESS)
      ).to.be.revertedWithCustomError(platformRegistry, "OwnableUnauthorizedAccount");
    });

    it("Should revert if address is zero", async function () {
      await expect(
        platformRegistry.connect(owner).setContract("UserRegistry", ethers.ZeroAddress)
      ).to.be.revertedWith("PlatformRegistry: zero address");
    });

    it("Should revert if name is empty", async function () {
      await expect(
        platformRegistry.connect(owner).setContract("", DUMMY_ADDRESS)
      ).to.be.revertedWith("PlatformRegistry: empty name");
    });
  });

  // ─── getContract ────────────────────────────────────────────────────────────

  describe("getContract", function () {
    it("Should return address(0) for unknown contract name", async function () {
      expect(await platformRegistry.getContract("Unknown")).to.equal(ethers.ZeroAddress);
    });

    it("Should return registered address", async function () {
      await platformRegistry.connect(owner).setContract("TokenFactory", ANOTHER_ADDRESS);
      expect(await platformRegistry.getContract("TokenFactory")).to.equal(ANOTHER_ADDRESS);
    });
  });

  // ─── getContractByKey ───────────────────────────────────────────────────────

  describe("getContractByKey", function () {
    it("Should look up a registered address by its bytes32 key directly", async function () {
      await platformRegistry.connect(owner).setContract("UserRegistry", DUMMY_ADDRESS);
      const key = ethers.keccak256(ethers.toUtf8Bytes("UserRegistry"));
      expect(await platformRegistry.getContractByKey(key)).to.equal(DUMMY_ADDRESS);
    });

    it("Should return address(0) for an unknown key", async function () {
      const key = ethers.keccak256(ethers.toUtf8Bytes("Unknown"));
      expect(await platformRegistry.getContractByKey(key)).to.equal(ethers.ZeroAddress);
    });
  });

  // ─── Ownership ──────────────────────────────────────────────────────────────

  describe("Ownership", function () {
    it("Should allow the owner to transfer ownership", async function () {
      await platformRegistry.connect(owner).transferOwnership(nonOwner.address);
      expect(await platformRegistry.owner()).to.equal(nonOwner.address);
    });

    it("Should allow the new owner to call setContract after transfer", async function () {
      await platformRegistry.connect(owner).transferOwnership(nonOwner.address);
      await platformRegistry.connect(nonOwner).setContract("UserRegistry", DUMMY_ADDRESS);
      expect(await platformRegistry.getContract("UserRegistry")).to.equal(DUMMY_ADDRESS);
    });

    it("Should revert if a non-owner tries to transfer ownership", async function () {
      await expect(
        platformRegistry.connect(nonOwner).transferOwnership(nonOwner.address)
      ).to.be.revertedWithCustomError(platformRegistry, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Multiple contracts ─────────────────────────────────────────────────────

  describe("Multiple contracts", function () {
    it("Should handle multiple distinct contracts", async function () {
      await platformRegistry.connect(owner).setContract("UserRegistry", DUMMY_ADDRESS);
      await platformRegistry.connect(owner).setContract("TokenFactory", ANOTHER_ADDRESS);

      expect(await platformRegistry.getTotalContracts()).to.equal(2);
      expect(await platformRegistry.getContract("UserRegistry")).to.equal(DUMMY_ADDRESS);
      expect(await platformRegistry.getContract("TokenFactory")).to.equal(ANOTHER_ADDRESS);
    });
  });
});
