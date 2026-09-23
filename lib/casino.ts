import { createHash, createHmac, randomBytes } from "crypto";
import {
  PLINKO_BINS,
  ROULETTE_REDS,
  WHEEL_SEGMENTS,
  crashMultiplierAt,
  crashTimeFor,
  type Engine,
} from "@/lib/casino-catalog";

/**
 * Server-side outcomes for the casino games.
 *
 * Every random number comes from an HMAC of a fresh 32-byte server seed, so a
 * round can be replayed from its revealed seed and checked against the hash
 * that was stored before the stake was taken.
 */

const HOUSE = 0.97;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function newSeed() {
  const seed = randomBytes(32).toString("hex");
  return { seed, hash: createHash("sha256").update(seed).digest("hex") };
}

/** Uniform float in [0, 1) for draw number `n` of a seed. */
export function draw(seed: string, n = 0): number {
  const hex = createHmac("sha256", seed).update(String(n)).digest("hex").slice(0, 13);
  return parseInt(hex, 16) / 2 ** 52;
}

// ------------------------------------------------------------------- crash

/** P(crash point >= m) = 0.97 / m; 3% of rounds bust at 1.00x. */
export function crashPoint(seed: string): number {
  const h = draw(seed);
  return Math.max(1, Math.floor((HOUSE / (1 - h)) * 100) / 100);
}

export type CrashState =
  | { status: "running"; multiplier: number }
  | { status: "won"; multiplier: number }
  | { status: "lost"; multiplier: number };

/**
 * Where a running crash round stands at `elapsedMs`. An auto cash-out that the
 * multiplier has already passed pays out even if the player never asked.
 */
export function crashStateAt(point: number, autoCashout: number | null, elapsedMs: number): CrashState {
  if (autoCashout && autoCashout <= point && elapsedMs >= crashTimeFor(autoCashout)) {
    return { status: "won", multiplier: autoCashout };
  }
  if (elapsedMs >= crashTimeFor(point)) return { status: "lost", multiplier: point };
  return { status: "running", multiplier: crashMultiplierAt(elapsedMs) };
}

// ----------------------------------------------------------------- instant

export type InstantResult = { multiplier: number; outcome: Record<string, unknown> };

type Pick = Record<string, unknown>;

export class PickError extends Error {}

export function playInstant(engine: Exclude<Engine, "crash">, seed: string, pick: Pick): InstantResult {
  switch (engine) {
    case "dice":
      return dice(seed, pick);
    case "bottle":
      return bottle(seed, pick);
    case "roulette":
      return roulette(seed, pick);
    case "wheel":
      return wheel(seed);
    case "slot":
      return slot(seed);
    case "plinko":
      return plinko(seed);
  }
}

function dice(seed: string, pick: Pick): InstantResult {
  const target = Number(pick.target);
  const direction = pick.direction === "over" ? "over" : pick.direction === "under" ? "under" : null;
  if (!direction || !Number.isFinite(target) || target < 2 || target > 98) {
    throw new PickError("Choose over or under a number between 2 and 98");
  }
  const roll = Math.floor(draw(seed) * 10_000) / 100;
  const chance = direction === "under" ? target : 100 - target;
  const win = direction === "under" ? roll < target : roll > target;
  return { multiplier: win ? round2((HOUSE * 100) / chance) : 0, outcome: { roll, target, direction } };
}

function bottle(seed: string, pick: Pick): InstantResult {
  const side = pick.side === "up" || pick.side === "down" ? pick.side : null;
  if (!side) throw new PickError("Choose up or down");
  const landed = draw(seed) < 0.5 ? "up" : "down";
  return { multiplier: landed === side ? 1.94 : 0, outcome: { landed, side } };
}

function roulette(seed: string, pick: Pick): InstantResult {
  const bet = String(pick.bet ?? "");
  const number = Math.floor(draw(seed) * 37);
  const color = number === 0 ? "green" : ROULETTE_REDS.includes(number) ? "red" : "black";

  let multiplier = 0;
  if (bet === "red" || bet === "black") multiplier = color === bet ? 2 : 0;
  else if (bet === "green") multiplier = number === 0 ? 36 : 0;
  else if (bet === "odd" || bet === "even") multiplier = number !== 0 && (number % 2 === 1) === (bet === "odd") ? 2 : 0;
  else if (/^\d{1,2}$/.test(bet) && Number(bet) <= 36) multiplier = Number(bet) === number ? 36 : 0;
  else throw new PickError("Choose red, black, green, odd, even or a number from 0 to 36");

  return { multiplier, outcome: { number, color, bet } };
}

function wheel(seed: string): InstantResult {
  const segment = Math.floor(draw(seed) * WHEEL_SEGMENTS.length);
  return { multiplier: WHEEL_SEGMENTS[segment], outcome: { segment } };
}

const SLOT_TABLE: { multiplier: number; chance: number; symbol: string }[] = [
  { multiplier: 50, chance: 0.002, symbol: "💎" },
  { multiplier: 20, chance: 0.006, symbol: "7️⃣" },
  { multiplier: 10, chance: 0.012, symbol: "🔔" },
  { multiplier: 5, chance: 0.03, symbol: "🍉" },
  { multiplier: 2, chance: 0.14, symbol: "🍋" },
  { multiplier: 1, chance: 0.2, symbol: "🍒" },
];
const SLOT_SYMBOLS = ["💎", "7️⃣", "🔔", "🍉", "🍋", "🍒", "🍇"];

function slot(seed: string): InstantResult {
  let r = draw(seed);
  for (const row of SLOT_TABLE) {
    if (r < row.chance) return { multiplier: row.multiplier, outcome: { reels: [row.symbol, row.symbol, row.symbol] } };
    r -= row.chance;
  }
  // A losing spin shows three reels that never line up.
  const a = SLOT_SYMBOLS[Math.floor(draw(seed, 1) * SLOT_SYMBOLS.length)];
  const rest = SLOT_SYMBOLS.filter((s) => s !== a);
  const b = rest[Math.floor(draw(seed, 2) * rest.length)];
  const c = rest.filter((s) => s !== b)[Math.floor(draw(seed, 3) * (rest.length - 1))];
  return { multiplier: 0, outcome: { reels: [a, b, c] } };
}

function plinko(seed: string): InstantResult {
  const path: ("L" | "R")[] = [];
  for (let row = 0; row < PLINKO_BINS.length - 1; row++) path.push(draw(seed, row) < 0.5 ? "L" : "R");
  const bin = path.filter((step) => step === "R").length;
  return { multiplier: PLINKO_BINS[bin], outcome: { path, bin } };
}
