/**
 * Builds the profile: one animated SVG per panel in `svg/`, and README.md
 * stacking them.
 *
 *   node scripts/build.mjs
 *
 * Needs a token for GitHub's GraphQL API — GITHUB_TOKEN in Actions, or the
 * GitHub CLI's (`gh auth token`) locally.
 *
 * A README can't run scripts or load anything from elsewhere, so every panel
 * is a self-contained SVG: the type is a subset of Inter Black embedded as a
 * data URI (assets/fonts, cut with fontTools), the photo is embedded the same
 * way, and every animation is SVG's own — SMIL for the stepped glitches,
 * CSS keyframes for the smooth ones. Nothing is under 48px on a 900px panel,
 * so nothing drops below ~19px on a phone.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "svg");
const asset = (...p) => join(ROOT, "assets", ...p);

const W = 900;
const M = 40; // side margin

/** The portfolio's ramp: near-black ink, a lilac so pale it reads as white,
 *  the site violet and a pale lilac either side of it. */
const C = {
  ink: "#0b0814",
  rule: "#221a33",
  white: "#ffffff",
  lilac: "#efe7ff",
  violet: "#8f4dff",
  pale: "#d9c8ff",
  accent: "#ae8cff",
  levels: ["#1a1426", "#3b2468", "#6236b8", "#8f4dff", "#d9c8ff"],
};

// ─── Type ────────────────────────────────────────────────────────────────────

const FONT = readFileSync(asset("fonts", "inter-black.woff")).toString("base64");
const METRICS = JSON.parse(readFileSync(asset("fonts", "inter-black.json"), "utf8"));
const FACE = `@font-face{font-family:IB;font-weight:900;src:url(data:font/woff;base64,${FONT}) format("woff")}`;
/** Cap height, as a fraction of the font size. */
const CAP = METRICS.capHeight / METRICS.unitsPerEm;
/** Inter Black at display sizes wants pulling in a touch. */
const TRACK = -0.02;

const advance = (ch) => (METRICS.advances[ch] ?? METRICS.advances.M) / METRICS.unitsPerEm;
/** Set width of a line at `size`, tracking included between letters. */
const measure = (str, size, track = TRACK) => {
  const chars = [...str];
  return chars.reduce((w, ch) => w + advance(ch) * size, 0) + track * size * (chars.length - 1);
};
/** The biggest size, up to `max`, at which a line fits `room`. */
const fit = (str, room, max) => Math.min(max, room / measure(str, 1));

const n = (v) => +v.toFixed(2);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function text(str, { x = 0, y = 0, size, fill = "none", stroke, sw = 0, anchor = "start", attrs = "" }) {
  const outline = stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : "";
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" letter-spacing="${n(TRACK * size)}" text-anchor="${anchor}" fill="${fill}"${outline}${attrs}>${esc(str)}</text>`;
}

function doc(h, label, body, css = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>${FACE}text{font-family:IB,"Arial Black",sans-serif;font-weight:900}${css}</style>
<rect width="${W}" height="${h}" fill="${C.ink}"/>
${body}
</svg>
`;
}

// ─── Stepped animation ───────────────────────────────────────────────────────
// The glitches hold and jump rather than slide, so they're SMIL with
// calcMode="discrete": each value holds until the next key time, the same as
// CSS `steps(1, end)` between keyframes in the portfolio. SMIL rather than
// CSS because a clip band's y and height can't be animated from CSS in every
// browser, and the whole fault should run on one clock.

/** frames: [percent, value][], starting at 0. */
function discrete(attr, frames, dur, begin = 0) {
  const keyTimes = frames.map(([p]) => n(p / 100)).join(";");
  const values = frames.map(([, v]) => v).join(";");
  return `<animate attributeName="${attr}" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" dur="${dur}s" begin="${n(begin)}s" repeatCount="indefinite"/>`;
}

function discreteTransform(type, frames, dur, begin = 0) {
  const keyTimes = frames.map(([p]) => n(p / 100)).join(";");
  const values = frames.map(([, v]) => v).join(";");
  return `<animateTransform attributeName="transform" type="${type}" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" dur="${dur}s" begin="${n(begin)}s" repeatCount="indefinite"/>`;
}

