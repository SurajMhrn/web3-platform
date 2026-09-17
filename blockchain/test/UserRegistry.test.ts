import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { UserRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("UserRegistry", function () {
  let userRegistry: UserRegistry;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let stranger: SignerWithAddress;

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(async function () {
    [owner, user1, user2, stranger] = await ethers.getSigners();

    const UserRegistryFactory = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistryFactory.deploy(owner.address);
    await userRegistry.waitForDeployment();
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await userRegistry.owner()).to.equal(owner.address);
    });

    it("Should start with zero registered users", async function () {
      expect(await userRegistry.getTotalUsers()).to.equal(0);
    });

    it("Should start unpaused", async function () {
      expect(await userRegistry.paused()).to.equal(false);
    });
  });

  // ─── registerUser ───────────────────────────────────────────────────────────

  describe("registerUser", function () {
    it("Should register a user with valid data", async function () {
      await expect(
        userRegistry.connect(user1).registerUser("alice", "alice@example.com")
      ).to.emit(userRegistry, "UserRegistered")
        .withArgs(user1.address, "alice", "user", anyValue);

      const info = await userRegistry.getUser(user1.address);
      expect(info.username).to.equal("alice");
      expect(info.email).to.equal("alice@example.com");
      expect(info.role).to.equal("user");
      expect(info.isRegistered).to.equal(true);
      expect(info.isActive).to.equal(true);
    });

    it("Should increment total user count", async function () {
      await userRegistry.connect(user1).registerUser("alice", "alice@example.com");
      await userRegistry.connect(user2).registerUser("bob", "bob@example.com");
      expect(await userRegistry.getTotalUsers()).to.equal(2);
    });

    it("Should revert if already registered", async function () {
      await userRegistry.connect(user1).registerUser("alice", "alice@example.com");
      await expect(
        userRegistry.connect(user1).registerUser("alice2", "alice2@example.com")
      ).to.be.revertedWith("UserRegistry: already registered");
    });

    it("Should revert if username is empty", async function () {
      await expect(
        userRegistry.connect(user1).registerUser("", "alice@example.com")
      ).to.be.revertedWith("UserRegistry: username cannot be empty");
    });

    it("Should revert if email is empty", async function () {
      await expect(
        userRegistry.connect(user1).registerUser("alice", "")
      ).to.be.revertedWith("UserRegistry: email cannot be empty");
    });

    it("Should always assign the default role, never a caller-chosen one", async function () {
      await userRegistry.connect(user1).registerUser("alice", "alice@example.com");
      expect((await userRegistry.getUser(user1.address)).role).to.equal("user");
      expect(await userRegistry.DEFAULT_ROLE()).to.equal("user");
    });

    it("Should revert when paused", async function () {
      await userRegistry.connect(owner).pause();
      await expect(
        userRegistry.connect(user1).registerUser("alice", "alice@example.com")
      ).to.be.revertedWithCustomError(userRegistry, "EnforcedPause");
    });
  });

  // ─── setUserRole ────────────────────────────────────────────────────────────

  describe("setUserRole", function () {
    beforeEach(async function () {
      await userRegistry.connect(user1).registerUser("alice", "alice@example.com");
    });

    it("Should let the owner promote a user and emit the change", async function () {
      await expect(userRegistry.connect(owner).setUserRole(user1.address, "admin"))
        .to.emit(userRegistry, "UserRoleChanged")
        .withArgs(user1.address, "user", "admin", anyValue);

      expect((await userRegistry.getUser(user1.address)).role).to.equal("admin");
    });

    it("Should accept every known role", async function () {
      for (const role of ["moderator", "admin", "user"]) {
        await userRegistry.connect(owner).setUserRole(user1.address, role);
        expect((await userRegistry.getUser(user1.address)).role).to.equal(role);
      }
    });

    it("Should reject a non-owner trying to promote anyone", async function () {
      await expect(
        userRegistry.connect(user1).setUserRole(user1.address, "admin")
      ).to.be.revertedWithCustomError(userRegistry, "OwnableUnauthorizedAccount");

      await expect(
        userRegistry.connect(user2).setUserRole(user1.address, "admin")
      ).to.be.revertedWithCustomError(userRegistry, "OwnableUnauthorizedAccount");

      // the attempt must leave the role untouched
      expect((await userRegistry.getUser(user1.address)).role).to.equal("user");
    });

    it("Should reject an unknown role string", async function () {
      await expect(
        userRegistry.connect(owner).setUserRole(user1.address, "superadmin")
      ).to.be.revertedWith("UserRegistry: unknown role");

      await expect(
        userRegistry.connect(owner).setUserRole(user1.address, "")
      ).to.be.revertedWith("UserRegistry: unknown role");
    });

    it("Should reject an address that never registered", async function () {
      await expect(
        userRegistry.connect(owner).setUserRole(user2.address, "admin")
      ).to.be.revertedWith("UserRegistry: address not registered");
    });

    it("Should update the timestamp when the role changes", async function () {
      const before = (await userRegistry.getUser(user1.address)).updatedAt;
      await userRegistry.connect(owner).setUserRole(user1.address, "moderator");
      const after = (await userRegistry.getUser(user1.address)).updatedAt;
      expect(after).to.be.greaterThanOrEqual(before);
    });
  });

  // ─── updateUser ─────────────────────────────────────────────────────────────

  describe("updateUser", function () {
    beforeEach(async function () {
      await userRegistry.connect(user1).registerUser("alice", "alice@example.com");
    });

    it("Should update username and email", async function () {
      await expect(
        userRegistry.connect(user1).updateUser("alice_updated", "new@example.com")
      ).to.emit(userRegistry, "UserUpdated")
        .withArgs(user1.address, "alice_updated", anyValue);

      const info = await userRegistry.getUser(user1.address);
      expect(info.username).to.equal("alice_updated");
      expect(info.email).to.equal("new@example.com");
    });

    it("Should revert if not registered", async function () {
      await expect(
        userRegistry.connect(stranger).updateUser("stranger", "s@example.com")
      ).to.be.revertedWith("UserRegistry: address not registered");
    });

    it("Should revert with empty username", async function () {
      await expect(
        userRegistry.connect(user1).updateUser("", "new@example.com")
      ).to.be.revertedWith("UserRegistry: username cannot be empty");
    });

    it("Should revert with empty email", async function () {
      await expect(
        userRegistry.connect(user1).updateUser("alice_updated", "")
      ).to.be.revertedWith("UserRegistry: email cannot be empty");
    });

    it("Should revert when paused", async function () {
      await userRegistry.connect(owner).pause();
      await expect(
        userRegistry.connect(user1).updateUser("alice_updated", "new@example.com")
      ).to.be.revertedWithCustomError(userRegistry, "EnforcedPause");
    });

    it("Should revert if account is deactivated", async function () {
      await userRegistry.connect(owner).deactivateUser(user1.address);
      await expect(
        userRegistry.connect(user1).updateUser("alice_updated", "new@example.com")
      ).to.be.revertedWith("UserRegistry: account deactivated");
    });
  });

  // ─── deactivateUser ─────────────────────────────────────────────────────────

  describe("deactivateUser", function () {
    beforeEach(async function () {
      await userRegistry.connect(user1).registerUser("alice", "alice@example.com");
    });

    it("Should deactivate user (owner only)", async function () {
      await expect(
        userRegistry.connect(owner).deactivateUser(user1.address)
      ).to.emit(userRegistry, "UserDeactivated")
        .withArgs(user1.address, anyValue);

      const info = await userRegistry.getUser(user1.address);
      expect(info.isActive).to.equal(false);
      expect(info.isRegistered).to.equal(true);
    });

    it("Should revert if caller is not owner", async function () {
      await expect(
        userRegistry.connect(user2).deactivateUser(user1.address)
      ).to.be.revertedWithCustomError(userRegistry, "OwnableUnauthorizedAccount");
    });

    it("Should revert if user is not registered", async function () {
      await expect(
        userRegistry.connect(owner).deactivateUser(stranger.address)
      ).to.be.revertedWith("UserRegistry: address not registered");
    });

    it("Should revert if already deactivated", async function () {
      await userRegistry.connect(owner).deactivateUser(user1.address);
      await expect(
        userRegistry.connect(owner).deactivateUser(user1.address)
      ).to.be.revertedWith("UserRegistry: already deactivated");
    });
  });

  // ─── View Functions ─────────────────────────────────────────────────────────

  describe("View Functions", function () {
    beforeEach(async function () {
      await userRegistry.connect(user1).registerUser("alice", "alice@example.com");
    });

    it("isUserRegistered returns true for registered user", async function () {
      expect(await userRegistry.isUserRegistered(user1.address)).to.equal(true);
    });

    it("isUserRegistered returns false for unknown address", async function () {
      expect(await userRegistry.isUserRegistered(stranger.address)).to.equal(false);
    });

    it("isUserActive returns true for active user", async function () {
      expect(await userRegistry.isUserActive(user1.address)).to.equal(true);
    });

    it("isUserActive returns false for deactivated user", async function () {
      await userRegistry.connect(owner).deactivateUser(user1.address);
      expect(await userRegistry.isUserActive(user1.address)).to.equal(false);
    });

    it("getUser returns an empty/default struct for a never-registered address", async function () {
      const info = await userRegistry.getUser(stranger.address);
      expect(info.isRegistered).to.equal(false);
      expect(info.isActive).to.equal(false);
      expect(info.username).to.equal("");
    });

    it("getTotalUsers is unaffected by deactivation", async function () {
      await userRegistry.connect(user2).registerUser("bob", "bob@example.com");
      expect(await userRegistry.getTotalUsers()).to.equal(2);

      await userRegistry.connect(owner).deactivateUser(user1.address);
      expect(await userRegistry.getTotalUsers()).to.equal(2);
    });

    it("getRegisteredAddresses returns paginated results", async function () {
      await userRegistry.connect(user2).registerUser("bob", "bob@example.com");
      const page = await userRegistry.getRegisteredAddresses(0, 2);
      expect(page.length).to.equal(2);
      expect(page[0]).to.equal(user1.address);
      expect(page[1]).to.equal(user2.address);
    });

    it("getRegisteredAddresses handles out-of-range offset", async function () {
      const page = await userRegistry.getRegisteredAddresses(999, 10);
      expect(page.length).to.equal(0);
    });

    it("getRegisteredAddresses returns a partial page landing mid-array", async function () {
      await userRegistry.connect(user2).registerUser("bob", "bob@example.com");
      await userRegistry.connect(stranger).registerUser("carol", "carol@example.com");

      const page = await userRegistry.getRegisteredAddresses(1, 2);
      expect(page.length).to.equal(2);
      expect(page[0]).to.equal(user2.address);
      expect(page[1]).to.equal(stranger.address);
    });
  });

  // ─── Pause / Unpause ────────────────────────────────────────────────────────

  describe("Pause / Unpause", function () {
    it("Owner can pause and unpause", async function () {
      await userRegistry.connect(owner).pause();
      expect(await userRegistry.paused()).to.equal(true);

      await userRegistry.connect(owner).unpause();
      expect(await userRegistry.paused()).to.equal(false);
    });

    it("Non-owner cannot pause", async function () {
      await expect(
        userRegistry.connect(user1).pause()
      ).to.be.revertedWithCustomError(userRegistry, "OwnableUnauthorizedAccount");
    });
  });
});


