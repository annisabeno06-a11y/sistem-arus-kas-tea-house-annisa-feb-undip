alter table public.kas_keluar
  add column if not exists jumlah_beli numeric(14,3),
  add column if not exists harga_satuan numeric(14,2);

create or replace function public.catat_restock_inventory(
  p_inventory_id uuid,
  p_jumlah numeric,
  p_harga_satuan numeric,
  p_tanggal date,
  p_vendor text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_kas_akun uuid;
  v_persediaan_akun uuid;
  v_kategori_id uuid;
  v_jumlah numeric(14,3);
  v_harga_satuan numeric(14,2);
  v_total numeric(14,2);
  v_vendor text;
  v_referensi text;
  v_keterangan text;
  v_kas_keluar_id uuid;
begin
  v_jumlah := round(p_jumlah, 3);
  v_harga_satuan := round(p_harga_satuan, 2);
  v_vendor := btrim(p_vendor);
  if p_inventory_id is null or p_tanggal is null
    or p_jumlah is null or p_jumlah <= 0 or p_jumlah > 999999999999
    or p_harga_satuan is null or p_harga_satuan <= 0 or p_harga_satuan > 999999999999
    or v_vendor is null or char_length(v_vendor) < 1 or char_length(v_vendor) > 160 then
    raise exception 'Bahan, jumlah, harga satuan, tanggal, dan vendor wajib valid.';
  end if;
  if v_jumlah <= 0 or v_harga_satuan <= 0 then
    raise exception 'Jumlah dan harga pembelian terlalu kecil setelah pembulatan.';
  end if;
  v_total := round(v_jumlah * v_harga_satuan, 2);
  if v_total <= 0 or v_total > 999999999999 then
    raise exception 'Total pembelian di luar batas yang diizinkan.';
  end if;

  select * into v_inventory
  from public.inventory
  where id = p_inventory_id
  for update;
  if not found then
    raise exception 'Bahan inventory tidak ditemukan.';
  end if;

  select id into strict v_kas_akun from public.akun where kode_akun = '1101';
  select id into strict v_persediaan_akun from public.akun where kode_akun = '1103';
  select id into v_kategori_id
  from public.kategori
  where jenis = 'keluar'
    and lower(coalesce(nama_kategori, nama)) = 'bahan baku'
  limit 1;

  v_referensi := 'RESTOCK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_keterangan := format(
    'Pembelian bahan baku: %s (%s %s) - Vendor: %s',
    v_inventory.nama_bahan, v_jumlah, v_inventory.satuan, v_vendor
  );

  update public.inventory
  set stok_saat_ini = stok_saat_ini + v_jumlah,
      no_referensi = v_referensi
  where id = v_inventory.id;

  insert into public.kas_keluar(
    tanggal, akun_id, kategori_id, jumlah, keterangan, ref_transaksi, jumlah_beli, harga_satuan
  )
  values (
    p_tanggal, v_persediaan_akun, v_kategori_id, v_total, v_keterangan, v_referensi, v_jumlah, v_harga_satuan
  )
  returning id into v_kas_keluar_id;

  return jsonb_build_object(
    'id', v_kas_keluar_id,
    'referensi', v_referensi,
    'tanggal', p_tanggal,
    'inventory_id', v_inventory.id,
    'nama_bahan', v_inventory.nama_bahan,
    'satuan', v_inventory.satuan,
    'jumlah_beli', v_jumlah,
    'harga_satuan', v_harga_satuan,
    'total', v_total,
    'vendor', v_vendor,
    'keterangan', v_keterangan
  );
end;
$$;

revoke all on function public.catat_restock_inventory(uuid, numeric, numeric, date, text) from public, anon;
grant execute on function public.catat_restock_inventory(uuid, numeric, numeric, date, text) to authenticated;
