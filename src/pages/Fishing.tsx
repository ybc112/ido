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
import { ATLAS_URLS, CANNON_LEVELS, FISH_TYPES, type FishType } from "@/game/fishConfig";
import {
  FISHING_BACKEND_URL,
  FISHING_GAME_TOKEN,
  FISHING_VAULT_ADDRESS,
  claimFromVault,
  depositToVault,
  fetchFishState,
  parseFishAmount,
} from "@/lib/fishVault";

/* ═══════════════ 原版鱼群算法移植（FishRunThread / PathManager / ShoalManager） ═══════════════
 *  - 路径：[[模式, 长度], ...]，模式 0=转弯(长度=度数) 1=直走(长度=像素)，默认 4 段
 *  - 转弯：每帧 currentRotate ±1°，x += speed*cos，y -= speed*sin（原版 y = +sin*-1）
 *  - 直走：水平方向 ±speed（新鱼先直走入屏）
 *  - 鱼群：跟随鱼位置 = 领头鱼位置 - 偏移，旋转 = -领头鱼旋转
 *  - 帧动画：actSpeed ms 换一帧
 */
const ON_DRAW_SLEEP = 40; // 原版帧间隔 ms
const PATH_MODE_ROTATE = 0;
const PATH_MODE_STRAIGHT = 1;
// 原版 fishrunSpeed = speed / ON_DRAW_SLEEP 每帧(25fps) → 换算成每秒像素
const pxPerSec = (speed: number) => (speed / ON_DRAW_SLEEP) * (1000 / ON_DRAW_SLEEP);

interface GameFish {
  id: number;
  type: FishType;
  x: number;
  y: number;
  baseY: number;
  dir: 1 | -1;
  alive: boolean;
  flash: number;
  // ── 原版移动状态 ──
  currentRotate: number;
  isNew: boolean;
  fromPoint: number; // 0 左上 1 左下 2 右上 3 右下
  path: number[][];
  pathIndex: number;
  pathRemain: number;
  // ── 帧动画 ──
  frameIdx: number;
  frameTimer: number;
  // ── 鱼群 ──
  isHead: boolean;
  headId: number;
  offsetX: number;
  offsetY: number;
  active: boolean; // 参与游动的鱼
  // ── 捕获动画（原版 onCatched 播放 catch 动作后再消失） ──
  caught: boolean;
  catchTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  level: number;
  done: boolean;
  results: { fishId: string; caught: boolean }[];
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

let fishSeq = 1;

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

/** 原版 PathManager.getDefaultPath */
function buildPath(type: FishType, w: number, h: number, fromPoint: number): number[][] {
  if (type.maxRotate === 0) {
    return [[PATH_MODE_STRAIGHT, w * 2]];
  }
  const path: number[][] = [];
  let i = 0;
  // 从屏幕外进入：先直走一段
  if (fromPoint <= 1) {
    path.push([PATH_MODE_STRAIGHT, Math.floor(Math.random() * w) + 1]);
    i = 1;
  }
  for (; i < 4; i++) {
    if (Math.random() > 0.5) {
      if (i > 0 && path[i - 1][0] === PATH_MODE_STRAIGHT) {
        path.push([PATH_MODE_ROTATE, 45 + Math.floor(Math.random() * Math.max(1, type.maxRotate - 45)) + 1]);
      } else {
        path.push([PATH_MODE_STRAIGHT, 30 + Math.floor(Math.random() * (h / 2)) + 1]);
      }
    } else {
      if (i > 0 && path[i - 1][0] === PATH_MODE_ROTATE) {
        path.push([PATH_MODE_STRAIGHT, 30 + Math.floor(Math.random() * (h / 2)) + 1]);
      } else {
        path.push([PATH_MODE_ROTATE, 45 + Math.floor(Math.random() * Math.max(1, type.maxRotate - 45)) + 1]);
      }
    }
  }
  return path;
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
  const atlasImgRef = useRef<Record<string, HTMLImageElement>>({});

  const [score, setScore] = useState(0n);
  const [cannonLevel, setCannonLevel] = useState(1);
  const [running, setRunning] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
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

  /* ───────── 加载原版图集图片 ───────── */
  useEffect(() => {
    let active = true;
    const imgs: Record<string, HTMLImageElement> = {};
    const entries = Object.entries(ATLAS_URLS);
    let loaded = 0;
    for (const [name, url] of entries) {
      const img = new Image();
      img.onload = () => {
        loaded += 1;
        if (active && loaded === entries.length) {
          atlasImgRef.current = imgs;
          setAssetsReady(true);
        }
      };
      img.onerror = () => {
        loaded += 1;
        if (active && loaded === entries.length) {
          atlasImgRef.current = imgs;
          setAssetsReady(true);
        }
      };
      img.src = url;
      imgs[name] = img;
    }
    return () => {
      active = false;
    };
  }, []);

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

  /* ───────── 按概率选鱼（原版 birthHeadFish 的 showProbability） ───────── */
  const pickFishType = useCallback((): FishType => {
    // part1 概率: 前4种鱼各10%, 其余各5% → 映射为权重
    const weights = FISH_TYPES.map((_, i) => (i < 4 ? 10 : 5));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return FISH_TYPES[i];
    }
    return FISH_TYPES[0];
  }, []);

