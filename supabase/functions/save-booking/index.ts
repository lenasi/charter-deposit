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
    const body = await req.json();
    const {
      clientName, email, phone, charterDate, depositAmount,
      stripeCustomerId, stripePaymentMethodId, mode, notes,
    } = body;

    // Direct postgres connection — bypasses PostgREST entirely
    sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { ssl: "require", max: 1 });

    const [row] = await sql`
      INSERT INTO charter.bookings (
        client_name, email, phone, charter_date, deposit_amount,
        stripe_customer_id, stripe_payment_method_id, status, mode, notes
      ) VALUES (
        ${clientName}, ${email}, ${phone}, ${charterDate},
        ${parseFloat(depositAmount)}, ${stripeCustomerId},
        ${stripePaymentMethodId}, 'card_saved', ${mode || "live"},
        ${notes || null}
      )
      RETURNING id
    `;

    await sendAdminEmail(
      `[Charter] New booking — ${clientName}`,
      `<h2>New booking registered</h2>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td><strong>${clientName}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${email}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Phone</td><td>${phone}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Charter date</td><td>${charterDate}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Deposit</td><td>€${depositAmount}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Mode</td><td>${mode || "live"}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Booking ID</td><td>${row.id}</td></tr>
</table>
<p style="color:#888;font-size:12px;margin-top:16px">Card saved. Hold will be placed 2 days before charter date.</p>`
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
