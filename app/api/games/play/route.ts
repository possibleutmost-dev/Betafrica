import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { findGame } from "@/lib/casino-catalog";
import { PickError, newSeed, playInstant } from "@/lib/casino";
import { MISSING_TABLE_MESSAGE, isMissingTable, publicRound, readStake, type RoundRow } from "@/lib/casino-rounds";
import { adjustBalance } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One instant round: take the stake, decide the result, pay any win. */
export async function POST(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: { userId?: string; game?: string; stake?: number; pick?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.userId) return NextResponse.json({ error: "Sign in to play" }, { status: 401 });
  const game = findGame(String(body.game ?? ""));
  if (!game || game.engine === "crash") return NextResponse.json({ error: "Unknown game" }, { status: 404 });

  const stake = readStake(body.stake);
  if (typeof stake === "string") return NextResponse.json({ error: stake }, { status: 400 });

  const { seed, hash } = newSeed();
  let result;
  try {
    result = playInstant(game.engine, seed, body.pick ?? {});
  } catch (err) {
    if (err instanceof PickError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const debited = await adjustBalance(supabase, body.userId, -stake);
  if (!debited) return NextResponse.json({ error: "Your balance is too low for that stake" }, { status: 402 });

  const payout = round2(stake * result.multiplier);
  const { data: row, error } = await supabase
    .from("game_rounds")
    .insert({
      user_id: body.userId,
      game: game.slug,
      kind: "instant",
      stake,
      currency: debited.currency,
      status: payout > 0 ? "won" : "lost",
      multiplier: result.multiplier,
      payout,
      server_seed: seed,
      seed_hash: hash,
      pick: body.pick ?? {},
      outcome: result.outcome,
      settled_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !row) {
    await adjustBalance(supabase, body.userId, stake);
    if (isMissingTable(error)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    console.error("[casino] round write failed, stake returned", error);
    return NextResponse.json({ error: "Could not play that round. Your stake was returned." }, { status: 500 });
  }

  let balance = debited.balance;
  if (payout > 0) {
    const credited = await adjustBalance(supabase, body.userId, payout);
    if (credited) balance = credited.balance;
    else console.error("[casino] payout failed", row.id, payout);
  }

  return NextResponse.json({ round: publicRound(row as RoundRow), balance });
}
