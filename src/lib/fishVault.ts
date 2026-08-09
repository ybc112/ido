import { Contract, parseUnits, type Signer } from "ethers";

/** 出海捕鱼金库配置（VITE_FISHING_* 可覆盖） */
export const FISHING_VAULT_ADDRESS = String(import.meta.env.VITE_FISHING_VAULT_ADDRESS ?? "")
  .trim();
export const FISHING_GAME_TOKEN = String(import.meta.env.VITE_FISHING_GAME_TOKEN ?? "")
  .trim() || "0x839578f40b9a79a3fe891dd96079f3083e6e7777"; // CAPY
export const FISHING_BACKEND_URL = String(import.meta.env.VITE_FISHING_BACKEND_URL ?? "")
  .trim() || "https://fishing.kimi-vault.com";

export const TOKEN_DECIMALS = 18;

export const vaultAbi = [
  "function deposit(uint256 amount)",
  "function claimReward(uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature)",
  "function nonces(address) view returns (uint256)",
  "function deposited(address) view returns (uint256)",
  "function claimed(address) view returns (uint256)",
  "function signer() view returns (address)",
  "function paused() view returns (bool)",
] as const;

export const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
] as const;

export function parseFishAmount(value: string): bigint {
  return parseUnits(value || "0", TOKEN_DECIMALS);
}

export async function ensureVaultAllowance(signer: Signer, amount: bigint) {
  const token = new Contract(FISHING_GAME_TOKEN, erc20Abi, signer);
  const from = await signer.getAddress();
  const current = await token.allowance(from, FISHING_VAULT_ADDRESS);
  if (current >= amount) return;
  const tx = await token.approve(FISHING_VAULT_ADDRESS, amount * 2n);
  await tx.wait();
}

export async function depositToVault(signer: Signer, amount: bigint) {
  await ensureVaultAllowance(signer, amount);
  const vault = new Contract(FISHING_VAULT_ADDRESS, vaultAbi, signer);
  const tx = await vault.deposit(amount);
  await tx.wait();
  return tx.hash;
}

export async function claimFromVault(
  signer: Signer,
  amount: bigint,
  nonce: bigint,
  deadline: number,
  signature: string,
) {
  const vault = new Contract(FISHING_VAULT_ADDRESS, vaultAbi, signer);
  const tx = await vault.claimReward(amount, nonce, deadline, signature);
  await tx.wait();
  return tx.hash;
}

export async function fetchFishState(player: string): Promise<{
  balance: bigint;
  deposited: bigint;
  claimed: bigint;
  totalBet: bigint;
  totalWon: bigint;
} | null> {
  try {
    const res = await fetch(`${FISHING_BACKEND_URL}/api/fishing/state?player=${player}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      balance: BigInt(data.balance ?? 0),
      deposited: BigInt(data.deposited ?? 0),
      claimed: BigInt(data.claimed ?? 0),
      totalBet: BigInt(data.totalBet ?? 0),
      totalWon: BigInt(data.totalWon ?? 0),
    };
  } catch {
    return null;
  }
}
