import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_STAKE, MIN_STAKE } from "@/lib/casino-catalog";
import { crashStateAt } from "@/lib/casino";
import { adjustBalance } from "@/lib/wallet";

export type RoundRow = {
  id: string;
  user_id: string;
  game: string;
  kind: "crash" | "instant";
  stake: number;
  currency: string;
  status: "running" | "won" | "lost";
  multiplier: number | null;
  payout: number;
  crash_point: number | null;
  auto_cashout: number | null;
  server_seed: string;
  seed_hash: string;
  pick: Record<string, unknown> | null;
  outcome: Record<string, unknown> | null;
  created_at: string;
  settled_at: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function readStake(value: unknown): number | string {
  const stake = round2(Number(value));
  if (!Number.isFinite(stake) || stake < MIN_STAKE) return `The minimum stake is ${MIN_STAKE}`;
  if (stake > MAX_STAKE) return `The maximum stake is ${MAX_STAKE.toLocaleString()}`;
  return stake;
}

/** What the player may see. The seed only leaves the server once the round is over. */
export function publicRound(row: RoundRow) {
  const over = row.status !== "running";
  return {
    id: row.id,
    game: row.game,
    stake: Number(row.stake),
    currency: row.currency,
    status: row.status,
    multiplier: row.multiplier == null ? null : Number(row.multiplier),
    payout: Number(row.payout),
    crashPoint: over && row.crash_point != null ? Number(row.crash_point) : null,
    autoCashout: row.auto_cashout == null ? null : Number(row.auto_cashout),
    pick: row.pick,
    outcome: row.outcome,
    seedHash: row.seed_hash,
    seed: over ? row.server_seed : null,
    startedAt: row.created_at,
    settledAt: row.settled_at,
  };
}

/**
 * Bring a crash round up to date: if the multiplier has already crashed (or
 * passed the auto cash-out) the round is closed and, for a win, paid. The
 * status guard means a round can only ever be closed — and paid — once.
 */
export async function settleCrash(
  supabase: SupabaseClient,
  row: RoundRow,
  cashoutAt?: number,
): Promise<{ row: RoundRow; balance?: number }> {
  if (row.status !== "running" || row.crash_point == null) return { row };

  const elapsed = Date.now() - new Date(row.created_at).getTime();
  const state = crashStateAt(Number(row.crash_point), row.auto_cashout == null ? null : Number(row.auto_cashout), elapsed);

  let status: "won" | "lost";
  let multiplier: number;
  if (state.status === "running") {
    if (cashoutAt === undefined) return { row };
    status = "won";
    multiplier = state.multiplier;
  } else {
    status = state.status;
    multiplier = state.multiplier;
  }

  const payout = status === "won" ? round2(Number(row.stake) * multiplier) : 0;
  const { data: closed } = await supabase
    .from("game_rounds")
    .update({ status, multiplier, payout, settled_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "running")
    .select("*")
    .maybeSingle();

  if (!closed) {
    const { data: fresh } = await supabase.from("game_rounds").select("*").eq("id", row.id).single();
    return { row: (fresh ?? row) as RoundRow };
  }

  if (payout > 0) {
    const credited = await adjustBalance(supabase, row.user_id, payout);
    if (!credited) console.error("[casino] crash payout failed", row.id, payout);
    return { row: closed as RoundRow, balance: credited?.balance };
  }
  return { row: closed as RoundRow };
}

export function isMissingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /game_rounds/.test(error.message ?? "")));
}

export const MISSING_TABLE_MESSAGE = "Casino is not set up yet. Run supabase/migrations/0015_game_rounds.sql in Supabase.";
