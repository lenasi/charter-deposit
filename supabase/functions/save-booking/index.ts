import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const body = await req.json();
    const {
      clientName, email, charterDate, depositAmount,
      stripeCustomerId, stripePaymentMethodId, mode, notes,
    } = body;

    // Date thresholds (UTC, string-safe ISO comparison)
    const todayStr = new Date().toISOString().split("T")[0];
    const threshold = new Date();
    threshold.setUTCDate(threshold.getUTCDate() + 2);
    const twoDaysFromNowStr = threshold.toISOString().split("T")[0];

    const isImmediateCapture = charterDate <= todayStr;
    const isUrgentHold = charterDate <= twoDaysFromNowStr;

    // Direct postgres connection — bypasses PostgREST entirely
    sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { ssl: "require", max: 1 });

    const [row] = await sql`
      INSERT INTO charter.bookings (
        client_name, email, charter_date, deposit_amount,
        stripe_customer_id, stripe_payment_method_id, status, mode, notes
      ) VALUES (
        ${clientName}, ${email}, ${charterDate},
        ${parseFloat(depositAmount)}, ${stripeCustomerId},
        ${stripePaymentMethodId}, 'card_saved', ${mode || "live"},
        ${notes || null}
      )
      RETURNING id
    `;

    let paymentIntentId: string | null = null;
    let immediateAction: "hold" | "captured" | null = null;

    if (isUrgentHold) {
      const stripeKey = mode === "test"
        ? Deno.env.get("STRIPE_SECRET_KEY_TEST")!
        : Deno.env.get("STRIPE_SECRET_KEY_LIVE")!;
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(depositAmount) * 100),
        currency: "eur",
        customer: stripeCustomerId,
        payment_method: stripePaymentMethodId,
        capture_method: "manual",
        confirm: true,
        off_session: true,
      });
      paymentIntentId = paymentIntent.id;

      if (isImmediateCapture) {
        await stripe.paymentIntents.capture(paymentIntent.id);
        await sql`
          UPDATE charter.bookings
          SET stripe_payment_intent_id = ${paymentIntent.id},
              status = 'captured',
              hold_placed_at = NOW()
          WHERE id = ${row.id}
        `;
        immediateAction = "captured";
      } else {
        await sql`
          UPDATE charter.bookings
          SET stripe_payment_intent_id = ${paymentIntent.id},
              status = 'hold_active',
              hold_placed_at = NOW()
          WHERE id = ${row.id}
        `;
        immediateAction = "hold";
      }
    }

    const extraRows = paymentIntentId
      ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Payment Intent</td><td>${paymentIntentId}</td></tr>`
      : "";

    let subject: string;
    let footer: string;
    let headingColor: string;

    if (immediateAction === "captured") {
      subject = `[Charter] New booking + DEPOSIT CAPTURED — ${clientName}`;
      footer = "Deposit charged immediately — check-in date is today or in the past.";
      headingColor = "#2d7a2d";
    } else if (immediateAction === "hold") {
      subject = `[Charter] New booking + URGENT HOLD — ${clientName}`;
      footer = "Hold placed immediately — check-in date is within 2 days. Hold expires in 7 days if not captured or voided.";
      headingColor = "#b45309";
    } else {
      subject = `[Charter] New booking — ${clientName}`;
      footer = "Card saved. Hold will be placed 2 days before check-in date.";
      headingColor = "#0a2342";
    }

    await sendAdminEmail(
      subject,
      `<h2 style="color:${headingColor}">New booking registered</h2>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td><strong>${clientName}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${email}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Check-in date</td><td>${charterDate}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Deposit</td><td>€${depositAmount}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Mode</td><td>${mode || "live"}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Booking ID</td><td>${row.id}</td></tr>
  ${extraRows}
</table>
<p style="color:#888;font-size:12px;margin-top:16px">${footer}</p>`
    );

    return new Response(
      JSON.stringify({ success: true, bookingId: row.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", String(err));
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (sql) await sql.end();
  }
});
