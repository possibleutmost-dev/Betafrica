import type { SupabaseClient } from "@supabase/supabase-js";

const ATTEMPTS = 5;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Move a player's balance by `delta`, guarded on the balance just read so two
 * requests at once cannot both spend the same money. A debit (negative delta)
 * fails rather than taking the balance below zero.
 *
 * Returns the new balance, or null when the player is missing, cannot afford
 * the debit, or the balance kept changing underneath us.
 */
export async function adjustBalance(
  supabase: SupabaseClient,
  userId: string,
  delta: number,
): Promise<{ balance: number; currency: string } | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { data: user } = await supabase
      .from("users")
      .select("balance, currency")
      .eq("id", userId)
      .maybeSingle();
    if (!user) return null;

    const current = Number(user.balance);
    const next = round2(current + delta);
    if (next < 0) return null;

    const { data: updated } = await supabase
      .from("users")
      .update({ balance: next })
      .eq("id", userId)
      .eq("balance", current)
      .select("id")
      .maybeSingle();

    if (updated) return { balance: next, currency: String(user.currency) };
  }
  return null;
}
