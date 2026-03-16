import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

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