// ─── The glitch on the name ──────────────────────────────────────────────────
// The portfolio's `glitch-word` (globals.css), frame for frame: a pale lilac
// keyline, and a violet and a pale lilac copy of it tearing off in bands —
// [percent, on, dx em, dy em, inset top %, inset bottom %] — while the line
// itself kicks sideways with a skew under two degrees.

const CHROMA_A = {
  dur: 2.9,
  frames: [
    [0, 0], [4, 1, -0.055, 0.014, 6, 61], [6, 1, 0.048, -0.016, 54, 17], [8, 1, -0.032, 0.008, 28, 42],
    [10, 0], [29, 1, 0.06, 0.01, 66, 9], [31, 1, -0.04, -0.012, 11, 70], [34, 0],
    [58, 1, 0.036, 0, 38, 36], [60, 1, -0.062, 0.018, 74, 4], [63, 0], [86, 1, 0.028, -0.01, 20, 52], [89, 0],
  ],
};
const CHROMA_B = {
  dur: 3.4,
  frames: [
    [0, 0], [5, 1, 0.058, -0.014, 24, 48], [7, 1, -0.05, 0.02, 69, 6], [9, 0],
    [24, 1, -0.066, 0, 4, 72], [26, 1, 0.042, 0.012, 46, 28], [28, 1, -0.03, -0.008, 80, 2], [31, 0],
    [53, 1, 0.054, 0.016, 33, 40], [56, 0], [79, 1, -0.046, -0.018, 58, 20], [81, 1, 0.034, 0.006, 14, 63], [84, 0],
  ],
};
/** [percent, dx em, dy em, skew deg] */
const KICK = {
  dur: 3.7,
  frames: [[0, 0, 0, 0], [5, 0.014, 0, -1.6], [7, -0.012, 0, 1.2], [9, 0, 0, 0], [30, -0.016, 0.004, 1.8], [32, 0, 0, 0], [62, 0.01, -0.004, -1.1], [64, 0, 0, 0]],
};
/** Each line runs its cycles offset from the others, as the portfolio's do. */
const PHASES = [
  { kick: 0, a: 0, b: 0 },
  { kick: -1.2, a: -1.1, b: -0.6 },
  { kick: -2.5, a: -2.0, b: -1.5 },
];

function glitchWord(str, { x, y, size, sw, id, phase = PHASES[0] }) {
  const word = (stroke) => text(str, { size, stroke, sw });
  const clone = ({ dur, frames }, begin, stroke, clipId) => {
    const band = (pick) => frames.map(([p, on, , , top, bottom]) => [p, on ? pick(top, bottom) : 0]);
    const move = frames.map(([p, on, dx, dy]) => [p, on ? `${n(dx * size)} ${n(dy * size)}` : "0 0"]);
    return `<clipPath id="${clipId}" clipPathUnits="objectBoundingBox"><rect x="-0.2" width="1.4" y="0" height="0">${discrete("y", band((t) => n(t / 100)), dur, begin)}${discrete("height", band((t, b) => n((100 - t - b) / 100)), dur, begin)}</rect></clipPath>
<g clip-path="url(#${clipId})" style="mix-blend-mode:screen"><g>${discreteTransform("translate", move, dur, begin)}${word(stroke)}</g></g>`;
  };
  const kickMove = KICK.frames.map(([p, dx, dy]) => [p, `${n(dx * size)} ${n(dy * size)}`]);
  const kickSkew = KICK.frames.map(([p, , , skew]) => [p, skew]);
  return `<g transform="translate(${n(x)} ${n(y)})">
<g>${discreteTransform("translate", kickMove, KICK.dur, phase.kick)}<g>${discreteTransform("skewX", kickSkew, KICK.dur, phase.kick)}${word(C.lilac)}</g></g>
${clone(CHROMA_A, phase.a, C.violet, `${id}a`)}
${clone(CHROMA_B, phase.b, C.pale, `${id}b`)}
</g>`;
}

// ─── The glitch on the face ──────────────────────────────────────────────────
// The portfolio's tap on the photo: the whole of it drops to black and white
// and tears into bands knocked sideways, brightened and screened over it,
// with scanlines running down. Here it comes on its own, for a second and a
// half in every six. The tears are the portrait's own — [dx px, dy px, inset
// top, inset bottom] stepping through a cycle — scaled to this photo's size.

