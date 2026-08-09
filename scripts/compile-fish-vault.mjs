// 编译 FishGameVault.sol → artifacts/FishGameVault.json（abi + bytecode）
// 用法：node scripts/compile-fish-vault.mjs
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const SOURCE = path.resolve("contracts/FishGameVault.sol");
const OUT = path.resolve("artifacts/FishGameVault.json");

const input = {
  language: "Solidity",
  sources: {
    "FishGameVault.sol": { content: fs.readFileSync(SOURCE, "utf8") },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors || [];
const fatal = errors.filter((e) => e.severity === "error");
if (fatal.length > 0) {
  for (const e of fatal) console.error(e.formattedMessage);
  process.exit(1);
}
for (const e of errors) {
  if (e.severity === "warning") console.warn("[solc] warning:", e.message.slice(0, 120));
}

const contract = output.contracts["FishGameVault.sol"].FishGameVault;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` }, null, 2),
);
console.log("✅ 编译成功 →", OUT);
