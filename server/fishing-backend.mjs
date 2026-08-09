// 出海捕鱼后端（独立进程）
//
// 参考 capy-game-backend 的经验：
//  - 独立进程 + 独立端口，和 kimi/kapi/capy 互不影响
//  - RPC 多节点故障转移，主 RPC 用实测稳定的 rpc-bsc.48.club
//  - 服务端权威结算：捕鱼判定/赔率在服务端跑，客户端只是渲染
//  - 下分签名：玩家游戏分充足才签名，合约验签兑现（防改前端/后端刷分）
//  - 状态落盘，重启不丢
//
// 环境变量（放 .env 或 pm2 env）：
//   FISHING_BACKEND_PORT      监听端口，默认 8800
//   FISHING_VAULT_ADDRESS     FishGameVault 合约地址
//   FISHING_SIGNER_PRIVATE_KEY 签名钱包私钥（必须是合约 signer() 那个地址）
//   FISHING_GAME_TOKEN        游戏代币地址（默认 CAPY）
//   FISHING_RPC_URL           BSC RPC（默认 rpc-bsc.48.club）
//   FISHING_START_BLOCK       事件监听起始块
//   FISHING_RTP               目标返还率（默认 0.4 = 40%）
//   FISHING_MIN_WITHDRAW      最小下分（默认 10 代币）
//   FISHING_STATE_PATH        状态落盘路径

import "dotenv/config";

import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs";
import {
  Contract,
  FallbackProvider,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isAddress,
  keccak256,
  AbiCoder,
  getBytes,
  id,
} from "ethers";

const PORT = Number(process.env.FISHING_BACKEND_PORT || 8800);
const CHAIN_ID = Number(process.env.FISHING_CHAIN_ID || 56);
const VAULT = String(process.env.FISHING_VAULT_ADDRESS || "").trim();
const TOKEN = String(process.env.FISHING_GAME_TOKEN || "").trim() || "0x839578f40b9a79a3fe891dd96079f3083e6e7777"; // CAPY
const SIGNER_KEY = process.env.FISHING_SIGNER_PRIVATE_KEY || "";
const RTP = Number(process.env.FISHING_RTP ?? 0.4);
const MIN_WITHDRAW = BigInt(process.env.FISHING_MIN_WITHDRAW ?? "10");
const RATE_WINDOW_MS = Number(process.env.FISHING_RATE_WINDOW_MS || 60_000);
const RATE_MAX = Number(process.env.FISHING_RATE_LIMIT || 300);
const START_BLOCK = Number(process.env.FISHING_START_BLOCK || 0);
const STATE_PATH = path.resolve(
  process.env.FISHING_STATE_PATH || path.join(process.cwd(), "work", "fishing-state.json"),
);

if (!isAddress(VAULT)) throw new Error("缺少 FISHING_VAULT_ADDRESS");
if (!SIGNER_KEY) throw new Error("缺少 FISHING_SIGNER_PRIVATE_KEY");

/* ───────── 合约 ABI ───────── */
const VAULT_ABI = [
  "function nonces(address) view returns (uint256)",
  "function deposited(address) view returns (uint256)",
  "function claimed(address) view returns (uint256)",
  "function signer() view returns (address)",
  "function paused() view returns (bool)",
  "function poolBalance() view returns (uint256)",
  "event Deposited(address indexed player, uint256 amount, uint256 totalDeposited)",
  "event Claimed(address indexed player, uint256 amount, uint256 nonce)",
];

