import { useMemo } from "react";

/** 出海风格背景：深海渐变 + 三层波浪动画 + 浮动气泡 */
export function OceanBackground() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 7.3 + 3) % 100}%`,
        size: 8 + ((i * 13) % 22),
        duration: 9 + ((i * 7) % 14),
        delay: -((i * 3.7) % 18),
      })),
    [],
  );

  return (
    <>
      <div className="ocean-bg" />
      <div className="ocean-sheen" />
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="bubble"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
      {/* 三层波浪 */}
      <svg className="wave" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 60 Q150 10 300 55 T600 55 T900 55 T1200 55 V120 H0 Z"
          fill="rgba(34,167,196,0.5)"
        />
      </svg>
      <svg className="wave wave-2" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 70 Q200 20 400 65 T800 65 T1200 65 V120 H0 Z"
          fill="rgba(79,209,229,0.35)"
        />
      </svg>
      <svg className="wave wave-3" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 80 Q180 35 360 75 T720 75 T1200 75 V120 H0 Z"
          fill="rgba(232,247,255,0.18)"
        />
      </svg>
    </>
  );
}
