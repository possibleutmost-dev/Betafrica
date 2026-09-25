import type { Market, Price } from "./odds";

/**
 * Correct score, and the goal markets that fall out of it, for operator
 * fixtures.
 *
 * Upstream fixtures get real correct-score prices from the book. Operator
 * matches have only a 1X2 price, so the scoreline distribution is derived from
 * it: fit a Poisson goal rate to each side such that the model reproduces the
 * operator's own home/draw/away probabilities, then read every scoreline off
 * that fitted model.
 *
 * The point of fitting rather than inventing is coherence. A 2-0 quoted here
 * agrees with the 1X2, the over/under and the both-teams-to-score prices on the
 * same match, so a player cannot arbitrage one market against another.
 */

const MAX_GOALS = 6; // Scorelines above this collapse into "Any other".
const MARGIN = 1.08; // The book's cut on derived scoreline prices.

/** Poisson probability of exactly k events at rate lambda. */
function poisson(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

interface Rates {
  home: number;
  away: number;
}

/** Home/draw/away probabilities implied by a pair of goal rates. */
function outcomeProbs(r: Rates): { h: number; d: number; a: number } {
  let h = 0;
  let d = 0;
  let a = 0;

  for (let i = 0; i <= 12; i++) {
    const ph = poisson(i, r.home);
    for (let j = 0; j <= 12; j++) {
      const p = ph * poisson(j, r.away);
      if (i > j) h += p;
      else if (i === j) d += p;
      else a += p;
    }
  }
  return { h, d, a };
}

const fitCache = new Map<string, Rates>();

/**
 * Find the goal rates whose Poisson model best reproduces the given 1X2
 * probabilities. Coarse sweep, then a fine pass around the winner — fast enough
 * to run per fixture, and memoised on the rounded price anyway.
 */
function fitRates(pH: number, pD: number, pA: number): Rates {
  const key = `${pH.toFixed(3)}:${pD.toFixed(3)}:${pA.toFixed(3)}`;
  const cached = fitCache.get(key);
  if (cached) return cached;

  const err = (r: Rates): number => {
    const p = outcomeProbs(r);
    return (p.h - pH) ** 2 + (p.d - pD) ** 2 + (p.a - pA) ** 2;
  };

  let best: Rates = { home: 1.3, away: 1.1 };
  let bestErr = Infinity;

  for (let h = 0.15; h <= 4.0; h += 0.1) {
    for (let a = 0.15; a <= 4.0; a += 0.1) {
      const e = err({ home: h, away: a });
      if (e < bestErr) {
        bestErr = e;
        best = { home: h, away: a };
      }
    }
  }

  for (let h = best.home - 0.1; h <= best.home + 0.1; h += 0.02) {
    for (let a = best.away - 0.1; a <= best.away + 0.1; a += 0.02) {
      if (h <= 0 || a <= 0) continue;
      const e = err({ home: h, away: a });
      if (e < bestErr) {
        bestErr = e;
        best = { home: h, away: a };
      }
    }
  }

  if (fitCache.size > 500) fitCache.clear();
  fitCache.set(key, best);
  return best;
}

function price(p: number): number {
  const safe = Math.min(0.95, Math.max(0.0015, p * MARGIN));
  return Math.round((1 / safe) * 100) / 100;
}

/** Goal rates implied by a 1X2 price, with the overround stripped first. */
export function ratesFromOdds(home: number, draw: number, away: number): Rates {
  const ph = 1 / home;
  const pd = 1 / draw;
  const pa = 1 / away;
  const total = ph + pd + pa;
  return fitRates(ph / total, pd / total, pa / total);
}

/**
 * The full scoreline grid, ordered by likelihood so the shortest prices sit
 * first — which is the order a player scans them in.
 */
export function correctScoreMarket(home: number, draw: number, away: number): Market {
  const rates = ratesFromOdds(home, draw, away);

  const cells: { outcome: string; p: number }[] = [];
  let covered = 0;

  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poisson(i, rates.home) * poisson(j, rates.away);
      covered += p;
      cells.push({ outcome: `${i}:${j}`, p });
    }
  }

  cells.sort((a, b) => b.p - a.p);

  const prices: Price[] = cells
    .filter((c) => c.p > 0.0015)
    .map((c) => ({ outcome: c.outcome, label: c.outcome, odds: price(c.p) }));

  // Everything past the grid collapses into one outcome. It is always offered,
  // however remote — without it a freak 8-2 has no winning outcome at all and
  // the market stops being exhaustive.
  const other = Math.max(0, 1 - covered);
  prices.push({ outcome: "Any Other", label: "Any other", odds: price(other) });

  return { key: "cs", label: "Correct Score", group: "specials", dense: true, prices };
}

