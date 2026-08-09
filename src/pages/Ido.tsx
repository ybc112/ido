import { useState } from "react";
import {
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { IdoProgress } from "@/components/IdoProgress";
import {
  IDO_AMOUNT_OPTIONS,
  IDO_HARD_CAP_BNB,
  IDO_RECEIVER_ADDRESS,
  IDO_SOFT_CAP_BNB,
  idoAmountToWei,
  shortIdoAddress,
} from "@/lib/ido";

type IdoResult = {
  hash: string;
  amount: number;
};

export default function Ido() {
  const wallet = useWallet();
  const { showToast } = useAppStore();
  const [amount, setAmount] = useState<number>(0.1);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<IdoResult | null>(null);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(IDO_RECEIVER_ADDRESS);
      setCopied(true);
      showToast({ type: "success", message: "收款地址已复制，请到钱包发起转账" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: "error", message: "复制失败，请长按地址手动复制" });
    }
  };

  /** 一键转账：直接往收款地址转 BNB（纯转账，不走任何合约） */
  const handleSend = async () => {
    if (!wallet.isConnected || !wallet.signer) {
      await wallet.connectWallet();
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }
    const wei = idoAmountToWei(amount);
    if (wallet.balance && Number(wallet.balance) < amount) {
      showToast({ type: "error", message: "钱包 BNB 余额不足" });
      return;
    }
    setSending(true);
    try {
      const tx = await wallet.signer.sendTransaction({
        to: IDO_RECEIVER_ADDRESS,
        value: wei,
      });
      showToast({ type: "success", message: `转账已提交：${amount} BNB` });
      showToast({ type: "info", message: `等待确认：${tx.hash.slice(0, 10)}...` });
      await tx.wait();
      setResult({ hash: tx.hash, amount });
      showToast({ type: "success", message: `已成功认购 ${amount} BNB，等待平台确认` });
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "转账失败" });
    } finally {
      setSending(false);
    }
  };

  const caps = [
    { label: "软顶", value: IDO_SOFT_CAP_BNB, desc: "达到后 IDO 成功", color: "#D0FF00" },
    { label: "硬顶", value: IDO_HARD_CAP_BNB, desc: "达到后停止接收", color: "#2EDEDB" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[#25282C] bg-[#111215] p-6 lg:p-8">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#D0FF00]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-[#2EDEDB]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-[#D0FF00] px-2 py-0.5 text-[10px] font-bold text-black">
              IDO
            </span>
            <span className="rounded-md border border-[#25282C] px-2 py-0.5 text-[10px] text-[#9CA3AF]">
              KIMI AI · KIMIAI
            </span>
          </div>
          <h1 className="kimi-page-title mt-3">KIMIAI 预售 · 直接转账参与</h1>
          <p className="kimi-page-subtitle">
            向指定收款地址转账 BNB 即完成认购，0.1 ~ 0.5 BNB / 份（0.1 步进），
            无智能合约、无中间环节，转多少记多少。
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            {caps.map((cap) => (
              <div key={cap.label} className="kimi-card">
                <p className="text-xs text-[#6B7280]">{cap.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {cap.value}
                  <span className="ml-1 text-sm font-medium text-[#9CA3AF]">BNB</span>
                </p>
                <p className="mt-1 text-xs" style={{ color: cap.color }}>
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>

          {/* IDO 进度条：已募金额 = 收款地址链上 BNB 余额，15s 轮询 */}
          <div className="mt-6 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
            <IdoProgress />
          </div>
        </div>
      </div>

      {/* Amount picker */}
      <div className="kimi-card">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-white">
          <CircleDollarSign className="h-4 w-4 text-[#D0FF00]" />
          选择认购金额
        </h2>
        <p className="mb-4 text-xs text-[#6B7280]">
          每份 0.1 ~ 0.5 BNB，按 0.1 的倍数选择
        </p>
        <div className="grid grid-cols-5 gap-2">
          {IDO_AMOUNT_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setAmount(option)}
              className={cn(
                "rounded-xl border py-3 text-sm font-bold transition-all",
                amount === option
                  ? "border-[#D0FF00] bg-[#D0FF00]/10 text-[#D0FF00]"
                  : "border-[#25282C] bg-[#0A0B0D] text-[#9CA3AF] hover:border-[#D0FF00]/30 hover:text-white",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Receiver address */}
      <div className="kimi-card">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-[#2EDEDB]" />
          收款地址（BSC / BNB）
        </h2>
        <p className="mb-4 text-xs text-[#6B7280]">
          请务必核对地址后再转账，链上转账不可逆
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
          <code className="min-w-0 flex-1 break-all font-mono text-sm text-[#D0FF00]">
            {IDO_RECEIVER_ADDRESS}
          </code>
          <button
            onClick={copyAddress}
            className="shrink-0 rounded-lg border border-[#25282C] bg-[#111215] p-2 text-[#9CA3AF] transition hover:border-[#D0FF00]/30 hover:text-white"
            title="复制地址"
          >
            {copied ? <Check className="h-4 w-4 text-[#D0FF00]" /> : <Copy className="h-4 w-4" />}
          </button>
          <a
            href={`https://bscscan.com/address/${IDO_RECEIVER_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-[#25282C] bg-[#111215] p-2 text-[#9CA3AF] transition hover:border-[#2EDEDB]/30 hover:text-white"
            title="在 BscScan 查看"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-[#6B7280]">
          <span className="rounded bg-[#0A0B0D] px-2 py-1 font-mono">
            {shortIdoAddress(IDO_RECEIVER_ADDRESS)}
          </span>
          <span>链上地址，转账即参与，无需注册</span>
        </div>
      </div>

      {/* Actions */}
      <div className="kimi-card">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#25282C] bg-[#0A0B0D] px-4 py-3">
          <span className="text-sm text-[#9CA3AF]">本次转账</span>
          <span className="text-lg font-bold text-white">
            {amount} <span className="text-sm font-medium text-[#D0FF00]">BNB</span>
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleSend}
            disabled={sending}
            className="kimi-btn-primary flex-1"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !wallet.isConnected ? (
              <Wallet className="h-4 w-4" />
            ) : (
              <CircleDollarSign className="h-4 w-4" />
            )}
            {sending
              ? "转账中…"
              : !wallet.isConnected
                ? "连接钱包"
                : !wallet.isBSC
                  ? "切换到 BSC"
                  : `转账 ${amount} BNB`}
          </button>
          <button
            onClick={copyAddress}
            className="kimi-btn-secondary flex-1"
          >
            <Copy className="h-4 w-4" />
            复制地址手动转账
          </button>
        </div>

        {!wallet.isConnected && (
          <p className="mt-3 text-center text-xs text-[#6B7280]">
            也可以不连接钱包：复制收款地址，在任意钱包/交易所直接转账
          </p>
        )}
      </div>

      {/* 参与成功反馈 */}
      {result && (
        <div className="rounded-2xl border border-[#D0FF00]/30 bg-[#D0FF00]/5 p-5">
          <div className="flex items-center gap-2 text-[#D0FF00]">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-bold">参与成功 🎉</span>
          </div>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            已向收款地址转账{" "}
            <span className="font-bold text-white">{result.amount} BNB</span>
            ，交易已上链确认，认购记录已生成。
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#25282C] bg-[#0A0B0D] px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-[#2EDEDB]">
              {result.hash}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.hash);
                  showToast({ type: "success", message: "交易哈希已复制" });
                } catch {
                  /* ignore */
                }
              }}
              className="shrink-0 rounded-lg p-1 text-[#9CA3AF] transition hover:text-white"
              title="复制交易哈希"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href={`https://bscscan.com/tx/${result.hash}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-lg p-1 text-[#9CA3AF] transition hover:text-white"
              title="在 BscScan 查看交易"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-3 text-xs text-[#6B7280]">
            平台人工确认后将计入认购份额；上方进度条将在几秒内自动刷新。
          </p>
        </div>
      )}

      {/* Steps & warning */}
      <div className="kimi-card">
        <h3 className="mb-3 text-sm font-semibold text-white">参与步骤</h3>
        <ol className="space-y-2 text-sm text-[#9CA3AF]">
          <li>1. 选择认购金额（0.1 ~ 0.5 BNB，0.1 步进）</li>
          <li>2. 复制上方收款地址，务必在 BNB Smart Chain 网络发起转账</li>
          <li>3. 转出后保留交易哈希，平台人工确认后计入认购份额</li>
          <li>4. 软顶 {IDO_SOFT_CAP_BNB} BNB 达成即视为 IDO 成功，硬顶 {IDO_HARD_CAP_BNB} BNB 满额后停止接收</li>
        </ol>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FF6B6B]/20 bg-[#FF6B6B]/5 p-3 text-xs text-[#FF6B6B]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            本次为直接转账模式，资金直接进入收款地址，无智能合约托管与自动退款；
            请自行核对金额与地址，风险自担。
          </span>
        </div>
      </div>
    </div>
  );
}
