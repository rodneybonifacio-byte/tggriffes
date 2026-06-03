-- Enable unaccent for accent-insensitive search
create extension if not exists unaccent;

create or replace function public.search_order_intents(
  p_status text default 'all',
  p_search text default '',
  p_limit int default 50,
  p_offset int default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_norm text;
  v_tokens text[];
  v_count bigint;
  v_rows jsonb;
begin
  if not public.is_admin_or_seller(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  v_norm := lower(unaccent(coalesce(p_search, '')));
  v_tokens := case
    when trim(v_norm) = '' then array[]::text[]
    else regexp_split_to_array(trim(v_norm), '\s+')
  end;

  with base as (
    select oi.*,
      lower(unaccent(
        coalesce(oi.customer_name,'') || ' ' ||
        coalesce(oi.customer_whatsapp,'') || ' ' ||
        coalesce(oi.order_number::text,'') || ' ' ||
        coalesce(oi.dest_cep,'') || ' ' ||
        coalesce(oi.observations,'')
      )) as haystack,
      regexp_replace(coalesce(oi.customer_whatsapp,''), '\D', '', 'g') as phone_digits
    from public.order_intents oi
    where (p_status = 'all' or oi.status = p_status)
  ),
  filtered as (
    select * from base b
    where cardinality(v_tokens) = 0
      or not exists (
        select 1
        from unnest(v_tokens) as t
        where t <> ''
          and position(t in b.haystack) = 0
          and not (t ~ '^\d+$' and position(t in b.phone_digits) > 0)
      )
  )
  select count(*) into v_count from filtered;

  select coalesce(
    jsonb_agg(to_jsonb(x) - 'haystack' - 'phone_digits' order by x.created_at desc),
    '[]'::jsonb
  ) into v_rows
  from (
    select * from filtered
    order by created_at desc
    limit greatest(p_limit, 0)
    offset greatest(p_offset, 0)
  ) x;

  return jsonb_build_object('rows', v_rows, 'total', v_count);
end;
$$;

grant execute on function public.search_order_intents(text, text, int, int) to authenticated;
revoke execute on function public.search_order_intents(text, text, int, int) from anon, public;