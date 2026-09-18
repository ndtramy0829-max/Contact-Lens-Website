-- Instagram username is optional at checkout; match via order message / ref instead.
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

    v_lines := v_lines || chr(10) || '• ' || v_name || ' x' || v_qty::text;
  end loop;

  if p_contact_method = 'instagram' then
    insert into public.instagram_outbox (
      kind, order_id, instagram_username, body, status
    ) values (
      'order_confirmation',
      v_order_id,
      v_instagram,
      'Thank you for your MYE order ' || v_order_number || '!' || chr(10) || chr(10)
        || 'Total: $' || to_char(v_total, 'FM9990.00')
        || v_lines || chr(10) || chr(10)
        || 'Reply here when you are ready to pay and we will send payment details.'
        || chr(10) || 'Status: waiting for payment.',
      'needs_customer_message'
    );
  end if;

  return query select v_order_id, v_order_number, v_total;
end;
$$;

grant execute on function private.place_order(text, text, text, jsonb, jsonb) to service_role;
