-- Almox Predial — banco compartilhado para Supabase
-- Execute este arquivo uma vez no SQL Editor do seu projeto.

create extension if not exists pgcrypto;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 1 and 30),
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (length(trim(category)) between 1 and 60),
  unit text not null check (length(trim(unit)) between 1 and 12),
  location text not null check (length(trim(location)) between 1 and 60),
  min_stock numeric(14, 2) not null default 0 check (min_stock >= 0),
  current_stock numeric(14, 2) not null default 0 check (current_stock >= 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  supplier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  type text not null check (type in ('in', 'out')),
  quantity numeric(14, 2) not null check (quantity > 0),
  requester text,
  document_number text,
  note text,
  stock_after numeric(14, 2) not null check (stock_after >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_category_idx on public.inventory_items(category);
create index if not exists inventory_items_stock_idx on public.inventory_items(current_stock, min_stock);
create index if not exists inventory_movements_item_idx on public.inventory_movements(item_id);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

-- Registra a movimentação e altera o saldo na mesma transação.
create or replace function public.register_inventory_movement(
  p_item_id uuid,
  p_type text,
  p_quantity numeric,
  p_requester text default null,
  p_document_number text default null,
  p_note text default null
)
returns public.inventory_movements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_stock numeric(14, 2);
  v_movement public.inventory_movements%rowtype;
begin
  if p_type not in ('in', 'out') then
    raise exception 'Tipo de movimentação inválido.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item não encontrado.';
  end if;

  if p_type = 'out' and p_quantity > v_item.current_stock then
    raise exception 'Saldo insuficiente. Disponível: % %.', v_item.current_stock, v_item.unit;
  end if;

  v_stock := v_item.current_stock + case when p_type = 'in' then p_quantity else -p_quantity end;

  update public.inventory_items
  set current_stock = v_stock
  where id = p_item_id;

  insert into public.inventory_movements (
    item_id, type, quantity, requester, document_number, note, stock_after
  ) values (
    p_item_id,
    p_type,
    p_quantity,
    nullif(trim(p_requester), ''),
    nullif(trim(p_document_number), ''),
    nullif(trim(p_note), ''),
    v_stock
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "authenticated users read items" on public.inventory_items;
create policy "authenticated users read items"
on public.inventory_items for select
to authenticated
using (true);

drop policy if exists "authenticated users create items" on public.inventory_items;
create policy "authenticated users create items"
on public.inventory_items for insert
to authenticated
with check (true);

drop policy if exists "authenticated users update items" on public.inventory_items;
create policy "authenticated users update items"
on public.inventory_items for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users delete unused items" on public.inventory_items;
create policy "authenticated users delete unused items"
on public.inventory_items for delete
to authenticated
using (true);

drop policy if exists "authenticated users read movements" on public.inventory_movements;
create policy "authenticated users read movements"
on public.inventory_movements for select
to authenticated
using (true);

drop policy if exists "authenticated users create movements" on public.inventory_movements;
create policy "authenticated users create movements"
on public.inventory_movements for insert
to authenticated
with check (created_by = auth.uid());

revoke all on function public.register_inventory_movement(uuid, text, numeric, text, text, text) from public;
grant execute on function public.register_inventory_movement(uuid, text, numeric, text, text, text) to authenticated;