const TEARS = [
  { period: 1.4, steps: [[3, 0, 0.12, 0.62], [-5, 1, 0.48, 0.3], [6, -2, 0.7, 0.08], [-3, 2, 0.28, 0.5], [4, 0, 0.58, 0.22]] },
  { period: 1.1, steps: [[-4, 0, 0.55, 0.26], [5, -1, 0.18, 0.66], [-6, 2, 0.74, 0.06], [3, 1, 0.36, 0.44]] },
];
/** The burst: off, on at 56%, off at 82% of a 6-second cycle. */
const BURST = { dur: 6, frames: [[0, 0], [56, 1], [82, 0]] };
const PHOTO = readFileSync(asset("photo.webp")).toString("base64");
const PHOTO_SIZE = { w: 525, h: 475 };

function portrait({ x, y, h }) {
  const w = (h * PHOTO_SIZE.w) / PHOTO_SIZE.h;
  const k = w / 380; // the portfolio's tears were sized for a ~380px photo
  const tears = TEARS.map(({ period, steps }, i) => {
    const at = (s) => (s * 100) / steps.length;
    const band = (pick) => steps.map((step, s) => [at(s), pick(step)]);
    return `<clipPath id="tear${i}" clipPathUnits="objectBoundingBox"><rect x="-0.1" width="1.2">${discrete("y", band(([, , top]) => top), period)}${discrete("height", band(([, , top, bottom]) => n(1 - top - bottom)), period)}</rect></clipPath>
<g clip-path="url(#tear${i})" style="mix-blend-mode:screen"><g>${discreteTransform("translate", steps.map(([dx, dy], s) => [at(s), `${n(dx * k)} ${n(dy * k)}`]), period)}<use href="#face" filter="url(#hot)"/></g></g>`;
  });
  return `<defs>
<radialGradient id="glow"><stop offset="0" stop-color="${C.violet}" stop-opacity=".38"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></radialGradient>
<filter id="bw" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.12" intercept="-0.03"/><feFuncG type="linear" slope="1.12" intercept="-0.03"/><feFuncB type="linear" slope="1.12" intercept="-0.03"/></feComponentTransfer></filter>
<filter id="hot" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.5" intercept="0.04"/><feFuncG type="linear" slope="1.5" intercept="0.04"/><feFuncB type="linear" slope="1.5" intercept="0.04"/></feComponentTransfer></filter>
<filter id="solid"><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>
<pattern id="scan" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="#fff" opacity=".13"/></pattern>
<mask id="faceMask"><use href="#face" filter="url(#solid)"/></mask>
<image id="face" href="data:image/webp;base64,${PHOTO}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/>
</defs>
<circle cx="${n(x + w * 0.5)}" cy="${n(y + h * 0.42)}" r="${n(h * 0.62)}" fill="url(#glow)"/>
<use href="#face"/>
<g opacity="0">${discrete("opacity", BURST.frames, BURST.dur)}
<use href="#face" filter="url(#bw)"/>
${tears.join("\n")}
<g mask="url(#faceMask)"><rect x="${n(x)}" y="${n(y - 6)}" width="${n(w)}" height="${n(h + 12)}" fill="url(#scan)"><animateTransform attributeName="transform" type="translate" values="0 0;0 6" dur="0.55s" repeatCount="indefinite"/></rect></g>
</g>`;
}

// ─── Panels ──────────────────────────────────────────────────────────────────

