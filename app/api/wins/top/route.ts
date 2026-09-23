import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Today's biggest settled winning tickets, with the winner's name masked. */
export async function GET() {
  const supabase = db();
  if (!supabase) return NextResponse.json({ wins: [] });

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data: bets, error } = await supabase
    .from("bets")
    .select("code, payout, potential_win, currency, user_id, settled_at")
    .eq("status", "won")
    .gte("settled_at", since.toISOString())
    .order("payout", { ascending: false })
    .limit(12);

  if (error || !bets?.length) return NextResponse.json({ wins: [] });

  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("id", [...new Set(bets.map((b) => b.user_id))]);

  const names = new Map((users ?? []).map((u) => [u.id, String(u.name ?? "")]));
  const mask = (name: string) => (name ? `${name[0].toUpperCase()}****${name.length > 1 ? name[name.length - 1] : ""}` : "****");

  return NextResponse.json({
    wins: bets.map((b) => ({
      code: b.code,
      amount: Number(b.payout ?? b.potential_win),
      currency: b.currency,
      name: mask(names.get(b.user_id) ?? ""),
    })),
  });
}
