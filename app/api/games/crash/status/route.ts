import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { publicRound, settleCrash, type RoundRow } from "@/lib/casino-rounds";

export const dynamic = "force-dynamic";

/** Poll a crash round. Closes it (and pays any auto cash-out) once it is over. */
export async function GET(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const roundId = url.searchParams.get("roundId");
  if (!userId || !roundId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: row } = await supabase.from("game_rounds").select("*").eq("id", roundId).maybeSingle();
  if (!row || row.user_id !== userId) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const { row: after, balance } = await settleCrash(supabase, row as RoundRow);
  return NextResponse.json({ round: publicRound(after), balance, serverNow: Date.now() });
}
