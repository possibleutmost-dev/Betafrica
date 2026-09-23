import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { MISSING_TABLE_MESSAGE, isMissingTable, publicRound, settleCrash, type RoundRow } from "@/lib/casino-rounds";

export const dynamic = "force-dynamic";

/** A player's recent rounds, optionally for one game. Running crash rounds come back first. */
export async function GET(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ rounds: [] });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const game = url.searchParams.get("game");
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let query = supabase.from("game_rounds").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (game) query = query.eq("game", game);

  const { data, error } = await query;
  if (isMissingTable(error)) return NextResponse.json({ rounds: [], error: MISSING_TABLE_MESSAGE });
  if (error) return NextResponse.json({ error: "Could not load your rounds" }, { status: 500 });

  const rows = await Promise.all(((data ?? []) as RoundRow[]).map(async (row) => (await settleCrash(supabase, row)).row));
  return NextResponse.json({ rounds: rows.map(publicRound) });
}
