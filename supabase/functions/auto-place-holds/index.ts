import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendAdminEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // pg_cron calls with no body — default to live. Admin "Run now" passes mode.
  let mode = "live";
  try {
    const body = await req.json();
    if (body?.mode) mode = body.mode;
  } catch {
    // no body is fine
  }

  const stripeKey = mode === "test"
    ? Deno.env.get("STRIPE_SECRET_KEY_TEST")!
    : Deno.env.get("STRIPE_SECRET_KEY_LIVE")!;

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  const targetDateStr = targetDate.toISOString().split("T")[0];

  let bookingsFound = 0;
  let bookingsTriggered = 0;
  const processedIds: string[] = [];
  const cronErrors: string[] = [];

  try {
    const { data: bookings, error: fetchError } = await supabase
      .schema("charter")
      .from("bookings")
      .select("*")
      .eq("status", "card_saved")
      .eq("mode", mode)
      .eq("charter_date", targetDateStr);

    if (fetchError) throw fetchError;

    bookingsFound = bookings?.length ?? 0;

    for (const booking of bookings ?? []) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(Number(booking.deposit_amount) * 100),
          currency: "eur",
          customer: booking.stripe_customer_id,
          payment_method: booking.stripe_payment_method_id,
          capture_method: "manual",
          confirm: true,
          off_session: true,
        });

        const { error: updateError } = await supabase
          .schema("charter")
          .from("bookings")
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            status: "hold_active",
            hold_placed_at: new Date().toISOString(),
          })
          .eq("id", booking.id);

        if (updateError) throw updateError;

        bookingsTriggered++;
        processedIds.push(booking.id);
      } catch (err) {
        console.error(`Failed for booking ${booking.id}:`, err.message);
        cronErrors.push(`Booking ${booking.id} (${booking.client_name}): ${err.message}`);
      }
    }

    await supabase.schema("charter").from("cron_logs").insert({
      ran_at: new Date().toISOString(),
      bookings_found: bookingsFound,
      bookings_triggered: bookingsTriggered,
      details: { mode, processed_ids: processedIds },
      status: "ok",
    });

    const successRows = processedIds.map((id, i) => {
      const bk = (bookings ?? []).find((b: { id: string }) => b.id === id);
      return `<tr><td style="padding:3px 12px 3px 0">${bk?.client_name ?? id}</td><td>${bk?.charter_date ?? ""}</td><td>€${bk?.deposit_amount ?? ""}</td></tr>`;
    }).join("");
    const errorRows = cronErrors.map(e => `<li style="color:#c0392b">${e}</li>`).join("");

    await sendAdminEmail(
      `[Charter] Auto-hold cron — ${bookingsTriggered}/${bookingsFound} placed (${mode})`,
      `<h2>Auto-hold cron completed</h2>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Mode</td><td>${mode}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Target date</td><td>${targetDateStr}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Bookings found</td><td>${bookingsFound}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Holds placed</td><td><strong>${bookingsTriggered}</strong></td></tr>
</table>
${bookingsTriggered > 0 ? `<h3>Processed</h3><table style="font-family:sans-serif;font-size:13px;border-collapse:collapse"><tr><th style="text-align:left;padding:3px 12px 3px 0">Name</th><th style="text-align:left;padding:3px 12px 3px 0">Charter date</th><th style="text-align:left">Deposit</th></tr>${successRows}</table>` : ""}
${cronErrors.length > 0 ? `<h3 style="color:#c0392b">Errors (${cronErrors.length})</h3><ul>${errorRows}</ul>` : ""}`
    );

    return new Response(
      JSON.stringify({ bookingsFound, bookingsTriggered, processedIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await supabase.schema("charter").from("cron_logs").insert({
      ran_at: new Date().toISOString(),
      bookings_found: bookingsFound,
      bookings_triggered: bookingsTriggered,
      details: { mode, processed_ids: processedIds },
      status: "error",
      error_message: err.message,
    });

    await sendAdminEmail(
      `[Charter] AUTO-HOLD CRON ERROR (${mode})`,
      `<h2 style="color:#c0392b">Auto-hold cron failed</h2>
<p><strong>Error:</strong> ${err.message}</p>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Mode</td><td>${mode}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Bookings found before error</td><td>${bookingsFound}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Holds placed before error</td><td>${bookingsTriggered}</td></tr>
</table>`
    );

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
