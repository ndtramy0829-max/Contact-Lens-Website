create schema if not exists private;

create table public.products (
  id bigint primary key,
  brand text not null,
  name text not null,
  color text not null,
  dia numeric not null,
  gdia numeric not null,
  axis_lock boolean not null default false,
  price numeric(10,2) not null,
  image text,
  images jsonb not null default '[]'::jsonb,
  available_pairs integer not null default 0 check (available_pairs >= 0),
  sold_pairs integer not null default 0 check (sold_pairs >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id bigint generated always as identity primary key,
  order_number text not null unique,
  delivery_type text not null check (delivery_type in ('pickup', 'shipping')),
  status text not null default 'waiting' check (status in ('waiting', 'complete', 'cancelled')),
  subtotal numeric(10,2) not null,
  shipping_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  contact_method text not null check (contact_method in ('instagram', 'messenger')),
  instagram_username text,
  shipping_address jsonb,
  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);

create index orders_status_placed_at_idx on public.orders (status, placed_at);
create index orders_instagram_username_idx on public.orders (instagram_username);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create table public.waitlist (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  instagram_username text,
  phone text,
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  constraint waitlist_contact_chk check (
    instagram_username is not null or phone is not null
  )
);

create index waitlist_product_id_idx on public.waitlist (product_id);
create index waitlist_status_idx on public.waitlist (status);

create table public.instagram_contacts (
  id bigint generated always as identity primary key,
  igsid text not null unique,
  username text,
  last_seen_at timestamptz not null default now()
);

create index instagram_contacts_username_idx on public.instagram_contacts (username);

create table public.instagram_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('order_confirmation', 'waitlist_restock')),
  order_id bigint references public.orders(id) on delete set null,
  waitlist_id bigint references public.waitlist(id) on delete set null,
  instagram_username text,
  igsid text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'needs_customer_message')),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index instagram_outbox_status_idx on public.instagram_outbox (status);

create table public.admin_sessions (
  id bigint generated always as identity primary key,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row
execute function private.set_updated_at();

create or replace function private.normalize_instagram(handle text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(both from regexp_replace(coalesce(handle, ''), '^@+', ''))), '');
$$;

create or replace function private.generate_order_number(p_delivery text)
returns text
language plpgsql
as $$
declare
  prefix text;
  candidate text;
begin
  prefix := case when p_delivery = 'shipping' then 'Y' else 'M' end;
  loop
    candidate := prefix || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.orders where order_number = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function private.restore_order_stock(p_order_id bigint)
returns void
language plpgsql
as $$
begin
  update public.products p
  set available_pairs = p.available_pairs + i.quantity
  from public.order_items i
  where i.order_id = p_order_id
    and i.product_id = p.id;
end;
$$;

create or replace function private.expire_waiting_orders()
returns integer
language plpgsql
as $$
declare
  expired_count integer := 0;
  rec record;
begin
  for rec in
    select id
    from public.orders
    where status = 'waiting'
      and placed_at < now() - interval '24 hours'
    for update
  loop
    perform private.restore_order_stock(rec.id);
    update public.orders
    set status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'timeout_24h'
    where id = rec.id;
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

create or replace function private.cancel_order(p_order_id bigint, p_reason text)
returns void
language plpgsql
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if current_status is null then
    raise exception 'Order not found';
  end if;

  if current_status <> 'waiting' then
    raise exception 'Only waiting orders can be cancelled';
  end if;

  perform private.restore_order_stock(p_order_id);

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = coalesce(p_reason, 'manual')
  where id = p_order_id;
end;
$$;

create or replace function private.complete_order(p_order_id bigint)
returns void
language plpgsql
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if current_status is null then
    raise exception 'Order not found';
  end if;

  if current_status <> 'waiting' then
    raise exception 'Only waiting orders can be marked complete';
  end if;

  update public.products p
  set sold_pairs = p.sold_pairs + i.quantity
  from public.order_items i
  where i.order_id = p_order_id
    and i.product_id = p.id;

  update public.orders
  set status = 'complete',
      paid_at = now()
  where id = p_order_id;
end;
$$;

