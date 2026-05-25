const fs = require("fs");
const path = require("path");

const CONTRACTS = ["GroToken", "FoodUSD", "GroVault", "GroupPurchase", "CoopGovernor"];

const network = process.env.TOKENISM_NETWORK || "hardhat";
const chainId = Number(process.env.TOKENISM_CHAIN_ID || "31337");
const requireAddresses = process.env.REQUIRE_DEPLOYMENT_ADDRESSES === "true";
const outputPath = path.resolve(
  process.env.TOKENISM_MANIFEST_OUT || path.join("deployments", `${network}.abi-manifest.json`)
);

if (!Number.isInteger(chainId) || chainId <= 0) {
  throw new Error(`TOKENISM_CHAIN_ID must be a positive integer, got: ${process.env.TOKENISM_CHAIN_ID}`);
}

const contracts = {};

for (const name of CONTRACTS) {
  const artifactPath = path.resolve("artifacts", "contracts", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Missing Hardhat artifact for ${name}. Run npm test or hardhat compile first.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const address = process.env[`${envName(name)}_ADDRESS`];
  if (requireAddresses && !address) {
    throw new Error(`Missing ${envName(name)}_ADDRESS for deployment manifest export.`);
  }

  contracts[name] = {
    ...(address ? { address } : {}),
    abi: artifact.abi,
    version: process.env.npm_package_version || "0.1.0",
  };
}

const manifest = {
  chain_id: chainId,
  network,
  generated_at: new Date().toISOString(),
  contracts,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);

function envName(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}