/** Share of a side's goals expected before half time. */
const FIRST_HALF_SHARE = 0.45;
const GRID = 7;

type Side = "Home" | "Draw" | "Away";
const SIDES: Side[] = ["Home", "Draw", "Away"];
const SHORT: Record<Side, string> = { Home: "1", Draw: "X", Away: "2" };
const sideOf = (h: number, a: number): Side => (h > a ? "Home" : h < a ? "Away" : "Draw");

function overUnderPrices(dist: number[], lines: number[]): Price[] {
  const out: Price[] = [];
  for (const l of lines) {
    const over = dist.reduce((acc, p, t) => (t > l ? acc + p : acc), 0);
    out.push({ outcome: `Over ${l}`, label: `Over ${l}`, odds: price(over) });
    out.push({ outcome: `Under ${l}`, label: `Under ${l}`, odds: price(1 - over) });
  }
  return out;
}

function sidePrices(p: Record<Side, number>): Price[] {
  return SIDES.map((s) => ({ outcome: s, label: s, odds: price(p[s]) }));
}

/**
 * Half-time, HT/FT, team and combination markets, all read off the same fitted
 * model as the correct score. Keys and outcome spellings follow the upstream
 * book (`af7` "Home/Draw", `af6` "Over 0.5"), so settlement judges them with
 * the rules it already has.
 */
export function extraMarkets(home: number, draw: number, away: number): Market[] {
  const rates = ratesFromOdds(home, draw, away);
  const h1 = { home: rates.home * FIRST_HALF_SHARE, away: rates.away * FIRST_HALF_SHARE };
  const h2 = { home: rates.home - h1.home, away: rates.away - h1.away };

  const pois = (lambda: number) => Array.from({ length: GRID + 1 }, (_, k) => poisson(k, lambda));
  const [a1, b1, a2, b2] = [pois(h1.home), pois(h1.away), pois(h2.home), pois(h2.away)];
  const [ft, fa] = [pois(rates.home), pois(rates.away)];

  const htft: Record<string, number> = {};
  const half1 = { Home: 0, Draw: 0, Away: 0 };
  const half2 = { Home: 0, Draw: 0, Away: 0 };
  const halfGoals = { first: 0, second: 0, equal: 0 };
  const bothHalves = { Home: 0, Away: 0 };
  const eitherHalf = { Home: 0, Away: 0 };
  const htTotals: number[] = Array(GRID * 2 + 1).fill(0);
  const htScore: Record<string, number> = {};

  for (let i1 = 0; i1 <= GRID; i1++) {
    for (let j1 = 0; j1 <= GRID; j1++) {
      const pHalf = a1[i1] * b1[j1];
      const first = sideOf(i1, j1);
      half1[first] += pHalf;
      htTotals[i1 + j1] += pHalf;
      const cell = i1 <= 2 && j1 <= 2 ? `${i1}:${j1}` : "Any Other";
      htScore[cell] = (htScore[cell] ?? 0) + pHalf;

      for (let i2 = 0; i2 <= GRID; i2++) {
        for (let j2 = 0; j2 <= GRID; j2++) {
          const p = pHalf * a2[i2] * b2[j2];
          const second = sideOf(i2, j2);
          const key = `${first}/${sideOf(i1 + i2, j1 + j2)}`;
          htft[key] = (htft[key] ?? 0) + p;
          half2[second] += p;

          const g1 = i1 + j1;
          const g2 = i2 + j2;
          if (g1 > g2) halfGoals.first += p;
          else if (g2 > g1) halfGoals.second += p;
          else halfGoals.equal += p;

          for (const s of ["Home", "Away"] as const) {
            if (first === s && second === s) bothHalves[s] += p;
            if (first === s || second === s) eitherHalf[s] += p;
          }
        }
      }
    }
  }

  // Full-time joint grid for the team and combination markets.
  const homeTotals = ft;
  const awayTotals = fa;
  const totals: number[] = Array(GRID * 2 + 1).fill(0);
  const resultBtts: Record<string, number> = {};
  let homeClean = 0;
  let awayClean = 0;
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const p = ft[i] * fa[j];
      totals[i + j] += p;
      const key = `${sideOf(i, j)}/${i > 0 && j > 0 ? "Yes" : "No"}`;
      resultBtts[key] = (resultBtts[key] ?? 0) + p;
      if (j === 0) homeClean += p;
      if (i === 0) awayClean += p;
    }
  }

  const yesNo = (p: number): Price[] => [
    { outcome: "Yes", label: "Yes", odds: price(p) },
    { outcome: "No", label: "No", odds: price(1 - p) },
  ];

  return [
    {
      key: "af5",
      label: "More Over / Under",
      group: "goals",
      prices: overUnderPrices(totals, [0.5, 3.5, 4.5, 5.5]),
    },
    {
      key: "af24",
      label: "1X2 & GG / NG",
      group: "goals",
      dense: true,
      prices: SIDES.flatMap((s) =>
        (["Yes", "No"] as const).map((b) => ({
          outcome: `${s}/${b}`,
          label: `${SHORT[s]} & ${b === "Yes" ? "GG" : "NG"}`,
          odds: price(resultBtts[`${s}/${b}`] ?? 0),
        })),
      ),
    },
    {
      key: "af7",
      label: "HT / FT",
      group: "half",
      dense: true,
      prices: SIDES.flatMap((a) =>
        SIDES.map((b) => ({ outcome: `${a}/${b}`, label: `${SHORT[a]}/${SHORT[b]}`, odds: price(htft[`${a}/${b}`] ?? 0) })),
      ),
    },
    { key: "af13", label: "1st Half 1X2", group: "half", prices: sidePrices(half1) },
    { key: "af3", label: "2nd Half 1X2", group: "half", prices: sidePrices(half2) },
    {
      key: "af6",
      label: "1st Half Over / Under",
      group: "half",
      prices: overUnderPrices(htTotals, [0.5, 1.5, 2.5]),
    },
    {
      key: "af31",
      label: "1st Half Correct Score",
      group: "half",
      dense: true,
      prices: Object.entries(htScore)
        .sort((x, y) => (x[0] === "Any Other" ? 1 : y[0] === "Any Other" ? -1 : y[1] - x[1]))
        .map(([outcome, p]) => ({ outcome, label: outcome === "Any Other" ? "Any other" : outcome, odds: price(p) })),
    },
    {
      key: "af11",
      label: "Highest Scoring Half",
      group: "half",
      prices: [
        { outcome: "1st Half", label: "1st half", odds: price(halfGoals.first) },
        { outcome: "2nd Half", label: "2nd half", odds: price(halfGoals.second) },
        { outcome: "Draw", label: "Equal", odds: price(halfGoals.equal) },
      ],
    },
    {
      key: "af32",
      label: "Win Both Halves",
      group: "half",
      prices: (["Home", "Away"] as const).map((s) => ({ outcome: s, label: s, odds: price(bothHalves[s]) })),
    },
    {
      key: "af39",
      label: "Win Either Half",
      group: "half",
      prices: (["Home", "Away"] as const).map((s) => ({ outcome: s, label: s, odds: price(eitherHalf[s]) })),
    },
    { key: "af16", label: "Home Team Over / Under", group: "teams", prices: overUnderPrices(homeTotals, [0.5, 1.5, 2.5]) },
    { key: "af17", label: "Away Team Over / Under", group: "teams", prices: overUnderPrices(awayTotals, [0.5, 1.5, 2.5]) },
    { key: "af27", label: "Clean Sheet - Home", group: "teams", prices: yesNo(homeClean) },
    { key: "af28", label: "Clean Sheet - Away", group: "teams", prices: yesNo(awayClean) },
  ];
}

