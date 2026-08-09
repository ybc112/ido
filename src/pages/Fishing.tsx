import { useCallback, useEffect, useRef, useState } from "react";
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Coins,
  Copy,
  Loader2,
  Wallet,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import {
  CANNON_LEVELS,
  FISH_TYPES,
  INITIAL_SCORE,
  checkCatch,
} from "@/game/fishConfig";
import { IDO_RECEIVER_ADDRESS, idoAmountToWei } from "@/lib/ido";

/* ───────── 游戏内部类型（每帧更新，不走 React state） ───────── */
interface GameFish {
  id: number;
  type: number; // FISH_TYPES 下标
  x: number;
  y: number;
  baseY: number;
  dir: 1 | -1;
  alive: boolean;
  flash: number; // 没捕到时的闪烁计数
  phase: number; // 游动相位
}

interface Bullet {
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  level: number;
  done: boolean;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const SCORE_KEY = "kimi-fishing-score";

function loadScore(): number {
  const raw = Number(localStorage.getItem(SCORE_KEY));
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : INITIAL_SCORE;
}

export default function Fishing() {
  const wallet = useWallet();
  const { showToast } = useAppStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 游戏状态（ref，避免每帧 setState）
  const fishRef = useRef<GameFish[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const cannonAngleRef = useRef(-Math.PI / 2);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const lastSpawnRef = useRef(0);

  // React 展示状态
  const [score, setScore] = useState(loadScore);
  const [cannonLevel, setCannonLevel] = useState(1);
  const [running, setRunning] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [depositSending, setDepositSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const scoreRef = useRef(score);
  useEffect(() => {
    scoreRef.current = score;
    localStorage.setItem(SCORE_KEY, String(score));
  }, [score]);

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

  /* ───────── 初始鱼群 ───────── */
  const initFish = useCallback(
    (w: number, h: number) => {
      fishRef.current = [];
      const count = Math.min(14, Math.floor(w / 70));
      for (let i = 0; i < count; i += 1) {
        const type = Math.floor(Math.random() * Math.min(FISH_TYPES.length, 10));
        const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
        fishRef.current.push({
          id: Math.random(),
          type,
          x: Math.random() * w,
          y: 40 + Math.random() * (h - 110),
          baseY: 0,
          dir,
          alive: true,
          flash: 0,
          phase: Math.random() * Math.PI * 2,
        });
      }
    },
    [],
  );

  /* ───────── 发射炮弹 ───────── */
  const fire = useCallback(
    (canvas: HTMLCanvasElement, level: number) => {
      if (scoreRef.current < level) {
        showToast({ type: "error", message: "分数不足，请先上分" });
        return;
      }
      const mouse = mouseRef.current;
      if (!mouse) return;
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      const ox = cw / 2;
      const oy = ch - 46;
      const dx = mouse.x - ox;
      const dy = mouse.y - oy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      bulletsRef.current.push({
        x: ox,
        y: oy,
        tx: mouse.x,
        ty: mouse.y,
        speed: Math.max(6, len / 30),
        level,
        done: false,
      });
      setScore((s) => s - level);
    },
    [showToast],
  );

  /* ───────── 捕鱼判定（与 Java 版一致） ───────── */
  const tryCatch = useCallback(
    (bullet: Bullet, w: number, h: number) => {
      for (const fish of fishRef.current) {
        if (!fish.alive) continue;
        const t = FISH_TYPES[fish.type];
        const dist = Math.hypot(fish.x - bullet.tx, fish.y - bullet.ty);
        if (dist > t.size + 14) continue;
        if (checkCatch(bullet.level, t.catchProbability)) {
          fish.alive = false;
          setScore((s) => s + t.worth);
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
      // 补鱼：保持鱼量
      const aliveCount = fishRef.current.filter((f) => f.alive).length;
      if (aliveCount < Math.min(10, Math.floor(w / 90))) {
        spawnFish(w, h);
      }
    },
    [spawnFish],
  );

  /* ───────── 主循环 ───────── */
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
      if (fishRef.current.length === 0) {
        initFish(rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      if (!runningFlag) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cw = canvas.width / (window.devicePixelRatio || 1);
      const ch = canvas.height / (window.devicePixelRatio || 1);

      // 背景
      ctx.fillStyle = "rgba(4,26,51,0.85)";
      ctx.fillRect(0, 0, cw, ch);
      // 海底光斑
      const grd = ctx.createRadialGradient(cw / 2, 0, 10, cw / 2, 0, cw * 0.7);
      grd.addColorStop(0, "rgba(79,209,229,0.10)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, ch);

      // 鱼
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
        // 身体
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, t.size, t.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        // 尾巴
        ctx.beginPath();
        ctx.moveTo(-t.size, 0);
        ctx.lineTo(-t.size * 1.6, -t.size * 0.5);
        ctx.lineTo(-t.size * 1.6, t.size * 0.5);
        ctx.closePath();
        ctx.fill();
        // 眼睛
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(t.size * 0.45, -t.size * 0.12, t.size * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#041a33";
        ctx.beginPath();
        ctx.arc(t.size * 0.5, -t.size * 0.12, t.size * 0.07, 0, Math.PI * 2);
        ctx.fill();
        // 分值标签（大鱼显示）
        if (t.worth >= 40) {
          ctx.fillStyle = "#ffe4a8";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${t.worth}`, 0, -t.size * 0.6);
        }
        ctx.restore();
      }

      // 炮弹
      for (const b of bulletsRef.current) {
        if (b.done) continue;
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const len = Math.hypot(dx, dy);
        if (len < b.speed) {
          b.done = true;
          tryCatch(b, cw, ch);
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

      // 炮台
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

      // 飘分
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

      // 补鱼定时
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
      fire(canvas, cannonLevel);
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
  }, [initFish, spawnFish, fire, tryCatch]);

  const handleDeposit = async () => {
    if (!wallet.isConnected || !wallet.signer) {
      await wallet.connectWallet();
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ type: "error", message: "请输入正确的上分金额" });
      return;
    }
    setDepositSending(true);
    try {
      const tx = await wallet.signer.sendTransaction({
        to: IDO_RECEIVER_ADDRESS,
        value: idoAmountToWei(amount),
      });
      await tx.wait();
      setDepositOpen(false);
      showToast({
        type: "success",
        message: `上分转账 ${amount} BNB 已确认，平台确认后到账，交易：${tx.hash.slice(0, 10)}...`,
      });
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "转账失败" });
    } finally {
      setDepositSending(false);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(IDO_RECEIVER_ADDRESS);
      setCopied(true);
      showToast({ type: "success", message: "收款地址已复制" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: "error", message: "复制失败" });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* 顶部状态条 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(10,48,84,0.55)] p-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[rgba(2,20,40,0.5)] px-3 py-2">
            <Coins className="h-4 w-4 text-[#ffe4a8]" />
            <span className="text-xs text-[#8fb9d6]">游戏分</span>
            <span className="text-sm font-bold text-[#ffe4a8]">{score}</span>
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
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDepositOpen(true)}
            className="kimi-btn-primary py-2 text-xs"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            上分
          </button>
          <button
            onClick={() =>
              showToast({
                type: "info",
                message: "下分请联系平台客服，出示游戏分与钱包地址",
              })
            }
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
          点击海面发射炮弹 · 炮档越高花费越高，捕到大鱼概率越大
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
              向收款地址转账，平台确认后到账（正式版接入合约自动入分）
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[rgba(2,20,40,0.5)] px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-[#7dd3fc]">
                {IDO_RECEIVER_ADDRESS}
              </code>
              <button
                onClick={copyAddress}
                className="shrink-0 text-[#b8dcef] hover:text-white"
              >
                {copied ? "✓" : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[#8fb9d6]">上分金额（BNB）</label>
              <input
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full rounded-xl border border-white/10 bg-[rgba(2,20,40,0.5)] px-3 py-2 text-sm text-white outline-none focus:border-[#4fd1e5]/50"
                placeholder="0.1"
              />
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
                disabled={depositSending}
                className="kimi-btn-primary flex-1 py-2 text-xs"
              >
                {depositSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : !wallet.isConnected ? (
                  <Wallet className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
                {depositSending
                  ? "转账中…"
                  : !wallet.isConnected
                    ? "连接钱包"
                    : "确认上分"}
              </button>
            </div>
            <p className="mt-3 text-[10px] text-[#6b93ad]">
              当前为演示模式：分数存本地浏览器。正式版将接入链上合约与后端结算（见导航「出海 IDO」的部署方式）。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
