alter table public.kas_keluar
  add column if not exists jumlah_beli numeric(14,3),
  add column if not exists harga_satuan numeric(14,2),
  add column if not exists inventory_id uuid references public.inventory(id) on delete set null;

update public.kas_keluar purchase
set inventory_id = inventory.id
from public.inventory
where purchase.inventory_id is null
  and purchase.jumlah_beli > 0
  and purchase.harga_satuan > 0
  and left(purchase.keterangan, char_length('Pembelian bahan baku: ' || inventory.nama_bahan || ' ('))
    = 'Pembelian bahan baku: ' || inventory.nama_bahan || ' (';

create index if not exists kas_keluar_inventory_id_idx
  on public.kas_keluar(inventory_id)
  where inventory_id is not null;

insert into public.akun(kode_akun,nama_akun,tipe,saldo_normal)
values ('5212','Beban Selisih Persediaan','beban','debit')
on conflict (kode_akun) do update
set nama_akun = excluded.nama_akun, tipe = excluded.tipe, saldo_normal = excluded.saldo_normal;

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
    raise exception 'Bahan persediaan tidak ditemukan.';
  end if;

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
    tanggal, akun_id, kategori_id, inventory_id, jumlah, keterangan, ref_transaksi, jumlah_beli, harga_satuan
  )
  values (
    p_tanggal, v_persediaan_akun, v_kategori_id, v_inventory.id, v_total, v_keterangan, v_referensi, v_jumlah, v_harga_satuan
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

create or replace function public.catat_stock_opname(p_items jsonb, p_tanggal date default current_date)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_inventory public.inventory%rowtype;
  v_inventory_id uuid;
  v_stok_fisik numeric(14,2);
  v_selisih numeric(14,2);
  v_harga_rata numeric;
  v_nilai numeric;
  v_akun_persediaan uuid;
  v_akun_beban uuid;
  v_jurnal_id uuid;
  v_referensi text;
  v_keterangan text;
  v_result jsonb := '[]'::jsonb;
  v_jumlah integer;
  v_jumlah_unik integer;
  v_jumlah_jurnal integer := 0;
begin
  if p_tanggal is null or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 500 then
    raise exception 'Tanggal dan daftar bahan stock opname wajib valid.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or item.value->>'inventory_id' is null
      or item.value->>'stok_fisik' is null
  ) then
    raise exception 'Setiap bahan harus memiliki ID dan nilai stok fisik.';
  end if;
  select count(*), count(distinct item.value->>'inventory_id')
    into v_jumlah, v_jumlah_unik
  from jsonb_array_elements(p_items) as item(value);
  if v_jumlah <> v_jumlah_unik then
    raise exception 'Bahan yang sama tidak boleh dikirim lebih dari satu kali.';
  end if;

  select id into strict v_akun_persediaan from public.akun where kode_akun = '1103';
  select id into strict v_akun_beban from public.akun where kode_akun = '5212';

  for v_item in
    select item.value
    from jsonb_array_elements(p_items) as item(value)
    order by item.value->>'inventory_id'
  loop
    v_inventory_id := (v_item->>'inventory_id')::uuid;
    v_stok_fisik := round((v_item->>'stok_fisik')::numeric, 2);
    if v_stok_fisik < 0 or v_stok_fisik > 999999999999 then
      raise exception 'Stok fisik harus berada pada rentang 0 sampai batas maksimum.';
    end if;

    select * into v_inventory
    from public.inventory
    where id = v_inventory_id
    for update;
    if not found then
      raise exception 'Bahan stock opname tidak ditemukan.';
    end if;

    v_selisih := v_stok_fisik - v_inventory.stok_saat_ini;
    v_jurnal_id := null;
    v_nilai := 0;
    if v_selisih <> 0 then
      select coalesce(
        sum(purchase.jumlah_beli * purchase.harga_satuan)
          / nullif(sum(purchase.jumlah_beli), 0),
        0
      )
      into v_harga_rata
      from public.kas_keluar purchase
      where purchase.inventory_id = v_inventory.id
        and purchase.jumlah_beli > 0
        and purchase.harga_satuan > 0;
      if coalesce(v_harga_rata, 0) <= 0 then
        raise exception 'Harga pembelian bahan % belum tersedia; catat pembelian sebelum membuat penyesuaian.', v_inventory.nama_bahan;
      end if;

      v_nilai := round(abs(v_selisih) * v_harga_rata, 2);
      if v_nilai <= 0 then
        raise exception 'Nilai selisih bahan % terlalu kecil untuk dibukukan.', v_inventory.nama_bahan;
      end if;
      if v_nilai > 999999999999 then
        raise exception 'Nilai selisih bahan % melampaui batas pencatatan.', v_inventory.nama_bahan;
      end if;

      v_referensi := 'OPN-' || to_char(p_tanggal, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      v_keterangan := format(
        'Stock Opname %s: sistem %s, fisik %s %s',
        v_inventory.nama_bahan, v_inventory.stok_saat_ini, v_stok_fisik, v_inventory.satuan
      );
      if v_selisih < 0 then
        v_jurnal_id := public.buat_jurnal(
          p_tanggal, v_keterangan, v_referensi,
          jsonb_build_array(
            jsonb_build_object('akun_id', v_akun_beban, 'debit', v_nilai, 'kredit', 0),
            jsonb_build_object('akun_id', v_akun_persediaan, 'debit', 0, 'kredit', v_nilai)
          )
        );
      else
        v_jurnal_id := public.buat_jurnal(
          p_tanggal, v_keterangan, v_referensi,
          jsonb_build_array(
            jsonb_build_object('akun_id', v_akun_persediaan, 'debit', v_nilai, 'kredit', 0),
            jsonb_build_object('akun_id', v_akun_beban, 'debit', 0, 'kredit', v_nilai)
          )
        );
      end if;
      update public.inventory
      set stok_saat_ini = v_stok_fisik
      where id = v_inventory.id;
      v_jumlah_jurnal := v_jumlah_jurnal + 1;
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'inventory_id', v_inventory.id,
      'nama_bahan', v_inventory.nama_bahan,
      'stok_sistem', v_inventory.stok_saat_ini,
      'stok_fisik', v_stok_fisik,
      'selisih', v_selisih,
      'nilai_selisih', v_nilai,
      'jurnal_id', v_jurnal_id
    ));
  end loop;

  return jsonb_build_object('items', v_result, 'jumlah_jurnal', v_jumlah_jurnal);
end;
$$;

revoke all on function public.catat_stock_opname(jsonb,date) from public, anon;
grant execute on function public.catat_stock_opname(jsonb,date) to authenticated;
