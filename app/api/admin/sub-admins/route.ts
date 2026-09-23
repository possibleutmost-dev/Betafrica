import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { referralCode } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** Approve partners, read their payout details, settle commission. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: partners } = await supabase
    .from("sub_admins")
    .select("id, name, email, phone, referral_code, approved, balances, lifetime, payout_name, payout_network, payout_number, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // Referred-player counts, so the operator can see who is actually working.
  const { data: counts } = await supabase.from("users").select("referred_by").not("referred_by", "is", null);
  const byPartner = new Map<string, number>();
  for (const row of counts ?? []) {
    byPartner.set(row.referred_by, (byPartner.get(row.referred_by) ?? 0) + 1);
  }

  return NextResponse.json({
    partners: (partners ?? []).map((p) => ({ ...p, referredPlayers: byPartner.get(p.id) ?? 0 })),
  });
}

/** The operator opens a sub-admin account directly. It starts approved. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!name || !email || !password) return NextResponse.json({ error: "Fill in name, email and password" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const { data: existing } = await supabase.from("sub_admins").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "That email already has an account" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("sub_admins")
      .insert({
        name,
        email,
        phone: String(body?.phone ?? "").trim() || null,
        password_hash: passwordHash,
        referral_code: referralCode(),
        approved: true,
      })
      .select("id, name, email, referral_code, approved")
      .single();
    if (!error && data) return NextResponse.json({ partner: data });
    if ((error as { code?: string } | null)?.code !== "23505") {
      console.error("[admin] create sub-admin failed", error);
      return NextResponse.json({ error: "Could not create the sub-admin" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not create the sub-admin" }, { status: 500 });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.action) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (body.action === "approve" || body.action === "revoke") {
    await supabase.from("sub_admins").update({ approved: body.action === "approve" }).eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "settle") {
    // Settling zeroes the currency's balance but leaves the lifetime total, so
    // the partner keeps a record of everything they have ever earned.
    const currency = String(body.currency ?? "");
    const { data: partner } = await supabase
      .from("sub_admins")
      .select("balances")
      .eq("id", body.id)
      .maybeSingle();

    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const balances = { ...((partner.balances ?? {}) as Record<string, number>) };
    const settled = balances[currency] ?? 0;
    balances[currency] = 0;

    await supabase.from("sub_admins").update({ balances }).eq("id", body.id);
    console.info("[admin] commission settled", { partner: body.id, currency, settled });
    return NextResponse.json({ ok: true, settled });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
