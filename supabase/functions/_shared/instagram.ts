import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export function normalizeInstagram(handle: string | null) {
  if (!handle) return null;
  const value = handle.trim().replace(/^@+/, "").toLowerCase();
  return value || null;
}

export function instagramConfigured() {
  return Boolean(
    Deno.env.get("INSTAGRAM_ACCESS_TOKEN") && Deno.env.get("INSTAGRAM_IG_USER_ID"),
  );
}

export async function graphGet(path: string) {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";
  const url =
    `https://graph.facebook.com/v21.0/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  return await res.json();
}

export async function sendInstagram(igsid: string, text: string) {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";
  const igUserId = Deno.env.get("INSTAGRAM_IG_USER_ID") ?? "";
  if (!token || !igUserId) {
    return { error: { message: "Instagram messaging is not configured" } };
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text },
      access_token: token,
    }),
  });
  return await res.json();
}

export async function lookupIgsidByUsername(
  supabase: SupabaseClient,
  username: string | null,
): Promise<string | null> {
  const handle = normalizeInstagram(username);
  if (!handle) return null;
  const { data } = await supabase
    .from("instagram_contacts")
    .select("igsid")
    .eq("username", handle)
    .maybeSingle();
  return data?.igsid ?? null;
}

export async function sendOutboxRow(
  supabase: SupabaseClient,
  row: { id: number; body: string; instagram_username: string | null },
  igsid: string,
) {
  const result = await sendInstagram(igsid, row.body);
  if (result.error) {
    await supabase
      .from("instagram_outbox")
      .update({ status: "failed", last_error: result.error.message, igsid })
      .eq("id", row.id);
    return { sent: 0, failed: 1, error: result.error.message as string };
  }

  await supabase
    .from("instagram_outbox")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      igsid,
      last_error: null,
    })
    .eq("id", row.id);
  return { sent: 1, failed: 0 };
}

export async function flushOutbox(
  supabase: SupabaseClient,
  username: string | null,
  igsid: string,
) {
  const handle = normalizeInstagram(username);
  let query = supabase
    .from("instagram_outbox")
    .select("*")
    .in("status", ["pending", "needs_customer_message"]);
  if (handle) query = query.eq("instagram_username", handle);
  else query = query.eq("igsid", igsid);

  const { data: rows } = await query;
  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const result = await sendOutboxRow(supabase, row, igsid);
    sent += result.sent;
    failed += result.failed;
  }

  return { sent, failed };
}

export function parseOrderRef(ref: string | null | undefined) {
  if (!ref) return null;
  const match = String(ref).trim().toUpperCase().match(/^ORDER_([MY]\d{4})$/);
  return match?.[1] ?? null;
}

export async function flushOutboxByOrderNumber(
  supabase: SupabaseClient,
  orderNumber: string,
  igsid: string,
) {
  const { data: order } = await supabase
    .from("orders")
    .select("id, instagram_username")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) return { sent: 0, failed: 0 };

  const { data: rows } = await supabase
    .from("instagram_outbox")
    .select("*")
    .eq("order_id", order.id)
    .in("status", ["pending", "needs_customer_message"]);

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const result = await sendOutboxRow(supabase, row, igsid);
    sent += result.sent;
    failed += result.failed;
  }

  // Also flush any other queued messages for this username
  if (order.instagram_username) {
    const extra = await flushOutbox(supabase, order.instagram_username, igsid);
    sent += extra.sent;
    failed += extra.failed;
  }

  return { sent, failed };
}

export async function tryFlushByUsername(
  supabase: SupabaseClient,
  username: string | null,
) {
  const igsid = await lookupIgsidByUsername(supabase, username);
  if (!igsid) return { sent: 0, failed: 0, needsCustomerMessage: true };
  const result = await flushOutbox(supabase, username, igsid);
  return { ...result, needsCustomerMessage: false };
}

export async function verifyWebhookSignature(
  req: Request,
  rawBody: string,
): Promise<boolean> {
  const secret = Deno.env.get("INSTAGRAM_APP_SECRET");
  if (!secret) return true;

  const signature = req.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" +
    [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signature === expected;
}
