begin;

alter table public.inventory
  add column if not exists no_referensi text not null default '';

create or replace function public.kembalikan_stok_resep_penjualan()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resep record;
begin
  if old.produk_id is null then
    return old;
  end if;

  for v_resep in
    select inventory_id, jumlah_pemakaian
    from public.resep_produk
    where produk_id = old.produk_id
    order by inventory_id
  loop
    update public.inventory
    set stok_saat_ini = stok_saat_ini + (v_resep.jumlah_pemakaian * old.qty)
    where id = v_resep.inventory_id;
  end loop;

  return old;
end;
$$;

drop trigger if exists kembalikan_stok_resep_penjualan on public.detail_penjualan;
create trigger kembalikan_stok_resep_penjualan
after delete on public.detail_penjualan
for each row execute function public.kembalikan_stok_resep_penjualan();

create or replace function public.ubah_penjualan(
  p_no_transaksi text,
  p_tanggal date,
  p_metode_bayar text,
  p_total numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale public.transaksi_penjualan%rowtype;
  v_old_subtotal numeric;
  v_old_total numeric;
  v_new_subtotal numeric(14,2);
  v_new_ppn numeric(14,2);
  v_subtotal_left numeric(14,2);
  v_ppn_left numeric(14,2);
  v_line_count integer;
  v_index integer := 0;
  v_line record;
  v_line_subtotal numeric(14,2);
  v_line_ppn numeric(14,2);
  v_kas uuid;
  v_pendapatan uuid;
  v_utang_ppn uuid;
  v_baris jsonb;
begin
  if p_tanggal is null or p_metode_bayar is null or p_metode_bayar not in ('Tunai', 'QRIS')
    or p_total is null or p_total <= 0 or p_total > 999999999999 then
    raise exception 'Tanggal, metode pembayaran, atau nominal penjualan tidak valid.';
  end if;

  select * into v_sale
  from public.transaksi_penjualan
  where no_transaksi = p_no_transaksi
  for update;
  if not found then
    raise exception 'Transaksi penjualan tidak ditemukan.';
  end if;

  select coalesce(sum(subtotal), 0), count(*)
  into v_old_subtotal, v_line_count
  from public.detail_penjualan
  where penjualan_id = v_sale.id;
  if v_line_count = 0 or v_sale.total <= 0 then
    raise exception 'Penjualan tanpa rincian produk tidak dapat diubah.';
  end if;

  v_old_total := v_sale.total;
  v_new_subtotal := round(p_total * v_old_subtotal / v_old_total, 2);
  v_new_ppn := p_total - v_new_subtotal;
  v_subtotal_left := v_new_subtotal;
  v_ppn_left := v_new_ppn;

  for v_line in
    select id, qty, subtotal, ppn_item
    from public.detail_penjualan
    where penjualan_id = v_sale.id
    order by created_at, id
  loop
    v_index := v_index + 1;
    if v_index = v_line_count then
      v_line_subtotal := v_subtotal_left;
      v_line_ppn := v_ppn_left;
    else
      v_line_subtotal := case when v_old_subtotal > 0
        then round(v_new_subtotal * v_line.subtotal / v_old_subtotal, 2)
        else round(v_new_subtotal / v_line_count, 2) end;
      v_line_ppn := case when v_sale.ppn > 0
        then round(v_new_ppn * v_line.ppn_item / v_sale.ppn, 2)
        else round(v_new_ppn / v_line_count, 2) end;
      v_subtotal_left := v_subtotal_left - v_line_subtotal;
      v_ppn_left := v_ppn_left - v_line_ppn;
    end if;

    update public.detail_penjualan
    set subtotal = v_line_subtotal,
        ppn_item = v_line_ppn,
        harga_satuan = round(v_line_subtotal / v_line.qty, 2)
    where id = v_line.id;
  end loop;

  update public.transaksi_penjualan
  set tanggal = p_tanggal,
      metode_bayar = trim(p_metode_bayar),
      subtotal = v_new_subtotal,
      ppn = v_new_ppn,
      total = p_total
  where id = v_sale.id;

  select id into strict v_kas from public.akun where kode_akun = '1101';
  select id into strict v_pendapatan from public.akun where kode_akun = '4101';
  select id into strict v_utang_ppn from public.akun where kode_akun = '2102';
  v_baris := jsonb_build_array(
    jsonb_build_object('akun_id', v_kas, 'debit', p_total, 'kredit', 0),
    jsonb_build_object('akun_id', v_pendapatan, 'debit', 0, 'kredit', v_new_subtotal)
  );
  if v_new_ppn > 0 then
    v_baris := v_baris || jsonb_build_array(
      jsonb_build_object('akun_id', v_utang_ppn, 'debit', 0, 'kredit', v_new_ppn)
    );
  end if;
  perform public.buat_jurnal(p_tanggal, 'Penjualan cafe', 'penjualan:' || v_sale.id::text, v_baris);
  return v_sale.id;
end;
$$;

create or replace function public.hapus_penjualan(p_no_transaksi text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.transaksi_penjualan
  where no_transaksi = p_no_transaksi
  for update;
  if not found then
    raise exception 'Transaksi penjualan tidak ditemukan.';
  end if;

  delete from public.jurnal_umum
  where ref_transaksi = 'penjualan:' || v_id::text;
  delete from public.transaksi_penjualan where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.ubah_penjualan(text, date, text, numeric),
  public.hapus_penjualan(text) from public, anon;
grant execute on function public.ubah_penjualan(text, date, text, numeric),
  public.hapus_penjualan(text),
  public.buat_jurnal(date, text, text, jsonb),
  public.kembalikan_stok_resep_penjualan() to authenticated;

commit;
