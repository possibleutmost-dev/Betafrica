import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { CRASH_MAX, findGame } from "@/lib/casino-catalog";
import { crashPoint, newSeed } from "@/lib/casino";
import { MISSING_TABLE_MESSAGE, isMissingTable, publicRound, readStake, settleCrash, type RoundRow } from "@/lib/casino-rounds";
import { adjustBalance } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/** Take the stake and start a crash round. The crash point stays on the server. */
export async function POST(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: { userId?: string; game?: string; stake?: number; autoCashout?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.userId) return NextResponse.json({ error: "Sign in to play" }, { status: 401 });
  const game = findGame(String(body.game ?? ""));
  if (!game || game.engine !== "crash") return NextResponse.json({ error: "Unknown game" }, { status: 404 });

  const stake = readStake(body.stake);
  if (typeof stake === "string") return NextResponse.json({ error: stake }, { status: 400 });

  let autoCashout: number | null = null;
  if (body.autoCashout != null && String(body.autoCashout) !== "") {
    autoCashout = Math.floor(Number(body.autoCashout) * 100) / 100;
    if (!Number.isFinite(autoCashout) || autoCashout < 1.01 || autoCashout > CRASH_MAX) {
      return NextResponse.json({ error: `Auto cash-out must be between 1.01x and ${CRASH_MAX}x` }, { status: 400 });
    }
  }

  // One live round per game: close anything already over before starting again.
  const { data: open, error: openErr } = await supabase
    .from("game_rounds")
    .select("*")
    .eq("user_id", body.userId)
    .eq("game", game.slug)
    .eq("status", "running");
  if (isMissingTable(openErr)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });

  for (const row of (open ?? []) as RoundRow[]) {
    const { row: after } = await settleCrash(supabase, row);
    if (after.status === "running") {
      return NextResponse.json({ error: "Finish your current round first", round: publicRound(after) }, { status: 409 });
    }
  }

  const debited = await adjustBalance(supabase, body.userId, -stake);
  if (!debited) return NextResponse.json({ error: "Your balance is too low for that stake" }, { status: 402 });

  const { seed, hash } = newSeed();
  const { data: row, error } = await supabase
    .from("game_rounds")
    .insert({
      user_id: body.userId,
      game: game.slug,
      kind: "crash",
      stake,
      currency: debited.currency,
      status: "running",
      crash_point: crashPoint(seed),
      auto_cashout: autoCashout,
      server_seed: seed,
      seed_hash: hash,
      // settleCrash measures elapsed time with this server's clock, so the start must too.
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !row) {
    await adjustBalance(supabase, body.userId, stake);
    if (isMissingTable(error)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    console.error("[casino] crash start failed, stake returned", error);
    return NextResponse.json({ error: "Could not start the round. Your stake was returned." }, { status: 500 });
  }

  return NextResponse.json({ round: publicRound(row as RoundRow), balance: debited.balance, serverNow: Date.now() });
}