  /* ───────── 创建一条领头鱼（原版 ShoalManager.createShoal + birthHeadFish） ───────── */
  const spawnShoal = useCallback((w: number, h: number) => {
    const type = pickFishType();
    const fromPoint = Math.floor(Math.random() * 4);
    const dir: 1 | -1 = fromPoint <= 1 ? 1 : -1;
    const baseY = h * 0.15 + Math.random() * h * 0.6;
    const x = fromPoint <= 1 ? -60 : w + 60;

    const head: GameFish = {
      id: fishSeq++,
      type,
      x,
      y: baseY,
      baseY,
      dir,
      alive: true,
      flash: 0,
      currentRotate: 0,
      isNew: true,
      fromPoint,
      path: buildPath(type, w, h, fromPoint),
      pathIndex: 0,
      pathRemain: 0,
      frameIdx: 0,
      frameTimer: 0,
      isHead: true,
      headId: 0,
      offsetX: 0,
      offsetY: 0,
      active: true,
      caught: false,
      catchTimer: 0,
    };
    fishRef.current.push(head);

    // 鱼群（原版 createShoal: sum = random*fishShoalMax + 1）
    const sum = type.fishShoalMax > 0 ? Math.floor(Math.random() * type.fishShoalMax) + 1 : 0;
    for (let i = 0; i < sum; i++) {
      const f: GameFish = {
        id: fishSeq++,
        type,
        x: fromPoint <= 1 ? -60 - (i + 1) * 40 : w + 60 + (i + 1) * 40,
        y: baseY + (Math.random() * 2 - 1) * 60,
        baseY,
        dir,
        alive: true,
        flash: 0,
        currentRotate: 0,
        isNew: true,
        fromPoint,
        path: [],
        pathIndex: 0,
        pathRemain: 0,
        frameIdx: 0,
        frameTimer: 0,
        isHead: false,
        headId: head.id,
        offsetX: 0,
        offsetY: 0,
        active: true,
        caught: false,
        catchTimer: 0,
      };
      fishRef.current.push(f);
    }
  }, [pickFishType]);

  /* ───────── 移动：照搬 FishRunThread.fishRun / goStraight / moveShoal ───────── */
  const moveHead = useCallback((head: GameFish, dt: number) => {
    const type = head.type;
    const speedPx = pxPerSec(type.speed) * dt;
    if (head.isNew) {
      // 新鱼先直走入屏（原版 goStraight 的 isNew 分支）
      head.isNew = false;
      head.x += (head.fromPoint <= 1 ? speedPx : -speedPx);
      return;
    }
    // 消费当前路径段
    if (head.pathRemain <= 0) {
      if (head.pathIndex >= head.path.length) {
        head.path = buildPath(type, innerW(), innerH(), head.fromPoint);
        head.pathIndex = 0;
      }
      const seg = head.path[head.pathIndex];
      head.pathRemain = seg[1];
      head.pathIndex += 1;
    }
    const seg = head.path[head.pathIndex - 1];
    if (seg[0] === PATH_MODE_ROTATE) {
      // 转弯：决定左转/右转（原版按所在象限 + 当前角度选方向）
      let mode = 1;
      const r = head.currentRotate;
      if (head.x <= innerW() / 2) {
        if (r >= -90 && r <= 90) mode = 1;
        else mode = -1;
      } else {
        if ((r >= 90 && r <= 270) || (r <= -90 && r >= -270)) mode = -1;
        else mode = 1;
      }
      head.currentRotate += mode;
      const rad = (head.currentRotate * Math.PI) / 180;
      head.x += speedPx * Math.cos(rad);
      head.y -= speedPx * Math.sin(rad);
    } else {
      head.x += (head.fromPoint <= 1 ? speedPx : -speedPx);
    }
    head.pathRemain -= 1;
  }, []);

  /* ───────── 跟随鱼：位置 = 领头鱼 - 偏移，旋转 = -领头鱼旋转（原版 moveShoal） ───────── */
  const moveFollower = useCallback((fish: GameFish, head: GameFish) => {
    fish.x = head.x - fish.offsetX;
    fish.y = head.y - fish.offsetY;
    fish.currentRotate = -head.currentRotate;
  }, []);

  // 简化屏幕尺寸访问
  let innerW = () => 800;
  let innerH = () => 500;
  const sizeRef = useRef({ w: 800, h: 500 });
  innerW = () => sizeRef.current.w;
  innerH = () => sizeRef.current.h;