/* ───────── RPC（48.club 优先，实测最稳；publicnode/blastapi 兜底） ───────── */
const RPC_URL = String(process.env.FISHING_RPC_URL || "https://rpc-bsc.48.club").trim();
const RPC_FALLBACKS = [
  "https://rpc-bsc.48.club",
  "https://bsc-rpc.publicnode.com",
  "https://bsc-mainnet.public.blastapi.io",
  "https://bsc-dataseed.binance.org/",
];
const RPC_LIST = (() => {
  const primary = RPC_URL.split(",").map((x) => x.trim()).filter(Boolean);
  const seen = new Set(primary);
  return [...primary, ...RPC_FALLBACKS.filter((u) => !seen.has(u))];
})();
const provider = new FallbackProvider(
  RPC_LIST.map((url, i) => ({
    provider: new JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true }),
    priority: i + 1,
    stallTimeout: 4000,
    weight: 1,
  })),
  CHAIN_ID,
  { quorum: 1 },
);
const signerWallet = new Wallet(SIGNER_KEY);
const vault = new Contract(getAddress(VAULT), VAULT_ABI, provider);

/* ───────── 鱼类配置（与前端 fishConfig.ts 一致） ───────── */
const FISH_CONFIG = [
  { id: 1, worth: 2, prob: 400 },
  { id: 2, worth: 8, prob: 250 },
  { id: 3, worth: 4, prob: 150 },
  { id: 4, worth: 15, prob: 20 },
  { id: 5, worth: 10, prob: 190 },
  { id: 6, worth: 12, prob: 120 },
  { id: 7, worth: 15, prob: 100 },
  { id: 8, worth: 40, prob: 80 },
  { id: 9, worth: 50, prob: 70 },
  { id: 10, worth: 60, prob: 40 },
  { id: 11, worth: 120, prob: 10 },
  { id: 12, worth: 120, prob: 10 },
  { id: 13, worth: 100, prob: 15 },
  { id: 14, worth: 70, prob: 20 },
  { id: 15, worth: 80, prob: 20 },
  { id: 16, worth: 150, prob: 5 },
  { id: 17, worth: 90, prob: 30 },
];

/* ───────── 状态账本（服务端权威） ───────── */
const players = new Map(); // addr -> { balance, totalBet, totalWon, withdrawn }
let saveTimer = null;

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    for (const [addr, rec] of Object.entries(raw.players || {})) {
      players.set(getAddress(addr), {
        balance: BigInt(rec.balance ?? 0),
        totalBet: BigInt(rec.totalBet ?? 0),
        totalWon: BigInt(rec.totalWon ?? 0),
        withdrawn: BigInt(rec.withdrawn ?? 0),
      });
    }
    console.log(`[fishing] 已恢复 ${players.size} 个玩家账本`);
  } catch {
    /* 首次运行 */
  }
}

function persist() {
  const out = {
    savedAt: Date.now(),
    players: {},
  };
  for (const [addr, rec] of players) {
    out.players[addr] = {
      balance: rec.balance.toString(),
      totalBet: rec.totalBet.toString(),
      totalWon: rec.totalWon.toString(),
      withdrawn: rec.withdrawn.toString(),
    };
  }
  const tmp = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
  fs.renameSync(tmp, STATE_PATH);
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      persist();
    } catch (e) {
      console.error("[fishing] 落盘失败:", e.message);
    }
  }, 800);
}

function playerOf(addr) {
  const a = getAddress(addr);
  if (!players.has(a)) {
    players.set(a, { balance: 0n, totalBet: 0n, totalWon: 0n, withdrawn: 0n });
  }
  return players.get(a);
}

/* ───────── 捕鱼判定（与 Java 版 checkCatch 一致） ───────── */
function checkCatch(cannonLevel, prob) {
  const probability = cannonLevel * 10 + prob;
  return Math.random() * 1000 + 1 <= probability;
}

/** RTP 调节器：长期把返还率拉回目标值（默认 40%） */
function rtpAdjust(rec) {
  if (rec.totalWon <= 0n || rec.totalBet <= 0n) return 1;
  const ratio = Number(rec.totalWon) / Number(rec.totalBet); // 当前返还率
  if (ratio <= RTP) return 1.2; // 玩家亏太多，放宽一点
  return 0.55; // 玩家赚太多，收紧
}

