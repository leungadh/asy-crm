-- ============================================================================
-- ASY Beaute — 0013: rename a ledger category without orphaning history
-- ============================================================================
-- ledger_entries.category stores the category NAME as text, not a foreign key.
-- Renaming 租金 to 場地租金 in ledger_categories alone would leave every past
-- row still saying 租金, silently splitting one donut slice into two.
--
-- A function keeps both updates in a single transaction. Doing it as two calls
-- from the browser risks the rename landing and the backfill not.
-- ============================================================================

create or replace function rename_ledger_category(
  p_id         uuid,
  p_new_name_zh text,
  p_new_name_en text
)
returns void
language plpgsql
security invoker           -- runs as the caller, so RLS still applies
set search_path = public
as $$
declare
  v_old      text;
  v_dir      ledger_direction;
  v_system   boolean;
begin
  select name_zh, direction, is_system
    into v_old, v_dir, v_system
    from ledger_categories
   where id = p_id;

  if not found then
    raise exception 'Category not found';
  end if;

  -- The treatment and purchase triggers write '療程收入' and '產品銷售' as
  -- literals. Renaming one would orphan every auto income row.
  if v_system then
    raise exception 'Cannot rename a system category (%). It is written by database triggers.', v_old;
  end if;

  if p_new_name_zh is null or btrim(p_new_name_zh) = '' then
    raise exception 'Category name cannot be empty';
  end if;

  update ledger_entries
     set category = btrim(p_new_name_zh)
   where category = v_old
     and direction = v_dir;

  update ledger_categories
     set name_zh = btrim(p_new_name_zh),
         name_en = coalesce(nullif(btrim(p_new_name_en), ''), btrim(p_new_name_zh))
   where id = p_id;
end $$;

revoke all on function rename_ledger_category(uuid, text, text) from public;
grant execute on function rename_ledger_category(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
