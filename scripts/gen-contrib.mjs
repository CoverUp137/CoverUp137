#!/usr/bin/env node
/**
 * 生成「过去一年贡献」热力图 SVG（深色 / 浅色各一份）。
 * 用法：GH_TOKEN=xxx node scripts/gen-contrib.mjs
 * 依赖：Node 18+（内置 fetch），零第三方包。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOGIN = process.env.GH_LOGIN || "CoverUp137";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets");

const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
  totalContributions
  weeks{contributionDays{date contributionCount weekday}}
}}}}`;

const r = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "profile-readme-contrib",
  },
  body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
});
if (!r.ok) throw new Error(`GitHub API ${r.status} ${await r.text()}`);
const json = await r.json();
if (json.errors) throw new Error(JSON.stringify(json.errors));

const cal = json.data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks;
const total = cal.totalContributions;

const CELL = 12, GAP = 3, STEP = CELL + GAP;
const PAD_X = 2, TOP = 44, LEFT = PAD_X;
const W = LEFT * 2 + weeks.length * STEP - GAP;
const H = TOP + 7 * STEP - GAP + 34;
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

const THEMES = {
  dark: {
    fg: "#C9D1E0", dim: "#7D8CA8", accent: "#93C5FD", border: "#243044",
    levels: ["#161B26", "#143A66", "#1D5CC4", "#3B82F6", "#93C5FD"],
  },
  light: {
    fg: "#334155", dim: "#7C8AA3", accent: "#2563EB", border: "#DCE4F2",
    levels: ["#EBEEF5", "#BFDBFE", "#60A5FA", "#2563EB", "#1E3A8A"],
  },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const level = (n) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);

function render(t) {
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="过去一年的贡献：${total} 次">`);

  // 标题
  parts.push(`<text x="${LEFT}" y="16" font-family="'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif" font-size="13" fill="${t.fg}">过去一年的贡献</text>`);
  parts.push(`<text x="${W - LEFT}" y="16" text-anchor="end" font-family="'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif" font-size="13" fill="${t.dim}">${total} 次</text>`);

  // 月份标签
  let lastMonth = -1;
  weeks.forEach((w, i) => {
    const d = new Date(w.contributionDays[0].date + "T00:00:00Z");
    const m = d.getUTCMonth();
    if (m !== lastMonth) {
      const x = LEFT + i * STEP;
      if (x < W - LEFT - 26) {
        parts.push(`<text x="${x}" y="${TOP - 8}" font-family="'Segoe UI','PingFang SC',sans-serif" font-size="9.5" fill="${t.dim}">${MONTHS[m]}</text>`);
      }
      lastMonth = m;
    }
  });

  // 格子
  weeks.forEach((w, i) => {
    w.contributionDays.forEach((d) => {
      const x = LEFT + i * STEP;
      const y = TOP + d.weekday * STEP;
      parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.2" fill="${t.levels[level(d.contributionCount)]}"><title>${d.date}：${d.contributionCount} 次</title></rect>`);
    });
  });

  // 图例
  const lx = W - LEFT - 5 * STEP - 22;
  const ly = TOP + 7 * STEP - GAP + 14;
  parts.push(`<text x="${lx - 26}" y="${ly + 9}" text-anchor="end" font-family="'Segoe UI','PingFang SC',sans-serif" font-size="10" fill="${t.dim}">少</text>`);
  t.levels.forEach((c, i) => {
    parts.push(`<rect x="${lx + i * STEP}" y="${ly}" width="${CELL}" height="${CELL}" rx="2.2" fill="${c}"/>`);
  });
  parts.push(`<text x="${lx + 5 * STEP + 4}" y="${ly + 9}" font-family="'Segoe UI','PingFang SC',sans-serif" font-size="10" fill="${t.dim}">多</text>`);
  parts.push(`<text x="${LEFT}" y="${ly + 9}" font-family="'Segoe UI','PingFang SC',sans-serif" font-size="10" fill="${t.dim}">${esc(LOGIN)}</text>`);

  parts.push("</svg>");
  return parts.join("\n");
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  const file = resolve(OUT_DIR, `contrib-${name}.svg`);
  writeFileSync(file, render(theme), "utf8");
  console.log("wrote", file);
}
console.log(`total=${total} weeks=${weeks.length} size=${W}x${H}`);
// 显式退出，避免 Node 24 在 fetch 长连接上 exit 时 abort
process.exit(0);