async function chainNow() {
  try {
    const block = await provider.getBlock("latest");
    if (block && block.timestamp) return Number(block.timestamp);
  } catch {
    /* 退回本地时间 */
  }
  return Math.floor(Date.now() / 1000);
}

/* ───────── 下分签名 ───────── */
async function signWithdraw(player, amount) {
  const nonce = await vault.nonces(player);
  const deadline = (await chainNow()) + 600; // 10 分钟有效
  // 必须和合约 claimReward 里的 digest 完全一致
  const digest = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "address", "uint256", "uint256", "uint256"],
      [CHAIN_ID, getAddress(VAULT), player, amount, nonce, deadline],
    ),
  );
  const signature = await signerWallet.signMessage(getBytes(digest));
  return { amount, nonce, deadline, signature };
}

/* ───────── 事件监听：Deposited → 上分入账 ───────── */
let lastScannedBlock = START_BLOCK || 0;
let scanning = false;

async function scanDeposits() {
  if (scanning) return;
  scanning = true;
  try {
    const current = await provider.getBlockNumber();
    if (lastScannedBlock === 0) lastScannedBlock = current;
    if (current - lastScannedBlock <= 0) return;
    const logs = await provider.getLogs({
      address: getAddress(VAULT),
      topics: [id("Deposited(address,uint256,uint256)")],
      fromBlock: lastScannedBlock,
      toBlock: current,
    });
    for (const log of logs) {
      try {
        const parsed = vault.interface.parseLog(log);
        const player = getAddress(parsed.args.player);
        const amount = BigInt(parsed.args.amount);
        const rec = playerOf(player);
        rec.balance += amount;
        scheduleSave();
        console.log(`[fishing] 上分入账 ${player} += ${amount}（净余额 ${rec.balance}）`);
      } catch {
        /* 跳过坏日志 */
      }
    }
    lastScannedBlock = current + 1;
  } catch (e) {
    console.log("[fishing] 扫链失败（下轮重试）:", e.message);
  } finally {
    scanning = false;
  }
}

/* ───────── HTTP 服务 ───────── */
const rateHits = new Map();

