const fs = require("fs");
const path = require("path");

const CONTRACTS = ["GroToken", "FoodUSD", "GroVault", "GroupPurchase", "CoopGovernor"];

const network = process.env.TOKENISM_NETWORK || "hardhat";
const chainId = Number(process.env.TOKENISM_CHAIN_ID || "31337");
const requireAddresses = process.env.REQUIRE_DEPLOYMENT_ADDRESSES === "true";
const requireAttestation = process.env.REQUIRE_DEPLOYMENT_ATTESTATION === "true";
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

const attestation = buildAttestation();
const manifest = {
  chain_id: chainId,
  network,
  generated_at: new Date().toISOString(),
  ...(attestation ? { attestation } : {}),
  contracts,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);

function envName(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

function buildAttestation() {
  const manifestId = process.env.TOKENISM_DEPLOYMENT_MANIFEST_ID;
  if (!manifestId && !requireAttestation) {
    return undefined;
  }

  const approvalId = requiredEnv("TOKENISM_DEPLOYMENT_APPROVAL_ID");
  const approvedBy = requiredEnv("TOKENISM_DEPLOYMENT_APPROVED_BY");
  const approvalKid = requiredEnv("TOKENISM_DEPLOYMENT_APPROVAL_KID");
  const approvalHmac = requiredEnv("TOKENISM_DEPLOYMENT_APPROVAL_HMAC");
  const manifestKid = requiredEnv("TOKENISM_DEPLOYMENT_MANIFEST_KID");
  const manifestHmac = requiredEnv("TOKENISM_DEPLOYMENT_MANIFEST_HMAC");

  return {
    manifest_id: manifestId || `${network}-${chainId}-${Date.now()}`,
    environment: process.env.TOKENISM_DEPLOYMENT_ENVIRONMENT || network,
    ...(process.env.TOKENISM_RPC_REF ? { rpc_ref: process.env.TOKENISM_RPC_REF } : {}),
    ...(process.env.TOKENISM_WALLET_SIGNER_REF ? {
      wallet_custody: {
        custody_type: process.env.TOKENISM_WALLET_CUSTODY_TYPE || "other",
        signer_ref: process.env.TOKENISM_WALLET_SIGNER_REF,
        ...(process.env.TOKENISM_WALLET_POLICY_REF ? { policy_ref: process.env.TOKENISM_WALLET_POLICY_REF } : {}),
        ...(process.env.TOKENISM_WALLET_OPERATOR_REF ? { operator_ref: process.env.TOKENISM_WALLET_OPERATOR_REF } : {}),
      },
    } : {}),
    ...(process.env.TOKENISM_FIREFLY_INSTANCE_REF ? {
      firefly: {
        instance_ref: process.env.TOKENISM_FIREFLY_INSTANCE_REF,
        environment: process.env.TOKENISM_FIREFLY_ENVIRONMENT || network,
        ...(process.env.TOKENISM_FIREFLY_ACCOUNT_REF ? { account_ref: process.env.TOKENISM_FIREFLY_ACCOUNT_REF } : {}),
      },
    } : {}),
    approvals: [
      {
        approval_id: approvalId,
        scope: "settlement_deployment_manifest",
        approved_by: approvedBy,
        approved_at: process.env.TOKENISM_DEPLOYMENT_APPROVED_AT || new Date().toISOString(),
        ...(process.env.TOKENISM_DEPLOYMENT_APPROVAL_EXPIRES_AT ? { expires_at: process.env.TOKENISM_DEPLOYMENT_APPROVAL_EXPIRES_AT } : {}),
        signature: {
          alg: process.env.TOKENISM_DEPLOYMENT_SIGNATURE_ALG || "HMAC-SHA256",
          kid: approvalKid,
          hmac: approvalHmac,
        },
      },
    ],
    signed_at: process.env.TOKENISM_DEPLOYMENT_SIGNED_AT || new Date().toISOString(),
    ...(process.env.TOKENISM_DEPLOYMENT_EXPIRES_AT ? { expires_at: process.env.TOKENISM_DEPLOYMENT_EXPIRES_AT } : {}),
    signature: {
      alg: process.env.TOKENISM_DEPLOYMENT_SIGNATURE_ALG || "HMAC-SHA256",
      kid: manifestKid,
      hmac: manifestHmac,
    },
  };
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} for deployment attestation export.`);
  }
  return value;
}
