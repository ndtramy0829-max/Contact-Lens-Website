import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-cron-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("place_order", {
      p_delivery: body.delivery,
      p_contact_method: body.contactMethod,
      p_instagram: body.instagram ?? null,
      p_shipping: body.shipping ?? null,
      p_items: body.items ?? [],
    });

    if (error) return json({ error: error.message }, 400);
    const row = Array.isArray(data) ? data[0] : data;
    return json({
      orderId: row.order_id,
      orderNumber: row.order_number,
      total: row.total,
    });
  } catch (err) {
    return json({ error: (err as Error).message ?? "Could not place order" }, 400);
  }
});