function header() {
  const H = 540;
  const photoH = 470;
  const photoW = (photoH * PHOTO_SIZE.w) / PHOTO_SIZE.h;
  const photoX = W - photoW + 20; // the far shoulder runs off the edge
  // The name stops short of the head, which starts ~21% into the photo.
  const room = photoX + photoW * 0.21 - M - 16;
  const size = Math.floor(Math.min(fit("AATIF", room, 170), fit("GODIL", room, 170)));
  const line1 = 46 + size * CAP;
  const line2 = line1 + size * 0.88;

  const tagSize = 60;
  const tagY = line2 + 58 + tagSize * CAP;
  const slot = 100 / config.taglines.length;
  const DUR = 2 * config.taglines.length;
  const taglines = config.taglines.map((word, i) => {
    const show = i === 0 ? [[0, 1], [slot, 0]] : [[0, 0], [i * slot, 1], [(i + 1) * slot, 0]];
    // A violet copy jumps off it for the first beat of each word.
    const flash = i === 0 ? [[0, 1], [2, 0]] : [[0, 0], [i * slot, 1], [i * slot + 2, 0]];
    return `<g opacity="0">${discrete("opacity", show, DUR)}${text(word, { x: M, y: tagY, size: tagSize, fill: C.accent })}</g>
<g opacity="0" style="mix-blend-mode:screen">${discrete("opacity", flash, DUR)}${text(word, { x: M + 7, y: tagY - 3, size: tagSize, fill: C.violet })}</g>`;
  });

  const body = `${portrait({ x: photoX, y: H - photoH, h: photoH })}
${glitchWord("AATIF", { x: M, y: line1, size, sw: 3, id: "n1", phase: PHASES[0] })}
${glitchWord("GODIL", { x: M, y: line2, size, sw: 3, id: "n2", phase: PHASES[1] })}
${taglines.join("\n")}`;
  return doc(H, `Aatif Godil — ${config.taglines.join(" ").toLowerCase()}`, body);
}

/**
 * The contribution graph, GitHub's own layout set large: the count and what
 * it counts across the top, the year a week to a column in a box, and the
 * LESS → MORE legend under it. Through it runs a nod to the contribution
 * snake — a bright head working down one week and up the next, eating the
 * blocks as it goes, and the blocks popping back in a couple of seconds
 * behind it.
 *
 * The blocks keep their colour as an attribute and only the snake is
 * animation, so a still frame — or a reader with motion off — shows the
 * whole year.
 */
