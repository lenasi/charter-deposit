import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const { bookingId, paymentMethodId, customerId, amount, mode = "live" } = await req.json();

    const stripeKey = mode === "test"
      ? Deno.env.get("STRIPE_SECRET_KEY_TEST")!
      : Deno.env.get("STRIPE_SECRET_KEY_LIVE")!;

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "eur",
      customer: customerId,
      payment_method: paymentMethodId,
      capture_method: "manual",
      confirm: true,
      off_session: true,
    });

    sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { ssl: "require", max: 1 });
    await sql`
      UPDATE charter.bookings
      SET stripe_payment_intent_id = ${paymentIntent.id},
          status = 'hold_active',
          hold_placed_at = NOW()
      WHERE id = ${bookingId}
    `;

    console.log("PI created:", paymentIntent.id, "status:", paymentIntent.status);

    return new Response(
      JSON.stringify({ paymentIntentId: paymentIntent.id }),
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
