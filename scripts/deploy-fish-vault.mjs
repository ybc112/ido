// 部署 FishGameVault 到 BSC 主网
// 用法：node scripts/deploy-fish-vault.mjs
// 环境变量（.env）：
//   PRIVATE_KEY            部署钱包私钥（也是合约 owner）
//   FISHING_SIGNER_PRIVATE_KEY  签名钱包私钥（后端用，必须与部署钱包不同）
//   FISHING_GAME_TOKEN     游戏代币（默认 CAPY 0x839578f40b9a79a3fe891dd96079f3083e6e7777）
// 可选：
//   FISHING_MAX_CLAIM_PER_TX  单笔下分上限（wei，默认 0=不限）
//   FISHING_DAILY_CLAIM_CAP   单地址每日下分上限（wei，默认 0=不限）
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider, Wallet, ContractFactory, parseEther, getAddress } from "ethers";

const artifact = JSON.parse(fs.readFileSync(path.resolve("artifacts/FishGameVault.json"), "utf8"));
const deployKey = process.env.PRIVATE_KEY || "";
const signerKey = process.env.FISHING_SIGNER_PRIVATE_KEY || "";
const token =
  process.env.FISHING_GAME_TOKEN?.trim() || "0x839578f40b9a79a3fe891dd96079f3083e6e7777";
const rpc = process.env.FISHING_RPC_URL?.trim() || "https://rpc-bsc.48.club";

if (!deployKey || !signerKey) {
  console.error("缺少 PRIVATE_KEY 或 FISHING_SIGNER_PRIVATE_KEY");
  process.exit(1);
}

const signerWallet = new Wallet(signerKey);
const provider = new JsonRpcProvider(rpc, 56, { staticNetwork: true });
const deployer = new Wallet(deployKey, provider);
const factory = new ContractFactory(artifact.abi, artifact.bytecode, deployer);

const maxPerTx = process.env.FISHING_MAX_CLAIM_PER_TX ? BigInt(process.env.FISHING_MAX_CLAIM_PER_TX) : 0n;
const dailyCap = process.env.FISHING_DAILY_CLAIM_CAP ? BigInt(process.env.FISHING_DAILY_CLAIM_CAP) : 0n;

console.log("部署者:", deployer.address);
console.log("签名钱包:", signerWallet.address);
console.log("游戏代币:", token);
console.log("单笔上限:", maxPerTx === 0n ? "不限" : maxPerTx.toString(), "| 每日上限:", dailyCap === 0n ? "不限" : dailyCap.toString());

const contract = await factory.deploy(getAddress(token), signerWallet.address, maxPerTx, dailyCap);
await contract.waitForDeployment();
const address = await contract.getAddress();
console.log("\n✅ FishGameVault 部署成功:", address);
console.log("交易哈希:", contract.deploymentTransaction()?.hash);
console.log("\n部署完成后：");
console.log(`  1. 服务器 .env 填 FISHING_VAULT_ADDRESS=${address}`);
console.log(`  2. 平台向合约预充奖池（fundPool 或直接转账 ${token}）`);
console.log("  3. 到 BscScan 开源验证合约（Owner 验证）");