function contributions({ total, weeks }) {
  const number = total.toLocaleString("en-US");
  const size = 64;

  // The count, as an odometer: every digit a strip of 0–9 twice over behind
  // a window. It sits on its own digit, and once a cycle each column rolls a
  // full turn — on to the same digit in the second set, which is where the
  // next cycle picks up, so it never jumps.
  const line1 = 44 + size * CAP;
  const cell = Math.max(...[..."0123456789"].map((d) => advance(d))) * size;
  const lineH = size * 1.1;
  const winTop = line1 - size * CAP - (lineH - size * CAP) / 2;
  let x = M - 2;
  let col = 0;
  const digits = [];
  const css = [];
  for (const ch of number) {
    if (ch === ",") {
      digits.push(text(",", { x, y: line1, size, fill: C.white }));
      x += advance(",") * size;
      continue;
    }
    const d = +ch;
    const strip = Array.from({ length: 20 }, (_, k) => text(String(k % 10), { x: x + cell / 2, y: line1 + k * lineH, size, fill: C.white, anchor: "middle" })).join("");
    css.push(`@keyframes r${col}{0%,70%{transform:translateY(${n(-d * lineH)}px)}100%{transform:translateY(${n(-(d + 10) * lineH)}px)}}.r${col}{animation:r${col} 9s cubic-bezier(.7,0,.15,1) ${n(col * 0.14)}s infinite both}`);
    digits.push(`<clipPath id="win${col}"><rect x="${n(x)}" y="${n(winTop)}" width="${n(cell)}" height="${n(lineH)}"/></clipPath><g clip-path="url(#win${col})"><g class="r${col}">${strip}</g></g>`);
    x += cell;
    col++;
  }
  const word = "CONTRIBUTIONS";
  const wordX = x + advance(" ") * size;
  const line2 = line1 + size * 1.08;

  // The box, and the year in it.
  const pad = 24;
  const boxTop = line2 + 40;
  const gap = 3;
  const step = (W - 2 * M - 2 * pad + gap) / weeks.length;
  const sq = step - gap;
  const gridTop = boxTop + pad;

  // The snake's path: down the first week, up the next, and so on.
  const path = [];
  weeks.forEach((week, wi) => {
    const days = [...week].sort((a, b) => a.weekday - b.weekday);
    if (wi % 2) days.reverse();
    days.forEach((day) => path.push({ ...day, wi }));
  });
  const PER = 0.028; // seconds a block
  const DUR = n(path.length * PER + 4);
  const pct = (sec) => n((sec / DUR) * 100);
  const HEAD = "#ffffff";
  const BOX = "#0f0b1a";
  // One set of keyframes a level: the head, a violet body about four weeks
  // long, then eaten — gone to the box's own colour, so the snake leaves a
  // channel through the year — and back in with a pop. Only `fill` and scale
  // move; the resting colour is the block's own attribute.
  C.levels.forEach((colour, level) => {
    css.push(`@keyframes eat${level}{0%{fill:${HEAD};transform:scale(1.3)}${pct(0.08)}%{fill:${C.accent};transform:scale(1.05)}${pct(0.5)}%{fill:${C.violet};transform:scale(1)}${pct(0.9)}%,${pct(2.6)}%{fill:${BOX};transform:scale(1)}${pct(2.8)}%{fill:${colour};transform:scale(1.35)}${pct(3)}%,100%{fill:${colour};transform:scale(1)}}`);
  });
  css.push(`.b{transform-box:fill-box;transform-origin:center}`);
  for (let level = 0; level < C.levels.length; level++) css.push(`.l${level}{animation:eat${level} ${DUR}s linear infinite}`);

  const blocks = path.map(({ wi, weekday, level }, i) =>
    `<rect class="b l${level}" style="animation-delay:${n(0.8 + i * PER)}s" x="${n(M + pad + wi * step)}" y="${n(gridTop + weekday * step)}" width="${n(sq)}" height="${n(sq)}" rx="2" fill="${C.levels[level]}"/>`
  );

  // Today: the last block, ringed and breathing.
  const last = path.reduce((a, b) => (b.wi > a.wi || (b.wi === a.wi && b.weekday > a.weekday) ? b : a));
  const today = `<rect x="${n(M + pad + last.wi * step - 3)}" y="${n(gridTop + last.weekday * step - 3)}" width="${n(sq + 6)}" height="${n(sq + 6)}" rx="4" fill="none" stroke="${C.accent}" stroke-width="2"><animate attributeName="opacity" values="1;.15;1" dur="1.6s" repeatCount="indefinite"/></rect>`;

  // LESS ▪▪▪▪▪ MORE, right-aligned under the year.
  const legendSize = 48;
  const gridBottom = gridTop + 7 * step - gap;
  const legendBase = gridBottom + 30 + legendSize * CAP;
  const sw = 34;
  const swGap = 8;
  const more = measure("MORE", legendSize);
  let lx = W - M - pad - more;
  const legend = [text("MORE", { x: lx, y: legendBase, size: legendSize, fill: C.lilac })];
  lx -= 20 + C.levels.length * (sw + swGap) - swGap;
  C.levels.forEach((colour, i) => legend.push(`<rect x="${n(lx + i * (sw + swGap))}" y="${n(legendBase - (legendSize * CAP) / 2 - sw / 2)}" width="${sw}" height="${sw}" rx="5" fill="${colour}"/>`));
  legend.push(text("LESS", { x: lx - 20, y: legendBase, size: legendSize, fill: C.lilac, anchor: "end" }));

  const boxBottom = legendBase + pad;
  const h = boxBottom + 36;
  const body = `${digits.join("\n")}
${text(word, { x: wordX, y: line1, size, fill: C.lilac })}
${text("IN THE LAST YEAR", { x: M, y: line2, size, fill: C.accent })}
<rect x="${M}" y="${n(boxTop)}" width="${W - 2 * M}" height="${n(boxBottom - boxTop)}" rx="14" fill="${BOX}" stroke="${C.rule}" stroke-width="2"/>
${blocks.join("")}
${today}
${legend.join("\n")}`;
  return doc(Math.ceil(h), `${number} contributions in the last year`, body, css.join("\n"));
}