  /* ───────── 开炮：服务端权威判定 ───────── */
  const fire = useCallback(
    async (canvas: HTMLCanvasElement, level: number) => {
      if (!wallet.account) {
        showToast({ type: "error", message: "请先连接钱包再开始捕鱼" });
        return;
      }
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

      const targets: { fishId: string; type: number }[] = [];
      for (const fish of fishRef.current) {
        if (!fish.alive || !fish.active) continue;
        const t = fish.type;
        const size = t.frames[0] ? Math.max(t.frames[0].w, 20) : 20;
        if (Math.hypot(fish.x - mouse.x, fish.y - mouse.y) <= size + 16) {
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
        setScore(BigInt(data.balance ?? 0));
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

  const applyResults = useCallback((bullet: Bullet) => {
    for (const r of bullet.results) {
      const fish = fishRef.current.find((f) => String(f.id) === r.fishId);
      if (!fish || !fish.alive) continue;
      if (r.caught) {
        fish.caught = true;
        fish.catchTimer = 0;
        fish.active = false;
        popupsRef.current.push({
          x: fish.x,
          y: fish.y,
          text: `+${fish.type.worth}`,
          color: "#ffe4a8",
          life: 60,
        });
      } else {
        fish.flash = 12;
      }
    }
  }, []);

  /* ───────── 绘制一条鱼（原版图集裁切 + 帧动画 + 旋转） ───────── */
  const drawFish = useCallback((ctx: CanvasRenderingContext2D, fish: GameFish) => {
    const t = fish.type;
    const frames = fish.caught ? t.catchFrames : t.frames;
    const img = frames[0] ? atlasImgRef.current[frames[0].atlas] : undefined;
    const alpha = fish.flash > 0 ? 0.35 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(fish.x, fish.y);
    // 原版：跟随鱼绕自身旋转点旋转 -currentRotate；领头鱼旋转 currentRotate
    const rot = fish.isHead ? fish.currentRotate : fish.currentRotate;
    if (rot !== 0) {
      ctx.rotate((rot * Math.PI) / 180);
    }

    if (img && frames.length > 0) {
      const frame = frames[fish.frameIdx % frames.length];
      ctx.drawImage(
        img,
        frame.x, frame.y, frame.w, frame.h,
        -frame.w / 2 + frame.ox, -frame.h / 2 + frame.oy,
        frame.w, frame.h,
      );
    } else {
      // 图片未加载时兜底：占位鱼
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(6, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, []);

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
      sizeRef.current = { w: rect.width, h: rect.height };
      if (fishRef.current.length === 0) {
        for (let i = 0; i < 6; i++) spawnShoal(rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      if (!runningFlag) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cw = sizeRef.current.w;
      const ch = sizeRef.current.h;

      ctx.fillStyle = "rgba(4,26,51,0.85)";
      ctx.fillRect(0, 0, cw, ch);
      const grd = ctx.createRadialGradient(cw / 2, 0, 10, cw / 2, 0, cw * 0.7);
      grd.addColorStop(0, "rgba(79,209,229,0.10)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, ch);

      // 移动 + 帧动画
      const heads = fishRef.current.filter((f) => f.isHead && f.alive && f.active);
      for (const head of heads) {
        moveHead(head, dt);
        // 跟随鱼
        for (const f of fishRef.current) {
          if (f.alive && f.active && !f.isHead && f.headId === head.id) {
            moveFollower(f, head);
          }
        }
      }
      for (const fish of fishRef.current) {
        if (!fish.alive) continue;
        if (fish.caught) {
          // 捕获动画：播放 catchFrames 后消失（原版 onCatched）
          fish.catchTimer += dt * 1000;
          const total = Math.max(1, fish.type.catchFrames.length) * 90;
          if (fish.catchTimer >= total) {
            fish.alive = false;
            continue;
          }
          fish.frameIdx = Math.min(
            Math.floor(fish.catchTimer / 90),
            Math.max(1, fish.type.catchFrames.length) - 1,
          );
          continue;
        }
        fish.frameTimer += dt * 1000;
        if (fish.frameTimer >= fish.type.actSpeed) {
          fish.frameTimer = 0;
          fish.frameIdx = (fish.frameIdx + 1) % Math.max(1, fish.type.frames.length);
        }
        if (fish.flash > 0) fish.flash -= 1;
        // 出屏清理
        if (fish.x < -200 || fish.x > cw + 200 || fish.y < -200 || fish.y > ch + 200) {
          fish.alive = false;
          fish.active = false;
        }
      }
      fishRef.current = fishRef.current.filter((f) => f.alive);

      // 绘制鱼
      for (const fish of fishRef.current) {
        drawFish(ctx, fish);
      }

      // 炮弹
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

      // 定时生成鱼群
      if (now - lastSpawnRef.current > 2000) {
        lastSpawnRef.current = now;
        if (fishRef.current.filter((f) => f.active).length < 14) {
          spawnShoal(cw, ch);
        }
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
  }, [spawnShoal, fire, applyResults, moveHead, moveFollower, drawFish]);

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
        {(!running || !assetsReady) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[rgba(4,26,51,0.6)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#4fd1e5]" />
            <span className="text-xs text-[#8fb9d6]">原版鱼群资源加载中…</span>
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
