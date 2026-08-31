import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment script for the Web3 Platform smart contracts.
 *
 * Deploys:
 *   1. PlatformRegistry  — central on-chain directory
 *   2. UserRegistry      — user registration contract
 *   3. TokenFactory      — factory that deploys user ERC20 tokens
 *
 * After deployment, registers all contracts in PlatformRegistry and
 * writes the deployed addresses + ABIs to the frontend constants directory
 * so the UI always has fresh, correct values.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network localhost
 *   npx hardhat run scripts/deploy.ts --network sepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Web3 Platform — Smart Contract Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network:   ${networkName}`);
  console.log(`  Deployer:  ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:   ${ethers.formatEther(balance)} ETH`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── 1. Deploy PlatformRegistry ─────────────────────────────────────────────
  console.log("Deploying PlatformRegistry...");
  const PlatformRegistryFactory = await ethers.getContractFactory("PlatformRegistry");
  const platformRegistry = await PlatformRegistryFactory.deploy(deployer.address);
  await platformRegistry.waitForDeployment();
  const platformRegistryAddress = await platformRegistry.getAddress();
  console.log(`  ✅ PlatformRegistry → ${platformRegistryAddress}`);

  // ── 2. Deploy UserRegistry ─────────────────────────────────────────────────
  console.log("\nDeploying UserRegistry...");
  const UserRegistryFactory = await ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistryFactory.deploy(deployer.address);
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log(`  ✅ UserRegistry → ${userRegistryAddress}`);

  // ── 3. Deploy TokenFactory ─────────────────────────────────────────────────
  console.log("\nDeploying TokenFactory...");
  const TokenFactoryContractFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactory = await TokenFactoryContractFactory.deploy(deployer.address);
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log(`  ✅ TokenFactory → ${tokenFactoryAddress}`);

  // ── 4. Register contracts in PlatformRegistry ─────────────────────────────
  console.log("\nRegistering contracts in PlatformRegistry...");
  let tx = await platformRegistry.setContract("UserRegistry", userRegistryAddress);
  await tx.wait();
  console.log(`  ✅ UserRegistry registered`);

  tx = await platformRegistry.setContract("TokenFactory", tokenFactoryAddress);
  await tx.wait();
  console.log(`  ✅ TokenFactory registered`);

  // ── 5. Write deployments.json to frontend ─────────────────────────────────
  const deploymentsPath = path.resolve(
    __dirname,
    "../../frontend/src/constants/deployments.json"
  );

  // Read existing deployments or start fresh
  let deployments: Record<string, any> = {};
  if (fs.existsSync(deploymentsPath)) {
    try {
      deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    } catch {
      deployments = {};
    }
  }

  // Load ABIs from compiled artifacts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const platformRegistryArtifact = require(
    "../artifacts/contracts/PlatformRegistry.sol/PlatformRegistry.json"
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const userRegistryArtifact = require(
    "../artifacts/contracts/UserRegistry.sol/UserRegistry.json"
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tokenFactoryArtifact = require(
    "../artifacts/contracts/TokenFactory.sol/TokenFactory.json"
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const customTokenArtifact = require(
    "../artifacts/contracts/CustomToken.sol/CustomToken.json"
  );

  deployments[networkName] = {
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PlatformRegistry: {
        address: platformRegistryAddress,
        abi: platformRegistryArtifact.abi,
      },
      UserRegistry: {
        address: userRegistryAddress,
        abi: userRegistryArtifact.abi,
      },
      TokenFactory: {
        address: tokenFactoryAddress,
        abi: tokenFactoryArtifact.abi,
      },
      // CustomToken ABI only (no fixed address — each user deploys their own)
      CustomToken: {
        address: null,
        abi: customTokenArtifact.abi,
      },
    },
  };

  fs.mkdirSync(path.dirname(deploymentsPath), { recursive: true });
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\n  ✅ deployments.json written → ${deploymentsPath}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Deployment complete!");
  if (networkName === "sepolia") {
    console.log(`\n  Verify contracts with:`);
    console.log(`  npx hardhat run scripts/verify.ts --network sepolia`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
