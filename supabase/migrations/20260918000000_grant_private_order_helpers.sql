-- place_order runs as service_role (SECURITY INVOKER) and calls these helpers.
grant execute on function private.normalize_instagram(text) to service_role;
grant execute on function private.generate_order_number(text) to service_role;
grant execute on function private.restore_order_stock(bigint) to service_role;