function rateLimit(req) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const rec = rateHits.get(ip);
  if (!rec || now - rec.t > RATE_WINDOW_MS) {
    rateHits.set(ip, { t: now, n: 1 });
    return;
  }
  rec.n += 1;
  if (rec.n > RATE_MAX) throw new Error("请求过于频繁，请稍后再试");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (request.method === "GET" && (p === "/health" || p === "/")) {
      const [signerOnChain, paused, pool] = await Promise.all([
        vault.signer().catch(() => "?"),
        vault.paused().catch(() => null),
        vault.poolBalance().catch(() => 0n),
      ]);
      sendJson(response, 200, {
        ok: true,
        service: "fishing-backend",
        chainId: CHAIN_ID,
        vault: getAddress(VAULT),
        token: TOKEN,
        signer: signerWallet.address,
        signerMatchesOnChain:
          String(signerOnChain).toLowerCase() === signerWallet.address.toLowerCase(),
        paused,
        poolBalance: pool.toString(),
        rtp: RTP,
        players: players.size,
        lastScannedBlock,
      });
      return;
    }

    if (request.method === "GET" && p === "/api/fishing/state") {
      const playerRaw = String(url.searchParams.get("player") || "");
      if (!isAddress(playerRaw)) return sendJson(response, 400, { error: "玩家地址不合法" });
      const player = getAddress(playerRaw);
      const rec = playerOf(player);
      const [deposited, claimed, nonce] = await Promise.all([
        vault.deposited(player).catch(() => 0n),
        vault.claimed(player).catch(() => 0n),
        vault.nonces(player).catch(() => 0n),
      ]);
      sendJson(response, 200, {
        ok: true,
        player,
        balance: rec.balance.toString(),
        deposited: deposited.toString(),
        claimed: claimed.toString(),
        nonce: nonce.toString(),
        totalBet: rec.totalBet.toString(),
        totalWon: rec.totalWon.toString(),
        withdrawn: rec.withdrawn.toString(),
      });
      return;
    }

    if (request.method === "POST") {
      rateLimit(request);
      const body = await readBody(request);

      // 开炮：服务端权威判定
      if (p === "/api/fishing/shoot") {
        const playerRaw = String(body.player || "");
        const cannonLevel = Number(body.cannonLevel || 0);
        const targets = Array.isArray(body.targets) ? body.targets : [];
        if (!isAddress(playerRaw)) return sendJson(response, 400, { error: "玩家地址不合法" });
        if (!Number.isInteger(cannonLevel) || cannonLevel < 1 || cannonLevel > 5) {
          return sendJson(response, 400, { error: "炮档必须是 1-5" });
        }
        if (targets.length === 0 || targets.length > 20) {
          return sendJson(response, 400, { error: "目标鱼数量不合法" });
        }
        const player = getAddress(playerRaw);
        const rec = playerOf(player);
        const cost = BigInt(cannonLevel);
        if (rec.balance < cost) {
          return sendJson(response, 400, { ok: false, error: "游戏分不足，请先上分" });
        }

        // 扣炮弹分
        rec.balance -= cost;
        rec.totalBet += cost;

        // 对每条目标鱼判定（带 RTP 调节）
        const adjust = rtpAdjust(rec);
        const results = [];
        let won = 0n;
        for (const t of targets) {
          const type = Number(t.type || 0);
          const cfg = FISH_CONFIG.find((f) => f.id === type);
          if (!cfg) continue;
          const caught = checkCatch(cannonLevel, cfg.prob) && Math.random() <= adjust;
          results.push({ fishId: String(t.fishId ?? ""), type, caught });
          if (caught) won += BigInt(cfg.worth);
        }
        rec.balance += won;
        rec.totalWon += won;
        scheduleSave();
        sendJson(response, 200, { ok: true, results, won: won.toString(), cost, balance: rec.balance.toString() });
        return;
      }

      // 下分签名
      if (p === "/api/fishing/withdraw-request") {
        const playerRaw = String(body.player || "");
        const amount = BigInt(String(body.amount ?? "0"));
        if (!isAddress(playerRaw)) return sendJson(response, 400, { error: "玩家地址不合法" });
        if (amount <= 0n) return sendJson(response, 400, { error: "下分金额必须大于 0" });
        if (amount < MIN_WITHDRAW) {
          return sendJson(response, 400, { error: `单次下分至少 ${MIN_WITHDRAW.toString()} 代币` });
        }
        const player = getAddress(playerRaw);
        const rec = playerOf(player);
        if (rec.balance < amount) {
          return sendJson(response, 400, { error: `下分金额超过游戏分余额（${rec.balance}）` });
        }
        const signed = await signWithdraw(player, amount);
        // 签名即扣账，防止同一笔额度重复申请
        rec.balance -= amount;
        rec.withdrawn += amount;
        scheduleSave();
        sendJson(response, 200, { ok: true, player, ...signed, balance: rec.balance.toString() });
        return;
      }
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message =
      (error && (error.shortMessage || error.message)) || String(error) || "未知错误";
    sendJson(response, 400, { ok: false, error: message });
  }
});

server.listen(PORT, () => {
  console.log(`出海捕鱼后端启动，监听 :${PORT}`);
  console.log(`  合约      ${VAULT}`);
  console.log(`  代币      ${TOKEN}`);
  console.log(`  签名地址  ${signerWallet.address}`);
  console.log(`  目标 RTP  ${RTP}`);
  console.log(`  RPC       ${RPC_LIST.join(" → ")}`);
  console.log(`  状态落盘  ${STATE_PATH}`);
  loadState();
  // 先扫一次历史入账，再每 30 秒轮询新入账
  void scanDeposits();
  setInterval(() => void scanDeposits(), 30_000);
});

process.on("SIGINT", () => {
  try {
    persist();
  } catch {
    /* ignore */
  }
  process.exit(0);
});
