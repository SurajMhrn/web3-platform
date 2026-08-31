import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Etherscan verification script for Sepolia deployments.
 *
 * Reads deployed addresses from deployments.json and verifies each contract
 * on Etherscan so the source code is publicly visible and auditable.
 *
 * Usage:
 *   npx hardhat run scripts/verify.ts --network sepolia
 */
async function main() {
  const deploymentsPath = path.resolve(
    __dirname,
    "../../frontend/src/constants/deployments.json"
  );

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments.json not found. Run deploy.ts first.");
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const sepoliaDeployment = deployments["sepolia"];

  if (!sepoliaDeployment) {
    throw new Error("No sepolia deployment found in deployments.json.");
  }

  const { contracts, deployer } = sepoliaDeployment;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Web3 Platform — Etherscan Verification");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Verify PlatformRegistry
  console.log(`Verifying PlatformRegistry at ${contracts.PlatformRegistry.address}...`);
  try {
    await run("verify:verify", {
      address: contracts.PlatformRegistry.address,
      constructorArguments: [deployer],
    });
    console.log("  ✅ PlatformRegistry verified\n");
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("  ℹ️  PlatformRegistry already verified\n");
    } else {
      console.error("  ❌ PlatformRegistry verification failed:", e.message, "\n");
    }
  }

  // Verify UserRegistry
  console.log(`Verifying UserRegistry at ${contracts.UserRegistry.address}...`);
  try {
    await run("verify:verify", {
      address: contracts.UserRegistry.address,
      constructorArguments: [deployer],
    });
    console.log("  ✅ UserRegistry verified\n");
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("  ℹ️  UserRegistry already verified\n");
    } else {
      console.error("  ❌ UserRegistry verification failed:", e.message, "\n");
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Verification complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
