import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Proof for a bank-transfer deposit: the name on the sending account and a
 * receipt. The payment row was opened by /api/deposits/start; this marks it as
 * submitted so it shows in the operator's queue. Nothing is credited here —
 * the operator confirms from the receipt.
 *
 * Receipts go to the private deposit-screenshots bucket and are only ever read
 * back through short-lived signed URLs in the console.
 */
export async function POST(req: Request) {
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const userId = String(form.get("userId") ?? "");
  const reference = String(form.get("reference") ?? "");
  const senderName = String(form.get("senderName") ?? "").trim().slice(0, 80);
  const file = form.get("file");

  if (!userId || !reference) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (senderName.length < 3) return NextResponse.json({ error: "Enter the name on the account you paid from" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Add a screenshot of your transfer receipt" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 5MB" }, { status: 413 });
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, WebP or PDF receipt" }, { status: 415 });

  const { data: payment } = await supabase
    .from("payments")
    .select("reference, user_id, provider, status, metadata")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment || payment.user_id !== userId || payment.provider !== "manual") {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }
  if (payment.status !== "pending") {
    return NextResponse.json({ error: "This deposit has already been reviewed" }, { status: 409 });
  }

  // One receipt per deposit; a resubmission replaces the earlier file.
  const path = `${userId}/${reference}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("deposit-screenshots")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadErr) {
    console.error("[deposit/manual] upload failed", reference, uploadErr);
    return NextResponse.json({ error: "Could not upload your receipt. Try again." }, { status: 500 });
  }

  const metadata = {
    ...((payment.metadata ?? {}) as Record<string, unknown>),
    screenshot: path,
    sender_name: senderName,
    submitted_at: new Date().toISOString(),
  };
  const { error: updateErr } = await supabase.from("payments").update({ metadata }).eq("reference", reference);
  if (updateErr) {
    console.error("[deposit/manual] could not record proof", reference, updateErr);
    return NextResponse.json({ error: "Could not submit your deposit. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
