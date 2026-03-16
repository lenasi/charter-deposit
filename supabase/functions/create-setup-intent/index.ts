import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, mode = "live" } = await req.json();

    const stripeKey = mode === "test"
      ? Deno.env.get("STRIPE_SECRET_KEY_TEST")
      : Deno.env.get("STRIPE_SECRET_KEY_LIVE");

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: `STRIPE_SECRET_KEY_${mode.toUpperCase()} is not set in Edge Function secrets` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stripeKey.startsWith("sk_")) {
      return new Response(
        JSON.stringify({ error: `STRIPE_SECRET_KEY_${mode.toUpperCase()} looks wrong — must start with sk_test_ or sk_live_ (got: ${stripeKey.slice(0, 8)}...)` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const customer = await stripe.customers.create({ email, name });

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ["card"],
    });

    return new Response(
      JSON.stringify({ clientSecret: setupIntent.client_secret, customerId: customer.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
