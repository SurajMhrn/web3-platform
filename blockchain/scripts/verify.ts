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

/**
 * Every contract deploy.ts puts on chain, each with the constructor arguments
 * it was given. Driving verification from this list rather than a hand-written
 * block per contract is what keeps the two scripts from drifting apart — a
 * contract added to the deployment but not here is now a loud failure instead
 * of a silent gap.
 *
 * CustomToken is deliberately absent: instances are created at runtime by
 * TokenFactory, not by deploy.ts, so they have no fixed address to verify.
 */
const VERIFIABLE_CONTRACTS = ["PlatformRegistry", "UserRegistry", "TokenFactory"] as const;

async function verifyContract(
  name: string,
  address: string,
  constructorArguments: unknown[]
): Promise<"verified" | "already" | "failed"> {
  console.log(`Verifying ${name} at ${address}...`);
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`  ✅ ${name} verified\n`);
    return "verified";
  } catch (e: any) {
    if (String(e.message).toLowerCase().includes("already verified")) {
      console.log(`  ℹ️  ${name} already verified\n`);
      return "already";
    }
    console.error(`  ❌ ${name} verification failed:`, e.message, "\n");
    return "failed";
  }
}

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

  const results: Record<string, string> = {};

  for (const name of VERIFIABLE_CONTRACTS) {
    const entry = contracts[name];
    if (!entry?.address) {
      console.error(`  ❌ ${name} missing from deployments.json — was it deployed?\n`);
      results[name] = "missing";
      continue;
    }
    // All three take the deployer as their initialOwner (see deploy.ts).
    results[name] = await verifyContract(name, entry.address, [deployer]);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const [name, outcome] of Object.entries(results)) {
    console.log(`  ${name.padEnd(18)} ${outcome}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const failed = Object.entries(results).filter(([, o]) => o === "failed" || o === "missing");
  if (failed.length > 0) {
    throw new Error(`${failed.length} contract(s) not verified: ${failed.map(([n]) => n).join(", ")}`);
  }
  console.log("  Verification complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
