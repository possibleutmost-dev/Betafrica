import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-guard";
import { CONFIG_FIELDS, invalidateConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Plain values the console shows and edits as they are. */
const PLAIN_KEYS = [
  "deposit_account_name",
  "deposit_account_number",
  "deposit_account_network",
  "support_whatsapp",
  "support_email",
  "license_text",
];
const SECRET_KEYS = new Set(CONFIG_FIELDS.filter((f) => f.secret).map((f) => f.key));
const EDITABLE = new Set([...PLAIN_KEYS, ...CONFIG_FIELDS.map((f) => f.key)]);

function mask(value: string) {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

/**
 * Operator-editable settings. Secret values are write-only: the console gets a
 * masked tail to recognise a key by, never the key itself.
 */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data } = await supabase.from("app_settings").select("key, value").in("key", [...EDITABLE]);
  const saved = Object.fromEntries((data ?? []).filter((r) => r.value?.trim()).map((r) => [r.key, String(r.value)]));

  const settings: Record<string, string> = {};
  const status: Record<string, { saved: string | null; inEnv: boolean }> = {};
  for (const key of EDITABLE) {
    const value = saved[key];
    if (SECRET_KEYS.has(key)) {
      status[key] = { saved: value ? mask(value) : null, inEnv: Boolean(process.env[key]?.trim()) };
    } else {
      settings[key] = value ?? "";
      status[key] = { saved: value ?? null, inEnv: Boolean(process.env[key]?.trim()) };
    }
  }

  return NextResponse.json({ settings, status });
}

/**
 * Save settings. An empty secret means "leave it as it is"; a key listed in
 * `clear` is removed, which hands it back to the deployment environment.
 */
export async function PUT(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.settings || typeof body.settings !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const entries = Object.entries(body.settings as Record<string, unknown>)
    .filter(([key]) => EDITABLE.has(key))
    .map(([key, value]) => [key, String(value ?? "").trim()] as const);

  const commission = entries.find(([key]) => key === "COMMISSION_PERCENT")?.[1];
  if (commission) {
    const percent = Number(commission);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return NextResponse.json({ error: "Commission must be between 0 and 100" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const rows = entries
    .filter(([key, value]) => !(SECRET_KEYS.has(key) && !value))
    .map(([key, value]) => ({ key, value, updated_at: now }));

  if (rows.length) {
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }

  const clear = Array.isArray(body.clear) ? (body.clear as unknown[]).map(String).filter((key) => EDITABLE.has(key)) : [];
  if (clear.length) {
    const { error } = await supabase.from("app_settings").delete().in("key", clear);
    if (error) return NextResponse.json({ error: "Could not clear settings" }, { status: 500 });
  }

  invalidateConfig();
  return NextResponse.json({ ok: true });
}
