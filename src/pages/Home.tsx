import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgePercent,
  Coins,
  Flame,
  Gem,
  Landmark,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
  ArrowRight,
  Lock,
  Trash2,
  Infinity as InfinityIcon,
} from "lucide-react";

/* ───────── 数字滚动动效 ───────── */
function useCountUp(target: number, duration = 1400, decimals = 0) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setValue(target * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);
  return { ref, display: value.toLocaleString("zh-CN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) };
}

/* ───────── 金色粒子层 ───────── */
function Particles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        size: 2 + ((i * 13) % 4),
        duration: 14 + ((i * 7) % 16),
        delay: -((i * 3.3) % 18),
      })),
    []
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p, i) => (
        <span
          key={i}
          className="gold-particle"
          style={{
            left: p.left,
            bottom: "-12px",
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ───────── 板块标题 ───────── */
function SectionHeader({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="mb-10 text-center">
      <div className="mb-3 text-4xl">{emoji}</div>
      <h2 className="gold-text text-3xl font-black tracking-tight md:text-4xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#8aa7bd] md:text-base">{sub}</p>
    </div>
  );
}

/* ───────── 托底价曲线图 ───────── */
function FloorPriceChart() {
  const width = 640;
  const height = 320;
  const pad = { l: 46, r: 18, t: 24, b: 36 };
  const x = (hour: number) => pad.l + (hour / 96) * (width - pad.l - pad.r);
  const y = (pct: number) => pad.t + ((150 - pct) / (150 - 50)) * (height - pad.t - pad.b);

  // 市场价：在 100% 上下波动（开盘 85 → 缓慢上行到 120）
  const market = useMemo(() => {
    const pts: [number, number][] = [];
    for (let h = 0; h <= 96; h += 4) {
      const wave = Math.sin(h / 9) * 7 + Math.sin(h / 3.7) * 3;
      const trend = 85 + (h / 96) * 35;
      pts.push([h, trend + wave]);
    }
    return pts;
  }, []);

  // 托底价：从市场价 80% 起步，每 3 小时涨一点，4 天（96h）封顶 130%（相对首日市场价）
  const floor = useMemo(() => {
    const pts: [number, number][] = [];
    const marketStart = market[0][1]; // 85
    for (let h = 0; h <= 96; h += 3) {
      const ratio = Math.min(0.8 + (h / 96) * 0.5, 1.3);
      pts.push([h, marketStart * ratio]);
    }
    return pts;
  }, [market]);

  const marketPath = market.map(([h, v], i) => `${i === 0 ? "M" : "L"} ${x(h).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const floorPath = floor.map(([h, v], i) => `${i === 0 ? "M" : "L"} ${x(h).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#e8f7ff]">
          <TrendingUp className="h-4 w-4 text-[#4fd1e5]" />
          托底价走势（激活后 96 小时）
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-[#8aa7bd]">
            <span className="h-0.5 w-5 rounded bg-[#8ec9e8]" /> 市场价
          </span>
          <span className="flex items-center gap-1.5 text-[#8aa7bd]">
            <span className="h-0.5 w-5 rounded bg-[#4fd1e5]" /> 托底价
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* 网格线 */}
        {[80, 100, 120, 140].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(79,209,229,0.08)" strokeDasharray="3 5" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#8aa7bd">
              {v}%
            </text>
          </g>
        ))}
        {[0, 24, 48, 72, 96].map((h) => (
          <text key={h} x={x(h)} y={height - 12} textAnchor="middle" fontSize="10" fill="#8aa7bd">
            {h === 0 ? "开启" : h === 96 ? "4 天封顶" : `${h}h`}
          </text>
        ))}
        {/* 80% 起点标注 */}
        <line x1={pad.l} x2={x(96)} y1={y(85 * 0.8)} y2={y(85 * 0.8)} stroke="rgba(79,209,229,0.2)" strokeDasharray="2 6" />
        {/* 市场价 */}
        <path d={marketPath} fill="none" stroke="#8ec9e8" strokeWidth="2.5" strokeLinecap="round" className="draw-line" opacity="0.9" />
        {/* 托底价（阶梯） */}
        <path d={floorPath} fill="none" stroke="#4fd1e5" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="draw-line" style={{ animationDelay: "0.5s" }} />
        {/* 端点 */}
        <circle cx={x(0)} cy={y(floor[0][1])} r="5" fill="#4fd1e5" />
        <circle cx={x(96)} cy={y(floor[floor.length - 1][1])} r="6" fill="#a5f3fc" className="glow-pulse" />
        <text x={x(96) - 10} y={y(floor[floor.length - 1][1]) - 12} textAnchor="end" fontSize="11" fontWeight="700" fill="#a5f3fc">
          1.3 倍封顶
        </text>
        <text x={x(6)} y={y(85 * 0.8) + 16} fontSize="11" fill="#4fd1e5" opacity="0.9">
          起步 ≈ 市场价 8 折
        </text>
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
        <div className="rounded-xl bg-[#06233f]/40 px-2 py-2.5">
          <div className="text-[#8aa7bd]">起步</div>
          <div className="mt-0.5 font-bold text-[#4fd1e5]">≈ 8 折</div>
        </div>
        <div className="rounded-xl bg-[#06233f]/40 px-2 py-2.5">
          <div className="text-[#8aa7bd]">节奏</div>
          <div className="mt-0.5 font-bold text-[#4fd1e5]">每 3h 上涨</div>
        </div>
        <div className="rounded-xl bg-[#06233f]/40 px-2 py-2.5">
          <div className="text-[#8aa7bd]">封顶</div>
          <div className="mt-0.5 font-bold text-[#4fd1e5]">1.3 倍 · 4 天</div>
        </div>
      </div>
    </div>
  );
}

/* ───────── 官网首页 ───────── */
export default function Home() {
  const staked = useCountUp(500000, 1500);
  const pool = useCountUp(128.6, 1600, 1);
  const floorRatio = useCountUp(80, 1300);
  const capRatio = useCountUp(130, 1500);

  return (
    <div className="relative">
      <Particles />

      {/* ════════ Hero ════════ */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 md:pb-24 md:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <img
              src="/logo.jpg"
              alt="logo"
              className="rise-in mb-6 h-20 w-20 rounded-2xl border border-[rgba(79,209,229,0.3)] object-cover shadow-xl shadow-[rgba(79,209,229,0.3)]"
            />
            <div className="rise-in rise-in-1 mb-5 flex flex-wrap items-center gap-2">
              <span className="gold-pill">
                <Gem className="h-3.5 w-3.5" /> 质押分红 · 托底价保障
              </span>
              <span className="gold-pill">
                <Flame className="h-3.5 w-3.5" /> 退出即销毁 · 通缩利好
              </span>
            </div>
            <h1 className="rise-in rise-in-1 text-4xl font-black leading-[1.12] tracking-tight md:text-6xl">
              <span className="shimmer-text">质押赚分红</span>
              <br />
              <span className="text-[#e8f7ff]">托底价</span>{" "}
              <span className="gold-text">安全退出</span>
            </h1>
            <p className="rise-in rise-in-2 mt-5 max-w-xl text-base leading-relaxed text-[#8aa7bd] md:text-lg">
              质押 50 万代币起自动参与分红，项目交易税持续注入、按质押量与时间分配 BNB，随时可领；
              金库托底回购价从 8 折起步一路爬升，满 4 天封顶 1.3 倍——涨跌都跟市场挂钩。
            </p>
            <div className="rise-in rise-in-3 mt-8 flex flex-wrap items-center gap-3">
              <a href="#staking" className="gold-btn">
                <Coins className="h-4 w-4" /> 了解质押分红
              </a>
              <a href="#floor-price" className="ghost-btn">
                <ShieldCheck className="h-4 w-4" /> 查看托底价
              </a>
            </div>
            <div className="rise-in rise-in-4 mt-10 grid max-w-md grid-cols-3 gap-3">
              <div className="glass-card p-3 text-center">
                <div className="text-[#8aa7bd]">起投门槛</div>
                <div className="mt-1 text-sm font-bold text-[#e8f7ff]">
                  <span ref={staked.ref}>{staked.display}</span>
                  <span className="text-[#4fd1e5]"> 起</span>
                </div>
              </div>
              <div className="glass-card p-3 text-center">
                <div className="text-[#8aa7bd]">分红形式</div>
                <div className="mt-1 text-sm font-bold text-[#e8f7ff]">
                  BNB <span className="text-[#4fd1e5]">随时领</span>
                </div>
              </div>
              <div className="glass-card p-3 text-center">
                <div className="text-[#8aa7bd]">退出机制</div>
                <div className="mt-1 text-sm font-bold text-[#e8f7ff]">
                  销毁 <span className="text-[#4fd1e5]">换 BNB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero 右侧：模拟质押面板 */}
          <div className="rise-in rise-in-2 relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(400px_300px_at_50%_30%,rgba(79,209,229,0.18),transparent_70%)]" />
            <div className="glass-card relative p-6 md:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-[#4fd1e5]" />
                  <span className="font-bold text-[#e8f7ff]">质押金库面板</span>
                </div>
                <span className="gold-pill">
                  <Zap className="h-3 w-3" /> 运行中
                </span>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[rgba(79,209,229,0.14)] bg-[#06233f]/45 p-4">
                  <div className="flex items-center justify-between text-xs text-[#8aa7bd]">
                    <span>我的质押量</span>
                    <span className="text-[#4fd1e5]">随质押增长</span>
                  </div>
                  <div className="mt-1.5 text-2xl font-black text-[#e8f7ff]">
                    {staked.display} <span className="text-sm font-semibold text-[#8aa7bd]">枚</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#0e7490] via-[#4fd1e5] to-[#a5f3fc]" />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-[#8aa7bd]">
                    <span>50 万起投</span>
                    <span>上不封顶</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[rgba(79,209,229,0.14)] bg-[#06233f]/45 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-[#8aa7bd]">
                      <Coins className="h-3.5 w-3.5 text-[#4fd1e5]" /> 累计分红
                    </div>
                    <div className="mt-1.5 text-xl font-black text-[#e8f7ff]">
                      {pool.display} <span className="text-xs font-semibold text-[#4fd1e5]">BNB</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                      <TrendingUp className="h-3 w-3" /> 交易税持续注入
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[rgba(79,209,229,0.14)] bg-[#06233f]/45 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-[#8aa7bd]">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#4fd1e5]" /> 当前托底价
                    </div>
                    <div className="mt-1.5 text-xl font-black text-[#4fd1e5]">
                      {floorRatio.display}%
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[#8aa7bd]">
                      <Timer className="h-3 w-3" /> 每 3h 上涨 · 4 天封顶 {capRatio.display}%
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(79,209,229,0.2)] bg-[rgba(79,209,229,0.07)] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#a5f3fc]">
                    <Flame className="h-4 w-4" /> 退出 = 销毁
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#8aa7bd]">
                    按当前托底价把多余质押销毁换 BNB，代币打入黑洞——每一次退出都在为币价做通缩。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ 💰 质押赚分红 ════════ */}
      <section id="staking" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:py-20">
        <SectionHeader
          emoji="💰"
          title="质押赚分红"
          sub="简单三步：质押 → 累计 → 领取。交易税持续注入分红池，按你的质押量与质押时间公平分配。"
        />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: "50 万代币起投",
              desc: "质押满 50 万枚代币即自动进入分红池，解锁分红资格。质押量越高，分得越多。",
              tag: "门槛",
            },
            {
              icon: Coins,
              title: "交易税持续注入 · 随时可领",
              desc: "项目每一笔交易税都会注入分红金库，系统按你的质押量与质押时间计算应得 BNB，随时领取、即领即到账。",
              tag: "分红",
            },
            {
              icon: Timer,
              title: "中途加入 · 公平不稀释",
              desc: "随时可以加入——分红从你质押的那一刻才开始计算，早质押不占便宜、晚加入不吃亏，人人按实际贡献分配。",
              tag: "公平",
            },
          ].map((item) => (
            <div key={item.title} className="glass-card p-6 md:p-7">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#67e8f9] to-[#0e7490] text-[#062230] shadow-lg shadow-[rgba(79,209,229,0.25)]">
                  <item.icon className="h-6 w-6" />
                </div>
                <span className="gold-pill">{item.tag}</span>
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#e8f7ff]">{item.title}</h3>
              <p className="text-sm leading-relaxed text-[#8aa7bd]">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 分红流水示意 */}
        <div className="glass-card mt-6 p-6">
          <div className="flex flex-col items-center gap-5 md:flex-row md:justify-between">
            {[
              { icon: BadgePercent, label: "每笔交易税" },
              { icon: Coins, label: "注入分红金库" },
              { icon: Wallet, label: "按质押量 × 时间分配" },
              { icon: TrendingUp, label: "随时领取 BNB" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex w-full items-center gap-4 md:w-auto">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(79,209,229,0.35)] bg-[rgba(79,209,229,0.08)] text-[#4fd1e5]">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-[#e8f7ff]">{step.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="hidden h-5 w-5 shrink-0 text-[#0e7490] md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ 🛡️ 托底价 ════════ */}
      <section id="floor-price" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:py-20">
        <SectionHeader
          emoji="🛡️"
          title="托底价：给你的保底退出"
          sub="代币上线交易所后，金库自动开启托底回购——起步约市场价 8 折，每 3 小时上涨一点，满 4 天封顶 1.3 倍。"
        />
        <div className="grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <FloorPriceChart />
          <div className="space-y-4">
            {[
              {
                icon: TrendingUp,
                title: "起步 8 折，每 3 小时涨一点",
                desc: "托底价从市场价约 8 折起步，此后每 3 小时自动上调，价格只升不降（除市场联动下调外）。",
              },
              {
                icon: Gem,
                title: "4 天封顶：1.3 倍",
                desc: "托底价从「市场价」逐步放开至「市场价的 1.3 倍」，激活满 4 天达到上限，此后保持高位保护。",
              },
              {
                icon: TrendingDown,
                title: "涨跌都跟市场挂钩",
                desc: "行情上涨，托底价跟着抬升；行情下跌，托底价相应下调——始终锚定市场，不脱离现实，也不会悬空。",
              },
            ].map((item) => (
              <div key={item.title} className="glass-card p-5">
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(79,209,229,0.3)] bg-[rgba(79,209,229,0.08)] text-[#4fd1e5]">
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#e8f7ff]">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#8aa7bd]">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ 🔥 怎么用托底价退出 ════════ */}
      <section id="exit" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:py-20">
        <SectionHeader
          emoji="🔥"
          title="怎么用托底价退出"
          sub="条件满足后，把超过保留额的多余质押按当前托底价销毁换成 BNB——卖出即销毁，通缩利好币价。"
        />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              icon: Lock,
              step: "01",
              title: "稳定仓满 24h",
              desc: "仓位保持稳定满 24 小时（每次加仓/减仓都会重新计时）。",
            },
            {
              icon: ShieldCheck,
              step: "02",
              title: "托底开启满 24h",
              desc: "托底回购价开启满 24 小时后，退出通道正式解锁。",
            },
            {
              icon: Wallet,
              step: "03",
              title: "保留 100 万枚",
              desc: "最多可退出「总质押 − 100 万保留额」的部分，保留额继续参与分红。",
            },
            {
              icon: Trash2,
              step: "04",
              title: "销毁换 BNB",
              desc: "按当前托底价把多余质押销毁，代币打入黑洞地址，你拿到对应 BNB。",
            },
          ].map((item) => (
            <div key={item.step} className="glass-card group p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#67e8f9] to-[#0e7490] font-black text-[#062230]">
                  {item.step}
                </div>
                <item.icon className="h-5 w-5 text-[#0e7490] transition-colors group-hover:text-[#4fd1e5]" />
              </div>
              <h3 className="mb-2 font-bold text-[#e8f7ff]">{item.title}</h3>
              <p className="text-sm leading-relaxed text-[#8aa7bd]">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="glass-card mt-6 flex flex-col items-center gap-4 border-[rgba(79,209,229,0.3)] p-6 text-center md:flex-row md:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(79,209,229,0.12)] text-[#4fd1e5]">
            <InfinityIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[#e8f7ff]">退出即销毁 = 通缩利好</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#8aa7bd]">
              每一枚通过托底价退出的代币都会被打入黑洞地址（0x…dEaD），永久退出流通。持续退出会不断缩小供应量，
              对持币者与币价都是长期利好。
            </p>
          </div>
          <a href="#staking" className="gold-btn shrink-0">
            <Sparkles className="h-4 w-4" /> 立即质押
          </a>
        </div>
      </section>

      {/* ════════ 底部 CTA ════════ */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="glass-card glow-pulse relative overflow-hidden p-8 text-center md:p-12">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(79,209,229,0.22),transparent_70%)]" />
          <div className="absolute -bottom-14 -left-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,209,229,0.15),transparent_70%)]" />
          <h2 className="relative text-2xl font-black tracking-tight md:text-4xl">
            <span className="gold-text">质押分红 + 托底价保障</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#8aa7bd]">
            质押即参与，退出有托底，销毁做通缩。三重机制守护你的每一次决策。
          </p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <a href="#staking" className="gold-btn">
              <Wallet className="h-4 w-4" /> 进入质押
            </a>
            <a href="#floor-price" className="ghost-btn">
              <ShieldCheck className="h-4 w-4" /> 再看托底机制
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