/** A panel heading: a violet block, the word, and a count to the right. */
function heading(word, count) {
  const H = 150;
  const size = 76;
  const base = H / 2 + (size * CAP) / 2;
  const body = `<rect x="${M}" y="${n(base - size * CAP)}" width="22" height="${n(size * CAP)}" fill="${C.violet}"><animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite"/></rect>
${text(word, { x: M + 44, y: base, size, fill: C.white })}
${count != null ? text(String(count).padStart(2, "0"), { x: W - M, y: base, size, fill: C.accent, anchor: "end" }) : ""}`;
  return doc(H, word.toLowerCase(), body);
}

/** The ↗, drawn — the subset has no arrows. */
const arrow = (x, y, s, color) =>
  `<path d="M${n(x)} ${n(y + s)}L${n(x + s)} ${n(y)}M${n(x + s * 0.3)} ${n(y)}H${n(x + s)}V${n(y + s * 0.7)}" fill="none" stroke="${color}" stroke-width="${n(s * 0.2)}" stroke-linecap="square"/>`;

/**
 * A row you click: its number, the name as large as it'll go, an arrow
 * nudging up and out, and a bar that runs out under the name and fades.
 * Rows in a list take turns, so it reads top to bottom.
 */
function linkRow(label, { index = 0, count = 1, numbered = true }) {
  const H = 132;
  const name = label.toUpperCase();
  const nameX = numbered ? M + 112 : M;
  const arrowS = 34;
  const room = W - nameX - M - arrowS - 30;
  const size = Math.floor(fit(name, room, numbered ? 80 : 96));
  if (size < 48) throw new Error(`"${label}" only fits at ${size}px — give it a shorter name in config.mjs`);
  const base = H / 2 + (size * CAP) / 2 - 4;
  const DUR = 1.4 * count + 2;
  const at = (t) => n((t / DUR) * 100);
  const start = index * 1.4;
  const css = `.bar{transform-box:fill-box;transform-origin:0 50%;animation:bar ${n(DUR)}s cubic-bezier(.7,0,.2,1) infinite}
@keyframes bar{0%,${at(start)}%{transform:scaleX(0);opacity:1}${at(start + 0.6)}%{transform:scaleX(1);opacity:1}${at(start + 1.3)}%,100%{transform:scaleX(1);opacity:0}}
.arw{animation:arw 2.4s ease-in-out ${n(index * 0.3)}s infinite}
@keyframes arw{0%,100%{transform:translate(0,0)}50%{transform:translate(5px,-5px)}}`;
  const body = `${numbered ? text(String(index + 1).padStart(2, "0"), { x: M, y: base, size: 56, fill: C.violet }) : ""}
${text(name, { x: nameX, y: base, size, fill: C.white })}
<rect class="bar" x="${nameX}" y="${n(base + 16)}" width="${n(measure(name, size))}" height="7" fill="${C.accent}"/>
<g class="arw">${arrow(W - M - arrowS, base - (size * CAP) / 2 - arrowS / 2, arrowS, C.accent)}</g>
<rect y="${H - 1}" width="${W}" height="1" fill="${C.rule}"/>`;
  return doc(H, label, body, css);
}

function tools() {
  const H = 260;
  const size = 54;
  const icon = 56;
  const gapIcon = 20;
  const gapItem = 70;
  const rowH = 110;
  const icons = Object.fromEntries(
    readdirSync(asset("icons")).filter((f) => f.endsWith(".svg")).map((f) => {
      const src = readFileSync(asset("icons", f), "utf8");
      const viewBox = src.match(/viewBox="([^"]+)"/)[1];
      const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "").replace(/fill="currentColor"/g, "");
      return [f.replace(/\.svg$/, ""), { viewBox, inner }];
    })
  );
  const half = Math.ceil(config.tools.length / 2);
  const rows = [config.tools.slice(0, half), config.tools.slice(half)];
  const css = [];
  const bands = rows.map((row, r) => {
    const y = 26 + r * (rowH + 14);
    const mid = y + rowH / 2;
    let x = 0;
    const items = [];
    for (const { name, icon: key } of row) {
      const { viewBox, inner } = icons[key];
      items.push(`<svg x="${n(x)}" y="${n(mid - icon / 2)}" width="${icon}" height="${icon}" viewBox="${viewBox}" fill="${C.white}">${inner}</svg>`);
      x += icon + gapIcon;
      items.push(text(name.toUpperCase(), { x, y: mid + (size * CAP) / 2, size, fill: r ? C.accent : C.lilac }));
      x += measure(name.toUpperCase(), size) + gapItem;
    }
    const span = n(x);
    const speed = 55; // px a second
    css.push(`.m${r}{animation:m${r} ${n(span / speed)}s linear infinite}@keyframes m${r}{${r ? `from{transform:translateX(${-span}px)}to{transform:translateX(0)}` : `to{transform:translateX(${-span}px)}`}}`);
    const run = items.join("");
    return `<g class="m${r}"><g>${run}</g><g transform="translate(${span} 0)">${run}</g></g>`;
  });
  const fade = `<defs><linearGradient id="edge"><stop offset="0" stop-color="${C.ink}"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0"/></linearGradient></defs>
<rect width="90" height="${H}" fill="url(#edge)"/><rect width="90" height="${H}" fill="url(#edge)" transform="translate(${W} 0) scale(-1 1)"/>`;
  return doc(H, `Tools: ${config.tools.map((t) => t.name).join(", ")}`, `${bands.join("\n")}\n${fade}`, css.join(""));
}

