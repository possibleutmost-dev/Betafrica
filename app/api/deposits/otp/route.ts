import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { refreshConfig } from "@/lib/config";
import { edibytesResend, edibytesVerifyOtp } from "@/lib/gateways";

export const dynamic = "force-dynamic";

/**
 * The SMS code some networks (Telecel, AirtelTigo) send instead of a PIN
 * prompt, or a request to send it again. Only for the player's own pending
 * Edibytes deposit. Nothing is credited here: once the code is accepted, the
 * waiting screen's status poll sees the payment confirmed and credits it.
 */
export async function POST(req: Request) {
  await refreshConfig();
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: { userId?: string; reference?: string; code?: string; action?: "verify" | "resend"; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { userId, reference } = body;
  if (!userId || !reference) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: payment } = await supabase
    .from("payments")
    .select("reference, user_id, provider, status, users(phone)")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment || payment.user_id !== userId || payment.provider !== "edibytes") {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }
  if (payment.status !== "pending") {
    return NextResponse.json({ error: "This deposit is already finished" }, { status: 409 });
  }

  if (body.action === "resend") {
    const owner = payment.users as { phone?: string } | { phone?: string }[] | null;
    const phone = body.phone?.replace(/\D/g, "") || (Array.isArray(owner) ? owner[0]?.phone : owner?.phone) || "";
    const result = await edibytesResend(reference, phone);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 502 });
  }

  const code = String(body.code ?? "").replace(/\s/g, "");
  if (!/^\d{4,8}$/.test(code)) return NextResponse.json({ error: "Enter the code from the SMS" }, { status: 400 });

  const result = await edibytesVerifyOtp(reference, code);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
