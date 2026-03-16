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
    const { bookingId } = await req.json();

    sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { ssl: "require", max: 1 });

    const result = await sql`
      DELETE FROM charter.bookings WHERE id = ${bookingId} RETURNING id
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
