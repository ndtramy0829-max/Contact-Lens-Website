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

function normalizeInstagram(handle: string | null) {
  if (!handle) return null;
  const value = handle.trim().replace(/^@+/, "").toLowerCase();
  return value || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const productId = Number(body.productId);
    const instagram = normalizeInstagram(body.instagram ?? null);
    const phone = (body.phone ?? "").trim() || null;

    if (!productId || (!instagram && !phone)) {
      return json({ error: "Instagram username or phone number is required" }, 400);
    }

    const supabase = serviceClient();
    const { data: product } = await supabase
      .from("products")
      .select("id, available_pairs, name")
      .eq("id", productId)
      .single();

    if (!product) return json({ error: "Product not found" }, 404);
    if ((product.available_pairs ?? 0) > 0) {
      return json({ error: "This product is still in stock" }, 400);
    }

    const { error } = await supabase.from("waitlist").insert({
      product_id: productId,
      instagram_username: instagram,
      phone,
      status: "waiting",
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message ?? "Could not join waitlist" }, 400);
  }
});