// ─── Data ────────────────────────────────────────────────────────────────────

async function github(query, variables) {
  const token = process.env.GITHUB_TOKEN || execSync("gh auth token").toString().trim();
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-build" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors || !json.data) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data;
}

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function load() {
  const { user } = await github(
    `query($login: String!) {
      user(login: $login) {
        contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionLevel } } } }
        repositories(first: 100, privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) { nodes { name url } }
      }
    }`,
    { login: config.login }
  );
  const calendar = user.contributionsCollection.contributionCalendar;
  return {
    total: config.contributions ?? calendar.totalContributions,
    weeks: calendar.weeks.map((w) => w.contributionDays.map((d) => ({ weekday: d.weekday, level: LEVEL[d.contributionLevel] ?? 0 }))),
    repos: user.repositories.nodes.filter((r) => !config.repos.exclude.includes(r.name)),
  };
}

// ─── Write ───────────────────────────────────────────────────────────────────

const data = await load();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "repos"), { recursive: true });
const files = {
  "header.svg": header(),
  "contributions.svg": contributions(data),
  "repositories.svg": heading("REPOSITORIES", data.repos.length),
  "tools.svg": heading("TOOLS", config.tools.length),
  "toolbelt.svg": tools(),
  "site.svg": linkRow(config.site.label, { numbered: false }),
};
const repoRows = data.repos.map((repo, i) => {
  const label = config.repos.names[repo.name] ?? repo.name;
  const file = `repos/${repo.name.toLowerCase()}.svg`;
  files[file] = linkRow(label, { index: i, count: data.repos.length });
  return { file, label, url: repo.url };
});
for (const [file, svg] of Object.entries(files)) writeFileSync(join(OUT, file), svg);

const img = (file, alt) => `<img src="svg/${file}" width="100%" alt="${esc(alt)}">`;
// GitHub wraps every README image that isn't already in a link in one to the
// image itself, so clicking a panel opened the raw SVG. The panels that
// aren't meant to go anywhere link to a spot on the page that doesn't exist
// instead, so a click goes nowhere. Not an anchor with no href — GitHub
// strips that and links the image anyway — and not a bare "#", which jumps
// to the top.
const still = (file, alt) => `<a href="#aatif">${img(file, alt)}</a>`;
const readme = `<div align="center">

${still("header.svg", `Aatif Godil — ${config.taglines.join(" ")}`)}

${still("contributions.svg", `${data.total.toLocaleString("en-US")} contributions`)}

${still("repositories.svg", "Repositories")}
${repoRows.map((r) => `<a href="${r.url}">${img(r.file, r.label)}</a>`).join("<br>\n")}

${still("tools.svg", "Tools")}
${still("toolbelt.svg", config.tools.map((t) => t.name).join(", "))}

<a href="${config.site.url}">${img("site.svg", config.site.label)}</a>

</div>
`;
writeFileSync(join(ROOT, "README.md"), readme);
console.log(`${data.total} contributions, ${data.repos.length} repos → ${Object.keys(files).length} SVGs`);
