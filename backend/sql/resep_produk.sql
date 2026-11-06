-- Jalankan sekali di Supabase SQL Editor untuk menambahkan resep dan pemotongan stok otomatis.
create table if not exists public.resep_produk (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references public.produk(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  jumlah_pemakaian numeric(14,3) not null check (jumlah_pemakaian > 0),
  created_at timestamptz not null default now(),
  unique (produk_id, inventory_id)
);

alter table public.resep_produk enable row level security;
drop policy if exists "authenticated accounting access" on public.resep_produk;
create policy "authenticated accounting access" on public.resep_produk
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.resep_produk to authenticated;

create or replace function public.potong_stok_resep_penjualan()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_resep record;
begin
  if new.produk_id is null then return new; end if;
  for v_resep in
    select r.inventory_id, r.jumlah_pemakaian, i.nama_bahan
    from public.resep_produk r
    join public.inventory i on i.id=r.inventory_id
    where r.produk_id=new.produk_id
    order by r.inventory_id
  loop
    update public.inventory
    set stok_saat_ini=stok_saat_ini-(v_resep.jumlah_pemakaian*new.qty)
    where id=v_resep.inventory_id
      and stok_saat_ini >= (v_resep.jumlah_pemakaian*new.qty);
    if not found then
      raise exception 'Stok bahan % tidak mencukupi untuk % unit %.',
        v_resep.nama_bahan, new.qty, new.nama_produk_snapshot;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists potong_stok_resep_penjualan on public.detail_penjualan;
create trigger potong_stok_resep_penjualan
after insert on public.detail_penjualan
for each row execute function public.potong_stok_resep_penjualan();
grant execute on function public.potong_stok_resep_penjualan() to authenticated;

create or replace function public.simpan_resep_produk(p_produk_id uuid,p_bahan jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare v_item jsonb; v_inventory_id uuid; v_jumlah numeric;
begin
  if p_bahan is null or jsonb_typeof(p_bahan)<>'array' then
    raise exception 'Daftar bahan resep tidak valid.';
  end if;
  perform 1 from public.produk where id=p_produk_id for key share;
  if not found then raise exception 'Produk tidak ditemukan.'; end if;
  delete from public.resep_produk where produk_id=p_produk_id;
  for v_item in select * from jsonb_array_elements(p_bahan) loop
    v_inventory_id:=(v_item->>'inventory_id')::uuid;
    v_jumlah:=(v_item->>'jumlah_pemakaian')::numeric;
    if v_jumlah<=0 or v_jumlah>1000000000 then
      raise exception 'Jumlah pemakaian bahan harus lebih besar dari nol.';
    end if;
    perform 1 from public.inventory where id=v_inventory_id for key share;
    if not found then raise exception 'Bahan pada resep tidak ditemukan di inventory.'; end if;
    insert into public.resep_produk(produk_id,inventory_id,jumlah_pemakaian)
      values(p_produk_id,v_inventory_id,v_jumlah);
  end loop;
end $$;
revoke all on function public.simpan_resep_produk(uuid,jsonb) from public, anon;
grant execute on function public.simpan_resep_produk(uuid,jsonb) to authenticated;

notify pgrst, 'reload schema';
