import { useCallback, useEffect, useRef, useState } from "react";
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Coins,
  Loader2,
  Wallet,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import { CANNON_LEVELS, FISH_TYPES } from "@/game/fishConfig";
import {
  FISHING_BACKEND_URL,
  FISHING_GAME_TOKEN,
  FISHING_VAULT_ADDRESS,
  claimFromVault,
  depositToVault,
  fetchFishState,
  parseFishAmount,
} from "@/lib/fishVault";

/* ───────── 游戏内部类型（每帧更新，不走 React state） ───────── */
interface GameFish {
  id: number;
  type: number;
  x: number;
  y: number;
  baseY: number;
  dir: 1 | -1;
  alive: boolean;
  flash: number;
  phase: number;
}

interface ShootResult {
  fishId: string;
  caught: boolean;
}

interface Bullet {
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  level: number;
  done: boolean;
  results: ShootResult[];
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

export default function Fishing() {
  const wallet = useWallet();
  const { showToast } = useAppStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fishRef = useRef<GameFish[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const cannonAngleRef = useRef(-Math.PI / 2);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const lastSpawnRef = useRef(0);
  const lastShootRef = useRef(0);

  const [score, setScore] = useState(0n);
  const [cannonLevel, setCannonLevel] = useState(1);
  const [running, setRunning] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("1000");
  const [withdrawAmount, setWithdrawAmount] = useState("100");
  const [txPending, setTxPending] = useState(false);
  const [totalWon, setTotalWon] = useState(0n);
  const [totalBet, setTotalBet] = useState(0n);
  const [syncError, setSyncError] = useState(false);

  const scoreRef = useRef(score);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  /* ───────── 同步后端状态（5s 轮询） ───────── */
  const refreshState = useCallback(async () => {
    if (!wallet.account) return;
    const state = await fetchFishState(wallet.account);
    if (!state) {
      setSyncError(true);
      return;
    }
    setSyncError(false);
    setScore(state.balance);
    setTotalBet(state.totalBet);
    setTotalWon(state.totalWon);
  }, [wallet.account]);

  useEffect(() => {
    void refreshState();
    const timer = setInterval(() => void refreshState(), 5000);
    return () => clearInterval(timer);
  }, [refreshState]);

  /* ───────── 生成一条鱼 ───────── */
  const spawnFish = useCallback((w: number, h: number) => {
    const type = Math.floor(Math.random() * FISH_TYPES.length);
    const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
    const x = dir === 1 ? -40 : w + 40;
    const baseY = 40 + Math.random() * (h - 110);
    fishRef.current.push({
      id: Math.random(),
      type,
      x,
      y: baseY,
      baseY,
      dir,
      alive: true,
      flash: 0,
      phase: Math.random() * Math.PI * 2,
    });
  }, []);

  const initFish = useCallback((w: number, h: number) => {
    fishRef.current = [];
    for (let i = 0; i < Math.min(14, Math.floor(w / 70)); i += 1) {
      const type = Math.floor(Math.random() * Math.min(FISH_TYPES.length, 10));
      fishRef.current.push({
        id: Math.random(),
        type,
        x: Math.random() * w,
        y: 40 + Math.random() * (h - 110),
        baseY: 0,
        dir: Math.random() > 0.5 ? 1 : -1,
        alive: true,
        flash: 0,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  /* ───────── 开炮：服务端权威判定 ───────── */
  const fire = useCallback(
    async (canvas: HTMLCanvasElement, level: number) => {
      if (!wallet.account) {
        showToast({ type: "error", message: "请先连接钱包再开始捕鱼" });
        return;
      }
      // 限频：至少 500ms 一炮
      const now = performance.now();
      if (now - lastShootRef.current < 500) return;
      lastShootRef.current = now;

      const mouse = mouseRef.current;
      if (!mouse) return;
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      const ox = cw / 2;
      const oy = ch - 46;

      // 收集炮弹命中半径内的鱼作为判定目标
      const targets: { fishId: string; type: number }[] = [];
      for (const fish of fishRef.current) {
        if (!fish.alive) continue;
        const t = FISH_TYPES[fish.type];
        if (Math.hypot(fish.x - mouse.x, fish.y - mouse.y) <= t.size + 14) {
          targets.push({ fishId: String(fish.id), type: t.id });
        }
      }
      if (targets.length === 0) return;

      try {
        const res = await fetch(`${FISHING_BACKEND_URL}/api/fishing/shoot`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ player: wallet.account, cannonLevel: level, targets }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast({ type: "error", message: data.error || "开炮失败" });
          return;
        }
        // 服务端已扣分/加分，同步余额
        setScore(BigInt(data.balance ?? 0));
        // 播放炮弹动画（到达时应用结果）
        const dx = mouse.x - ox;
        const dy = mouse.y - oy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        bulletsRef.current.push({
          x: ox,
          y: oy,
          tx: mouse.x,
          ty: mouse.y,
          speed: Math.max(8, len / 24),
          level,
          done: false,
          results: data.results ?? [],
        });
        if (Number(data.won) > 0) {
          popupsRef.current.push({
            x: mouse.x,
            y: mouse.y - 20,
            text: `+${data.won}`,
            color: "#ffe4a8",
            life: 50,
          });
        }
      } catch {
        showToast({ type: "error", message: "结算服务连接失败，请稍后再试" });
      }
    },
    [wallet.account, showToast],
  );

  /* ───────── 应用服务端判定结果 ───────── */
  const applyResults = useCallback((bullet: Bullet) => {
    for (const r of bullet.results) {
      const fish = fishRef.current.find((f) => String(f.id) === r.fishId);
      if (!fish || !fish.alive) continue;
      const t = FISH_TYPES[fish.type];
      if (r.caught) {
        fish.alive = false;
        popupsRef.current.push({
          x: fish.x,
          y: fish.y,
          text: `+${t.worth}`,
          color: "#ffe4a8",
          life: 60,
        });
      } else {
        fish.flash = 12;
      }
    }
  }, []);

  /* ───────── 主循环（渲染层，判定全在服务端） ───────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let runningFlag = true;
    setRunning(true);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (fishRef.current.length === 0) initFish(rect.width, rect.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      if (!runningFlag) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cw = canvas.width / (window.devicePixelRatio || 1);
      const ch = canvas.height / (window.devicePixelRatio || 1);

      ctx.fillStyle = "rgba(4,26,51,0.85)";
      ctx.fillRect(0, 0, cw, ch);
      const grd = ctx.createRadialGradient(cw / 2, 0, 10, cw / 2, 0, cw * 0.7);
      grd.addColorStop(0, "rgba(79,209,229,0.10)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, ch);

      for (const fish of fishRef.current) {
        if (!fish.alive) continue;
        const t = FISH_TYPES[fish.type];
        fish.phase += dt * 2;
        fish.x += fish.dir * t.speed * dt * 1.6;
        fish.y = fish.baseY + Math.sin(fish.phase) * 14;
        if (fish.x > cw + 60 || fish.x < -60) {
          fish.alive = false;
          continue;
        }
        if (fish.flash > 0) fish.flash -= 1;
        const alpha = fish.flash > 0 ? 0.35 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(fish.x, fish.y);
        ctx.scale(fish.dir, 1);
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, t.size, t.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-t.size, 0);
        ctx.lineTo(-t.size * 1.6, -t.size * 0.5);
        ctx.lineTo(-t.size * 1.6, t.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(t.size * 0.45, -t.size * 0.12, t.size * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#041a33";
        ctx.beginPath();
        ctx.arc(t.size * 0.5, -t.size * 0.12, t.size * 0.07, 0, Math.PI * 2);
        ctx.fill();
        if (t.worth >= 40) {
          ctx.fillStyle = "#ffe4a8";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${t.worth}`, 0, -t.size * 0.6);
        }
        ctx.restore();
      }

      for (const b of bulletsRef.current) {
        if (b.done) continue;
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const len = Math.hypot(dx, dy);
        if (len < b.speed) {
          b.done = true;
          applyResults(b);
          continue;
        }
        b.x += (dx / len) * b.speed;
        b.y += (dy / len) * b.speed;
        ctx.fillStyle = "#ffe4a8";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4 + b.level, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,228,168,0.4)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 9 + b.level, 0, Math.PI * 2);
        ctx.fill();
      }
      bulletsRef.current = bulletsRef.current.filter((b) => !b.done);

      const ox = cw / 2;
      const oy = ch - 46;
      if (mouseRef.current) {
        cannonAngleRef.current = Math.atan2(mouseRef.current.y - oy, mouseRef.current.x - ox);
      }
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(cannonAngleRef.current);
      ctx.fillStyle = "#0e6e9c";
      ctx.fillRect(0, -12, 46, 24);
      ctx.fillStyle = "#4fd1e5";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#041a33";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${cannonLevel}`, 0, 4);
      ctx.restore();

      for (const p of popupsRef.current) {
        p.y -= 1;
        p.life -= 1;
        ctx.globalAlpha = Math.min(1, p.life / 20);
        ctx.fillStyle = p.color;
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
      }
      popupsRef.current = popupsRef.current.filter((p) => p.life > 0);

      if (now - lastSpawnRef.current > 2500) {
        lastSpawnRef.current = now;
        const aliveCount = fishRef.current.filter((f) => f.alive).length;
        if (aliveCount < 12) spawnFish(cw, ch);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      void fire(canvas, cannonLevel);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);

    return () => {
      runningFlag = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initFish, spawnFish, fire, applyResults]);

  /* ───────── 上分（approve + deposit 合约） ───────── */
  const handleDeposit = async () => {
    if (!wallet.isConnected || !wallet.signer) {
      await wallet.connectWallet();
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }
    if (!FISHING_VAULT_ADDRESS) {
      showToast({ type: "error", message: "金库合约未配置" });
      return;
    }
    const amount = parseFishAmount(depositAmount);
    if (amount <= 0n) {
      showToast({ type: "error", message: "请输入正确的上分数量" });
      return;
    }
    setTxPending(true);
    try {
      const hash = await depositToVault(wallet.signer, amount);
      setDepositOpen(false);
      showToast({ type: "success", message: `上分 ${depositAmount} CAPY 已入金库，${hash.slice(0, 10)}...` });
      // 后端 30s 内监听到账，前端轮询同步
      setTimeout(() => void refreshState(), 8000);
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "上分失败" });
    } finally {
      setTxPending(false);
    }
  };

  /* ───────── 下分（后端签名 + 合约兑现） ───────── */
  const handleWithdraw = async () => {
    if (!wallet.isConnected || !wallet.signer) {
      await wallet.connectWallet();
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }
    const amount = parseFishAmount(withdrawAmount);
    if (amount <= 0n) {
      showToast({ type: "error", message: "请输入正确的下分数量" });
      return;
    }
    setTxPending(true);
    try {
      const res = await fetch(`${FISHING_BACKEND_URL}/api/fishing/withdraw-request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ player: wallet.account, amount: amount.toString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ type: "error", message: data.error || "下分申请失败" });
        return;
      }
      const hash = await claimFromVault(
        wallet.signer,
        BigInt(data.amount),
        BigInt(data.nonce),
        Number(data.deadline),
        data.signature,
      );
      setWithdrawOpen(false);
      showToast({ type: "success", message: `下分 ${withdrawAmount} CAPY 已到账，${hash.slice(0, 10)}...` });
      void refreshState();
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "下分失败" });
    } finally {
      setTxPending(false);
    }
  };

  const formatAmount = (v: bigint) => Number(v) / 1e18 >= 1 ? (Number(v) / 1e18).toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : (Number(v) / 1e18).toFixed(4);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* 顶部状态条 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(10,48,84,0.55)] p-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[rgba(2,20,40,0.5)] px-3 py-2">
            <Coins className="h-4 w-4 text-[#ffe4a8]" />
            <span className="text-xs text-[#8fb9d6]">游戏分</span>
            <span className="text-sm font-bold text-[#ffe4a8]">{formatAmount(score)}</span>
            {syncError && (
              <span className="rounded bg-[#FF6B6B]/20 px-1.5 py-0.5 text-[10px] text-[#FF6B6B]">
                连接中
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCannonLevel((l) => Math.max(1, l - 1))}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[#b8dcef] hover:text-white"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[70px] rounded-lg border border-[#4fd1e5]/30 bg-[#4fd1e5]/10 px-2 py-1 text-center text-sm font-bold text-[#7dd3fc]">
              炮 {cannonLevel} 分/炮
            </span>
            <button
              onClick={() => setCannonLevel((l) => Math.min(CANNON_LEVELS.length, l + 1))}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[#b8dcef] hover:text-white"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
          {wallet.isConnected && (
            <span className="hidden text-[10px] text-[#6b93ad] sm:inline">
              投入 {formatAmount(totalBet)} · 赢回 {formatAmount(totalWon)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!wallet.isConnected ? (
            <button onClick={wallet.connectWallet} className="kimi-btn-primary py-2 text-xs">
              <Wallet className="h-3.5 w-3.5" />
              连接钱包
            </button>
          ) : (
            <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-[#b8dcef]">
              {shortAddress(wallet.account || "")}
            </span>
          )}
          <button
            onClick={() => setDepositOpen(true)}
            disabled={!wallet.isConnected || txPending}
            className="kimi-btn-primary py-2 text-xs"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            上分
          </button>
          <button
            onClick={() => setWithdrawOpen(true)}
            disabled={!wallet.isConnected || txPending}
            className="kimi-btn-secondary py-2 text-xs"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            下分
          </button>
        </div>
      </div>

      {/* 游戏画布 */}
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_40px_rgba(2,20,40,0.5)]"
        style={{ height: "min(62vh, 560px)" }}
      >
        <canvas ref={canvasRef} className="block w-full cursor-crosshair" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-[rgba(2,20,40,0.6)] px-2 py-1 text-[10px] text-[#8fb9d6]">
          点击海面发射炮弹 · 判定与赔率在服务端执行
        </div>
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(4,26,51,0.6)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#4fd1e5]" />
          </div>
        )}
      </div>

      {/* 鱼类图鉴 */}
      <div className="rounded-2xl border border-white/10 bg-[rgba(10,48,84,0.55)] p-4 backdrop-blur-md">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Anchor className="h-4 w-4 text-[#4fd1e5]" />
          深海图鉴
          <span className="text-xs font-normal text-[#8fb9d6]">
            分值越高越稀有，捕到概率越低
          </span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {FISH_TYPES.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[rgba(2,20,40,0.5)] px-2.5 py-1 text-xs text-[#b8dcef]"
            >
              <span>{t.emoji}</span>
              <span className="font-bold text-[#ffe4a8]">{t.worth}</span>
              <span className="text-[#6b93ad]">分</span>
            </span>
          ))}
        </div>
      </div>

      {/* 上分弹窗 */}
      {depositOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(8,40,70,0.96)] p-5 backdrop-blur-md">
            <h3 className="text-base font-bold text-white">上分</h3>
            <p className="mt-1 text-xs text-[#8fb9d6]">
              代币存入金库合约，后端监听到账后自动加游戏分
            </p>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[#8fb9d6]">上分数量（CAPY）</label>
              <input
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full rounded-xl border border-white/10 bg-[rgba(2,20,40,0.5)] px-3 py-2 text-sm text-white outline-none focus:border-[#4fd1e5]/50"
                placeholder="1000"
              />
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-[#6b93ad]">
              金库合约：{FISHING_VAULT_ADDRESS ? FISHING_VAULT_ADDRESS.slice(0, 10) + "..." : "未配置"}
              <br />
              代币：{FISHING_GAME_TOKEN.slice(0, 10)}...（CAPY）
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDepositOpen(false)}
                className="kimi-btn-secondary flex-1 py-2 text-xs"
              >
                取消
              </button>
              <button
                onClick={handleDeposit}
                disabled={txPending || !FISHING_VAULT_ADDRESS}
                className="kimi-btn-primary flex-1 py-2 text-xs"
              >
                {txPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                {txPending ? "处理中…" : "确认上分"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 下分弹窗 */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(8,40,70,0.96)] p-5 backdrop-blur-md">
            <h3 className="text-base font-bold text-white">下分</h3>
            <p className="mt-1 text-xs text-[#8fb9d6]">
              当前游戏分 {formatAmount(score)}，后端验证后签名，从金库领回代币
            </p>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[#8fb9d6]">下分数量（CAPY）</label>
              <input
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full rounded-xl border border-white/10 bg-[rgba(2,20,40,0.5)] px-3 py-2 text-sm text-white outline-none focus:border-[#4fd1e5]/50"
                placeholder="100"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setWithdrawOpen(false)}
                className="kimi-btn-secondary flex-1 py-2 text-xs"
              >
                取消
              </button>
              <button
                onClick={handleWithdraw}
                disabled={txPending}
                className="kimi-btn-primary flex-1 py-2 text-xs"
              >
                {txPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDown className="h-3.5 w-3.5" />}
                {txPending ? "处理中…" : "确认下分"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