create or replace function private.place_order(
  p_delivery text,
  p_contact_method text,
  p_instagram text,
  p_shipping jsonb,
  p_items jsonb
)
returns table(order_id bigint, order_number text, total numeric)
language plpgsql
as $$
declare
  v_order_id bigint;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_shipping numeric(10,2) := 0;
  v_total numeric(10,2);
  v_instagram text;
  item jsonb;
  v_product_id bigint;
  v_qty integer;
  v_price numeric(10,2);
  v_available integer;
  v_name text;
  v_lines text := '';
begin
  perform private.expire_waiting_orders();

  if p_delivery not in ('pickup', 'shipping') then
    raise exception 'Invalid delivery type';
  end if;

  if p_contact_method not in ('instagram', 'messenger') then
    raise exception 'Invalid contact method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  v_instagram := private.normalize_instagram(p_instagram);

  if p_contact_method = 'instagram' and v_instagram is null then
    raise exception 'Instagram username is required';
  end if;

  if p_delivery = 'shipping' then
    v_shipping := 5.00;
    if p_shipping is null
       or coalesce(p_shipping->>'name','') = ''
       or coalesce(p_shipping->>'line1','') = ''
       or coalesce(p_shipping->>'city','') = ''
       or coalesce(p_shipping->>'state','') = ''
       or coalesce(p_shipping->>'zip','') = '' then
      raise exception 'Shipping address is incomplete';
    end if;
  else
    p_shipping := null;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (item->>'id')::bigint;
    v_qty := (item->>'quantity')::integer;

    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid quantity';
    end if;

    select price, available_pairs, name
      into v_price, v_available, v_name
    from public.products
    where id = v_product_id
    for update;

    if v_price is null then
      raise exception 'Product not found';
    end if;

    if v_available < v_qty then
      raise exception '% is sold out', v_name;
    end if;

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  v_total := v_subtotal + v_shipping;
  v_order_number := private.generate_order_number(p_delivery);

  insert into public.orders (
    order_number, delivery_type, status, subtotal, shipping_fee, total,
    contact_method, instagram_username, shipping_address
  ) values (
    v_order_number, p_delivery, 'waiting', v_subtotal, v_shipping, v_total,
    p_contact_method, v_instagram, p_shipping
  )
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (item->>'id')::bigint;
    v_qty := (item->>'quantity')::integer;

    select price, name into v_price, v_name
    from public.products
    where id = v_product_id;

    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product_id, v_qty, v_price);

    update public.products
    set available_pairs = available_pairs - v_qty
    where id = v_product_id;

    v_lines := v_lines || chr(10) || v_name || ' x' || v_qty::text;
  end loop;

  if p_contact_method = 'instagram' then
    insert into public.instagram_outbox (
      kind, order_id, instagram_username, body, status
    ) values (
      'order_confirmation',
      v_order_id,
      v_instagram,
      'Thank you for your MYE order ' || v_order_number || '!' || chr(10)
        || 'Total: $' || to_char(v_total, 'FM9990.00')
        || v_lines || chr(10)
        || 'Status: waiting for payment confirmation.',
      'needs_customer_message'
    );
  end if;

  return query select v_order_id, v_order_number, v_total;
end;
$$;

revoke all on function private.normalize_instagram(text) from public, anon, authenticated;
revoke all on function private.generate_order_number(text) from public, anon, authenticated;
revoke all on function private.restore_order_stock(bigint) from public, anon, authenticated;
revoke all on function private.expire_waiting_orders() from public, anon, authenticated;
revoke all on function private.cancel_order(bigint, text) from public, anon, authenticated;
revoke all on function private.complete_order(bigint) from public, anon, authenticated;
revoke all on function private.place_order(text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

grant execute on function private.expire_waiting_orders() to service_role;
grant execute on function private.cancel_order(bigint, text) to service_role;
grant execute on function private.complete_order(bigint) to service_role;
grant execute on function private.place_order(text, text, text, jsonb, jsonb) to service_role;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.waitlist enable row level security;
alter table public.instagram_contacts enable row level security;
alter table public.instagram_outbox enable row level security;
alter table public.admin_sessions enable row level security;

grant usage on schema public to anon, authenticated;

revoke all on public.products from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.waitlist from anon, authenticated;
revoke all on public.instagram_contacts from anon, authenticated;
revoke all on public.instagram_outbox from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;

grant select on public.products to anon, authenticated;

create policy products_public_read
on public.products
for select
to anon, authenticated
using (true);
