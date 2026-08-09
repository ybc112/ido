import { parseEther } from "ethers";

/**
 * KIMIAI IDO 纯转账预售配置。
 *
 * 不是智能合约：用户直接往收款地址转 BNB 即完成认购，
 * 软顶/硬顶仅作展示与进度参考，收款确认由平台人工处理。
 * 所有值都可以用 VITE_IDO_* 环境变量覆盖。
 */

export const IDO_RECEIVER_ADDRESS = String(import.meta.env.VITE_IDO_RECEIVER_ADDRESS ?? "")
  .trim() || "0x315bDFE49A90113DFf636a63489b928273c826F9";

/** 软顶：达到后 IDO 视为成功 */
export const IDO_SOFT_CAP_BNB = Number(import.meta.env.VITE_IDO_SOFT_CAP ?? 20);

/** 硬顶：达到后停止接收 */
export const IDO_HARD_CAP_BNB = Number(import.meta.env.VITE_IDO_HARD_CAP ?? 40);

/** 单笔可选金额：0.1 ~ 0.5 BNB，0.1 步进 */
export const IDO_AMOUNT_OPTIONS = [0.1, 0.2, 0.3, 0.4, 0.5] as const;

export const IDO_CHAIN_ID = 56;

export const BSC_RPC_URL = "https://bsc-rpc.publicnode.com";

export function idoAmountToWei(amount: number): bigint {
  return parseEther(amount.toFixed(2));
}

export function shortIdoAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}