/** Odd/even and exact-goals markets, from the same fitted model. */
export function goalCountMarkets(home: number, draw: number, away: number): Market[] {
  const rates = ratesFromOdds(home, draw, away);

  const totals: number[] = [];
  for (let t = 0; t <= 10; t++) {
    let p = 0;
    for (let i = 0; i <= t; i++) p += poisson(i, rates.home) * poisson(t - i, rates.away);
    totals[t] = p;
  }

  const odd = totals.reduce((acc, p, t) => (t % 2 === 1 ? acc + p : acc), 0);
  const even = totals.reduce((acc, p, t) => (t % 2 === 0 ? acc + p : acc), 0);

  const exact: Price[] = totals
    .slice(0, 6)
    .map((p, t) => ({ outcome: String(t), label: `${t} goal${t === 1 ? "" : "s"}`, odds: price(p) }))
    .filter((x) => Number.isFinite(x.odds));

  const sixPlus = totals.slice(6).reduce((a, b) => a + b, 0);
  if (sixPlus > 0.0015) {
    exact.push({ outcome: "6+", label: "6 or more", odds: price(sixPlus) });
  }

  return [
    {
      key: "oe",
      label: "Odd / Even",
      group: "goals",
      prices: [
        { outcome: "Odd", label: "Odd", odds: price(odd) },
        { outcome: "Even", label: "Even", odds: price(even) },
      ],
    },
    {
      key: "eg",
      label: "Exact Goals",
      group: "goals",
      dense: true,
      prices: exact,
    },
  ];
}
