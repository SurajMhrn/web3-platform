import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // This script funds and impersonates an arbitrary address via
  // `hardhat_impersonateAccount`, an RPC method only local dev nodes support.
  // Running it against a real network would either fail loudly or, worse on a
  // node that happens to expose the method, silently act on a real account.
  if (network.name !== "hardhat" && network.name !== "localhost") {
    throw new Error(
      `forceRegister.ts is a local-dev-only utility and refuses to run on network "${network.name}". ` +
        `Use --network hardhat or --network localhost.`
    );
  }

  const userAddress = "0x9da449e1fa38931633128816af86dacd123000e6"; // The user's Reown Email wallet address

  console.log(`Starting forced registration for ${userAddress} on Hardhat...`);

  // Get deployer to fund the account
  const [deployer] = await ethers.getSigners();

  // 1. Send ETH to the user address so they can pay for gas
  console.log("Funding the user account with 1 ETH...");
  await deployer.sendTransaction({
    to: userAddress,
    value: ethers.parseEther("1.0"),
  });

  // 2. Impersonate the user's account
  console.log("Impersonating the user account...");
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [userAddress],
  });

  const impersonatedSigner = await ethers.getSigner(userAddress);

  // 3. Get the deployed UserRegistry address
  const deploymentsPath = path.resolve(__dirname, "../../frontend/src/constants/deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const registryAddress = deployments["localhost"].contracts.UserRegistry.address;
  const registryAbi = deployments["localhost"].contracts.UserRegistry.abi;

  const userRegistry = new ethers.Contract(registryAddress, registryAbi, impersonatedSigner);

  // 4. Register the user
  console.log("Registering the user on-chain...");
  const tx = await userRegistry.registerUser("Admin", "admin@example.com", "admin");
  await tx.wait();

  console.log("✅ Successfully registered the user!");

  // 5. Stop impersonating
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [userAddress],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
