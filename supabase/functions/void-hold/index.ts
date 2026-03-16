import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { sendAdminEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const { bookingId, paymentIntentId, mode = "live" } = await req.json();

    const stripeKey = mode === "test"
      ? Deno.env.get("STRIPE_SECRET_KEY_TEST")!
      : Deno.env.get("STRIPE_SECRET_KEY_LIVE")!;

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    await stripe.paymentIntents.cancel(paymentIntentId);

    sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { ssl: "require", max: 1 });
    await sql`
      UPDATE charter.bookings SET status = 'voided' WHERE id = ${bookingId}
    `;

    try {
      const [bk] = await sql`
        SELECT client_name, email, charter_date, deposit_amount
        FROM charter.bookings WHERE id = ${bookingId}
      `;
      await sendAdminEmail(
        `[Charter] Hold VOIDED — ${bk.client_name}`,
        `<h2 style="color:#e67e22">Hold voided</h2>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td><strong>${bk.client_name}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${bk.email}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Check-in date</td><td>${bk.charter_date}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Deposit released</td><td>€${bk.deposit_amount}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Mode</td><td>${mode}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Payment Intent</td><td>${paymentIntentId}</td></tr>
</table>
<p style="color:#888;font-size:12px;margin-top:16px">The hold has been cancelled and funds released to the customer.</p>`
      );
    } catch (emailErr) {
      console.error("Email error:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (sql) await sql.end();
  }
});
