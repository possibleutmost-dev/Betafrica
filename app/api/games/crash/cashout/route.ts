import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { publicRound, settleCrash, type RoundRow } from "@/lib/casino-rounds";

export const dynamic = "force-dynamic";

/** Cash out a running crash round at the multiplier the server sees right now. */
export async function POST(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: { userId?: string; roundId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.userId || !body.roundId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: row } = await supabase.from("game_rounds").select("*").eq("id", body.roundId).maybeSingle();
  if (!row || row.user_id !== body.userId) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const { row: after, balance } = await settleCrash(supabase, row as RoundRow, Date.now());
  return NextResponse.json({ round: publicRound(after), balance, serverNow: Date.now() });
}
