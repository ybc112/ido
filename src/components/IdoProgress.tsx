import { useEffect, useState } from "react";
import { JsonRpcProvider } from "ethers";
import {
  BSC_RPC_URL,
  IDO_CHAIN_ID,
  IDO_HARD_CAP_BNB,
  IDO_RECEIVER_ADDRESS,
  IDO_SOFT_CAP_BNB,
} from "@/lib/ido";

/**
 * KIMIAI IDO 进度条：直接查收款地址的链上 BNB 余额作为已募金额，
 * 每 15 秒轮询一次（转账成功后会自然刷新）。
 */
export function IdoProgress({ compact = false }: { compact?: boolean }) {
  const [raised, setRaised] = useState<bigint | null>(null);

  useEffect(() => {
    let active = true;
    const provider = new JsonRpcProvider(BSC_RPC_URL, IDO_CHAIN_ID, {
      staticNetwork: true,
    });
    const refresh = async () => {
      try {
        const balance = await provider.getBalance(IDO_RECEIVER_ADDRESS);
        if (active) setRaised(balance);
      } catch {
        // 读链失败保留旧值，下轮重试
      }
    };
    void refresh();
    const timer = setInterval(refresh, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
      provider.destroy();
    };
  }, []);

  const raisedBNB = raised === null ? null : Number(raised) / 1e18;
  const percent =
    raisedBNB === null ? 0 : Math.min(100, (raisedBNB / IDO_HARD_CAP_BNB) * 100);
  const softReached = raisedBNB !== null && raisedBNB >= IDO_SOFT_CAP_BNB;
  const full = raisedBNB !== null && raisedBNB >= IDO_HARD_CAP_BNB;
  const softTick = Math.min(100, (IDO_SOFT_CAP_BNB / IDO_HARD_CAP_BNB) * 100);

  return (
    <div>
      <div
        className={
          compact
            ? "mb-1 flex items-center justify-between text-xs"
            : "mb-2 flex items-center justify-between text-sm"
        }
      >
        <span className="text-[#9CA3AF]">
          已募{" "}
          <span className="font-bold text-white">
            {raisedBNB === null ? "--" : raisedBNB.toFixed(2)}
          </span>{" "}
          / {IDO_HARD_CAP_BNB} BNB
        </span>
        <span className="text-[#6B7280]">
          {full ? (
            <span className="font-bold text-[#2EDEDB]">已满额 🎉</span>
          ) : softReached ? (
            <span className="font-bold text-[#D0FF00]">软顶已达成</span>
          ) : (
            `软顶 ${IDO_SOFT_CAP_BNB} BNB`
          )}
        </span>
      </div>
      <div
        className={
          compact
            ? "relative h-1.5 overflow-hidden rounded-full bg-[#25282C]"
            : "relative h-2.5 overflow-hidden rounded-full bg-[#25282C]"
        }
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#D0FF00] to-[#2EDEDB] transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
        {/* 软顶刻度线 */}
        <div
          className="absolute top-0 h-full w-px bg-[#9CA3AF]/70"
          style={{ left: `${softTick}%` }}
          title={`软顶 ${IDO_SOFT_CAP_BNB} BNB`}
        />
      </div>
    </div>
  );
}
