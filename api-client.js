function createBrowserSupabase() {
  if (!window.supabase) return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function callShopFunction(name, body, extraHeaders = {}) {
  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body ?? {}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

async function loadProductStockMap() {
  const client = createBrowserSupabase();
  if (!client) return {};

  const { data, error } = await client
    .from('products')
    .select('id, available_pairs, sold_pairs');

  if (error || !data) return {};

  const map = {};
  data.forEach((row) => {
    map[row.id] = {
      available: Number(row.available_pairs) || 0,
      sold: Number(row.sold_pairs) || 0,
    };
  });
  return map;
}
