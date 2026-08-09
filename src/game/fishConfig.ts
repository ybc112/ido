/** 鱼类配置：数值照搬原 Java 版 fish/FishInfo.plist */

export interface FishType {
  id: number;
  name: string;
  /** 捕到后的分值 */
  worth: number;
  /** 捕鱼概率基准（千分制）：实际概率 = 炮档*10 + catchProbability */
  catchProbability: number;
  /** 游动速度 */
  speed: number;
  /** 显示尺寸（px） */
  size: number;
  /** 颜色 */
  color: string;
  emoji: string;
}

const COLORS = [
  "#4fd1e5", "#7dd3fc", "#f9a8d4", "#fbbf24", "#f87171",
  "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#2dd4bf",
];

export const FISH_TYPES: FishType[] = [
  { id: 1, name: "fish01", worth: 2,   catchProbability: 400, speed: 50,  size: 18, color: COLORS[0], emoji: "🐟" },
  { id: 2, name: "fish02", worth: 8,   catchProbability: 250, speed: 60,  size: 22, color: COLORS[1], emoji: "🐠" },
  { id: 3, name: "fish03", worth: 4,   catchProbability: 150, speed: 70,  size: 20, color: COLORS[2], emoji: "🐟" },
  { id: 4, name: "fish04", worth: 15,  catchProbability: 20,  speed: 40,  size: 30, color: COLORS[3], emoji: "🐡" },
  { id: 5, name: "fish05", worth: 10,  catchProbability: 190, speed: 70,  size: 24, color: COLORS[4], emoji: "🐠" },
  { id: 6, name: "fish06", worth: 12,  catchProbability: 120, speed: 80,  size: 26, color: COLORS[5], emoji: "🐟" },
  { id: 7, name: "fish07", worth: 15,  catchProbability: 100, speed: 60,  size: 28, color: COLORS[6], emoji: "🐠" },
  { id: 8, name: "fish08", worth: 40,  catchProbability: 80,  speed: 50,  size: 34, color: COLORS[7], emoji: "🐡" },
  { id: 9, name: "fish09", worth: 50,  catchProbability: 70,  speed: 50,  size: 36, color: COLORS[8], emoji: "🐠" },
  { id: 10, name: "fish10", worth: 60, catchProbability: 40,  speed: 55,  size: 40, color: COLORS[9], emoji: "🐟" },
  { id: 11, name: "fish11", worth: 120, catchProbability: 10, speed: 50,  size: 46, color: "#fbbf24", emoji: "🦈" },
  { id: 12, name: "fish12", worth: 120, catchProbability: 10, speed: 50,  size: 48, color: "#f87171", emoji: "🐋" },
  { id: 13, name: "fish13", worth: 100, catchProbability: 15, speed: 50,  size: 44, color: "#a78bfa", emoji: "🐬" },
  { id: 14, name: "fish14", worth: 70,  catchProbability: 20, speed: 60,  size: 38, color: "#34d399", emoji: "🐠" },
  { id: 15, name: "fish15", worth: 80,  catchProbability: 20, speed: 80,  size: 40, color: "#fb923c", emoji: "🐡" },
  { id: 16, name: "fish16", worth: 150, catchProbability: 5,  speed: 40,  size: 52, color: "#f472b6", emoji: "🐋" },
  { id: 17, name: "fish17", worth: 90,  catchProbability: 30, speed: 120, size: 42, color: "#2dd4bf", emoji: "🦑" },
];

/** 炮弹档位：下标 +1 即炮弹花费分数 */
export const CANNON_LEVELS = [1, 2, 3, 4, 5];

/** 初始分数（演示模式；正式版由后端结算） */
export const INITIAL_SCORE = 100;

/** 判断一条鱼是否捕到：与 Java 版 checkCatch 一致 */
export function checkCatch(cannonLevel: number, catchProbability: number): boolean {
  const probability = cannonLevel * 10 + catchProbability;
  return Math.random() * 1000 + 1 <= probability;
}
