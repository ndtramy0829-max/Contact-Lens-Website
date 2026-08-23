import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

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

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireAdmin(req: Request, supabase: SupabaseClient) {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token) throw new Error("Not signed in");
  const hash = await sha256(token);
  const { data } = await supabase
    .from("admin_sessions")
    .select("id, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) {
    throw new Error("Session expired");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = db();
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  try {
    if (action === "login") {
      const expected = Deno.env.get("ADMIN_PASSWORD") ?? "";
      if (!expected || body.password !== expected) {
        return json({ error: "Wrong password" }, 401);
      }
      const token = crypto.randomUUID() + crypto.randomUUID();
      const hash = await sha256(token);
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("admin_sessions").insert({
        token_hash: hash,
        expires_at: expires,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ token });
    }

    await requireAdmin(req, supabase);
    await supabase.rpc("expire_waiting_orders");

    if (action === "list-inventory") {
      const { data, error } = await supabase
        .from("products")
        .select("id, brand, name, available_pairs, sold_pairs")
        .order("brand")
        .order("name");
      if (error) throw error;
      return json({ products: data });
    }

    if (action === "update-stock") {
      const { error } = await supabase
        .from("products")
        .update({ available_pairs: Number(body.availablePairs) })
        .eq("id", Number(body.productId));
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "list-orders") {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .order("placed_at", { ascending: false });
      if (error) throw error;
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, quantity, product_id, products(name)");
      const byOrder: Record<string, { name: string; quantity: number }[]> = {};
      (items ?? []).forEach((row: Record<string, unknown>) => {
        const product = row.products as { name?: string } | null;
        const id = String(row.order_id);
        byOrder[id] ??= [];
        byOrder[id].push({ name: product?.name ?? "Item", quantity: Number(row.quantity) });
      });
      return json({
        orders: (orders ?? []).map((order) => ({
          ...order,
          items: byOrder[String(order.id)] ?? [],
        })),
      });
    }

    if (action === "complete-order") {
      const { error } = await supabase.rpc("complete_order", {
        p_order_id: Number(body.orderId),
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "cancel-order") {
      const { error } = await supabase.rpc("cancel_order", {
        p_order_id: Number(body.orderId),
        p_reason: "manual",
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "list-waitlist") {
      const { data, error } = await supabase
        .from("waitlist")
        .select("id, instagram_username, phone, status, created_at, product_id, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({
        waitlist: (data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          product_name: (row.products as { name?: string } | null)?.name ?? "",
        })),
      });
    }

    if (action === "notify-waitlist") {
      const productId = Number(body.productId);
      const { data: product } = await supabase
        .from("products")
        .select("name, available_pairs")
        .eq("id", productId)
        .single();
      const { data: entries, error } = await supabase
        .from("waitlist")
        .select("id, instagram_username")
        .eq("product_id", productId)
        .eq("status", "waiting");
      if (error) throw error;

      for (const entry of entries ?? []) {
        if (entry.instagram_username) {
          await supabase.from("instagram_outbox").insert({
            kind: "waitlist_restock",
            waitlist_id: entry.id,
            instagram_username: entry.instagram_username,
            body: `${product?.name ?? "A lens"} is back in stock at MYE. Message @mye.lenses.shop to claim it.`,
            status: "needs_customer_message",
          });
        }
        await supabase
          .from("waitlist")
          .update({ status: "notified", notified_at: new Date().toISOString() })
          .eq("id", entry.id);
      }
      return json({ notified: (entries ?? []).length, inStock: product?.available_pairs ?? 0 });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message ?? "Admin error" }, 400);
  }
});
