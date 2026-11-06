-- Sistem Akuntansi Arus Kas Annisa Beno Cafe
-- Jalankan seluruh skrip ini di Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- Remove modules no longer used by the application. This permanently deletes their source records.
do $$ begin
  if to_regclass('public.penggajian') is not null then
    execute 'drop trigger if exists penggajian_jurnal_insert on public.penggajian';
  end if;
end $$;
drop function if exists public.proses_penggajian(varchar,date,numeric);
drop function if exists public.proses_penggajian(varchar,date);
drop function if exists public.jurnal_penggajian_otomatis();
drop function if exists public.pajak_penghasilan_tahunan(numeric);
drop function if exists public.bayar_pbb(uuid,numeric,date);
drop table if exists public.penggajian;
drop table if exists public.pajak_bangunan;
drop type if exists public.status_pbb;

create table if not exists public.kas (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique check (char_length(trim(nama)) between 2 and 60),
  deskripsi text not null default '',
  warna text not null default '#8b5144' check (warna ~ '^#[0-9A-Fa-f]{6}$'),
  induk_kas_id uuid references public.kas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kas add column if not exists induk_kas_id uuid references public.kas(id) on delete set null;

create table if not exists public.kategori (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique check (char_length(trim(nama)) between 2 and 60),
  jenis text not null check (jenis in ('masuk', 'keluar')),
  warna text not null default '#9a7551' check (warna ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaksi (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  jenis text not null check (jenis in ('masuk', 'keluar', 'transfer')),
  catatan text not null check (char_length(trim(catatan)) between 2 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transaksi drop column if exists created_by;
alter table public.transaksi drop constraint if exists transaksi_jenis_check;
alter table public.transaksi add constraint transaksi_jenis_check check (jenis in ('masuk', 'keluar', 'transfer'));

create table if not exists public.detail_transaksi (
  id uuid primary key default gen_random_uuid(),
  transaksi_id uuid not null references public.transaksi(id) on delete cascade,
  kas_id uuid not null references public.kas(id) on delete restrict,
  kategori_id uuid references public.kategori(id) on delete restrict,
  arah text check (arah in ('masuk', 'keluar')),
  nominal numeric(14, 2) not null check (nominal > 0),
  catatan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.detail_transaksi alter column kategori_id drop not null;
alter table public.detail_transaksi add column if not exists arah text check (arah in ('masuk', 'keluar'));

create or replace function public.simpan_transfer_kas(
  p_transaksi_id uuid,
  p_tanggal date,
  p_catatan text,
  p_kas_sumber_id uuid,
  p_kas_tujuan_id uuid,
  p_nominal numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transaksi_id uuid := coalesce(p_transaksi_id, gen_random_uuid());
begin
  if p_kas_sumber_id = p_kas_tujuan_id then
    raise exception 'Kas sumber dan kas tujuan harus berbeda.';
  end if;
  if p_nominal is null or p_nominal <= 0 then
    raise exception 'Nominal transfer harus lebih besar dari nol.';
  end if;

  if p_transaksi_id is null then
    insert into public.transaksi (id, tanggal, jenis, catatan)
    values (v_transaksi_id, p_tanggal, 'transfer', trim(p_catatan));
  else
    update public.transaksi
    set tanggal = p_tanggal, catatan = trim(p_catatan), jenis = 'transfer'
    where id = v_transaksi_id;
    if not found then
      raise exception 'Transaksi transfer tidak ditemukan.';
    end if;
    delete from public.detail_transaksi where transaksi_id = v_transaksi_id;
  end if;

  insert into public.detail_transaksi (transaksi_id, kas_id, kategori_id, arah, nominal, catatan)
  values
    (v_transaksi_id, p_kas_sumber_id, null, 'keluar', p_nominal, 'Transfer keluar'),
    (v_transaksi_id, p_kas_tujuan_id, null, 'masuk', p_nominal, 'Transfer masuk');

  return v_transaksi_id;
end;
$$;

drop function if exists public.simpan_transfer_kas(uuid, date, text, uuid, uuid, numeric, uuid);

create or replace function public.transfer_saldo_kasir_harian()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_kasir_id uuid;
  v_kas_utama_id uuid;
  v_saldo numeric(14, 2);
  v_tanggal date;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('annisa-kasir-ke-kas-utama'));

  select id into v_kasir_id from public.kas where nama = 'Kasir';
  select id into v_kas_utama_id from public.kas where nama = 'Kas Utama';
  if v_kasir_id is null or v_kas_utama_id is null then
    raise exception 'Akun Kasir dan Kas Utama harus tersedia.';
  end if;
  if v_kasir_id = v_kas_utama_id then
    raise exception 'Akun Kasir dan Kas Utama harus berbeda.';
  end if;

  select coalesce(sum(
    case
      when t.jenis = 'transfer' then
        case d.arah when 'masuk' then d.nominal when 'keluar' then -d.nominal else 0 end
      when t.jenis = 'masuk' then d.nominal
      when t.jenis = 'keluar' then -d.nominal
      else 0
    end
  ), 0)::numeric(14, 2)
  into v_saldo
  from public.detail_transaksi d
  join public.transaksi t on t.id = d.transaksi_id
  where d.kas_id = v_kasir_id;

  if v_saldo <= 0 then
    return null;
  end if;

  v_tanggal := (pg_catalog.now() at time zone 'Asia/Jakarta')::date;
  return public.simpan_transfer_kas(
    null,
    v_tanggal,
    'Setoran kasir otomatis ke Kas Utama',
    v_kasir_id,
    v_kas_utama_id,
    v_saldo
  );
end;
$$;

revoke all on function public.transfer_saldo_kasir_harian() from public, anon, authenticated;

create index if not exists transaksi_tanggal_idx on public.transaksi (tanggal desc);
create index if not exists kas_induk_kas_idx on public.kas (induk_kas_id);
create index if not exists transaksi_jenis_tanggal_idx on public.transaksi (jenis, tanggal desc);
create index if not exists detail_transaksi_transaksi_idx on public.detail_transaksi (transaksi_id);
create index if not exists detail_transaksi_kas_idx on public.detail_transaksi (kas_id);
create index if not exists detail_transaksi_kategori_idx on public.detail_transaksi (kategori_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kas_set_updated_at on public.kas;
create trigger kas_set_updated_at before update on public.kas for each row execute function public.set_updated_at();
drop trigger if exists kategori_set_updated_at on public.kategori;
create trigger kategori_set_updated_at before update on public.kategori for each row execute function public.set_updated_at();
drop trigger if exists transaksi_set_updated_at on public.transaksi;
create trigger transaksi_set_updated_at before update on public.transaksi for each row execute function public.set_updated_at();
drop trigger if exists detail_transaksi_set_updated_at on public.detail_transaksi;
create trigger detail_transaksi_set_updated_at before update on public.detail_transaksi for each row execute function public.set_updated_at();

alter table public.kas enable row level security;
alter table public.kategori enable row level security;
alter table public.transaksi enable row level security;
alter table public.detail_transaksi enable row level security;

drop policy if exists "authenticated users manage kas" on public.kas;
create policy "authenticated users manage kas" on public.kas for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users manage kategori" on public.kategori;
create policy "authenticated users manage kategori" on public.kategori for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users manage transaksi" on public.transaksi;
create policy "authenticated users manage transaksi" on public.transaksi for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users manage detail transaksi" on public.detail_transaksi;
create policy "authenticated users manage detail transaksi" on public.detail_transaksi for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.kas, public.kategori, public.transaksi, public.detail_transaksi to authenticated;
revoke all on function public.simpan_transfer_kas(uuid, date, text, uuid, uuid, numeric) from public, anon;
grant execute on function public.simpan_transfer_kas(uuid, date, text, uuid, uuid, numeric) to authenticated, service_role;

insert into public.kas (nama, deskripsi, warna, induk_kas_id) values
  ('Kas Utama', 'Saldo gabungan seluruh akun kas cafe.', '#79504a', null)
on conflict (nama) do update set induk_kas_id = null;

insert into public.kas (nama, deskripsi, warna, induk_kas_id) values
  ('Kasir', 'Penerimaan dan pembayaran harian di meja kasir.', '#a65f4d', (select id from public.kas where nama = 'Kas Utama')),
  ('Kas Operasional', 'Kebutuhan operasional rutin cafe.', '#9a7551', (select id from public.kas where nama = 'Kas Utama')),
  ('Kas Cadangan', 'Dana cadangan untuk kebutuhan mendesak.', '#667b67', (select id from public.kas where nama = 'Kas Utama'))
on conflict (nama) do update set induk_kas_id = excluded.induk_kas_id;

insert into public.kategori (nama, jenis, warna) values
  ('Penjualan', 'masuk', '#66816b'),
  ('Modal', 'masuk', '#9a7551'),
  ('Bahan baku', 'keluar', '#aa715d'),
  ('Operasional', 'keluar', '#9a7551'),
  ('Gaji', 'keluar', '#7a5960'),
  ('Lain-lain', 'keluar', '#7d817b')
on conflict (nama) do nothing;

select cron.unschedule(jobid)
from cron.job
where jobname = 'annisa-transfer-kasir-ke-utama-2359-wib';

select cron.schedule(
  'annisa-transfer-kasir-ke-utama-2359-wib',
  '59 16 * * *',
  'select public.transfer_saldo_kasir_harian();'
);

-- Accounting ledger for Annisa Beno Cafe (SAK double-entry records).
do $$ begin
  create type public.tipe_akun as enum ('aset', 'kewajiban', 'ekuitas', 'pendapatan', 'beban');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.saldo_akun as enum ('debit', 'kredit');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.jenis_kategori as enum ('masuk', 'keluar');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.tipe_produk as enum ('makanan', 'minuman');
exception when duplicate_object then null;
end $$;
alter table public.kategori add column if not exists nama_kategori text;
alter table public.kategori add column if not exists deskripsi text not null default '';
update public.kategori set nama_kategori = nama where nama_kategori is null;
create unique index if not exists kategori_nama_kategori_uidx on public.kategori (nama_kategori);
alter table public.kategori drop constraint if exists kategori_jenis_check;
alter table public.kategori alter column jenis type public.jenis_kategori using jenis::text::public.jenis_kategori;

create table if not exists public.akun (
  id uuid primary key default gen_random_uuid(),
  kode_akun varchar(10) not null unique,
  nama_akun text not null,
  tipe public.tipe_akun not null,
  saldo_normal public.saldo_akun not null,
  saldo numeric(16,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.produk (
  id uuid primary key default gen_random_uuid(),
  nama_produk text not null unique,
  tipe public.tipe_produk not null,
  harga_jual numeric(14,2) not null check (harga_jual >= 0),
  ppn_rate numeric(5,2) not null default 11 check (ppn_rate >= 0 and ppn_rate <= 100),
  deskripsi text not null default '',
  foto_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  nama_bahan text not null unique,
  stok_saat_ini numeric(14,2) not null default 0 check (stok_saat_ini >= 0),
  satuan text not null check (satuan in ('gram', 'liter', 'pcs')),
  minimal_stok numeric(14,2) not null default 0 check (minimal_stok >= 0),
  no_referensi text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory add column if not exists no_referensi text not null default '';
create table if not exists public.resep_produk (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references public.produk(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  jumlah_pemakaian numeric(14,3) not null check (jumlah_pemakaian > 0),
  created_at timestamptz not null default now(),
  unique (produk_id, inventory_id)
);
create table if not exists public.karyawan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jabatan text not null,
  gaji_pokok numeric(14,2) not null check (gaji_pokok >= 0),
  ptkp_status varchar(5) not null default 'TK/0',
  npwp varchar(32) not null default '',
  tanggal_masuk date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.transaksi_penjualan (
  id uuid primary key default gen_random_uuid(),
  no_transaksi text not null unique,
  tanggal date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  ppn numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  metode_bayar text not null default 'Tunai',
  kasir_id uuid references public.karyawan(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.detail_penjualan (
  id uuid primary key default gen_random_uuid(),
  penjualan_id uuid not null references public.transaksi_penjualan(id) on delete cascade,
  produk_id uuid references public.produk(id) on delete set null,
  qty integer not null check (qty > 0),
  harga_satuan numeric(14,2) not null check (harga_satuan >= 0),
  ppn_item numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  nama_produk_snapshot text not null default '',
  created_at timestamptz not null default now()
);
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
create or replace function public.kembalikan_stok_resep_penjualan()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_resep record;
begin
  if old.produk_id is null then return old; end if;
  for v_resep in
    select inventory_id, jumlah_pemakaian
    from public.resep_produk
    where produk_id=old.produk_id
    order by inventory_id
  loop
    update public.inventory
    set stok_saat_ini=stok_saat_ini+(v_resep.jumlah_pemakaian*old.qty)
    where id=v_resep.inventory_id;
  end loop;
  return old;
end $$;
drop trigger if exists kembalikan_stok_resep_penjualan on public.detail_penjualan;
create trigger kembalikan_stok_resep_penjualan
after delete on public.detail_penjualan
for each row execute function public.kembalikan_stok_resep_penjualan();
create table if not exists public.kas_masuk (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  akun_id uuid not null references public.akun(id) on delete restrict,
  kategori_id uuid references public.kategori(id) on delete set null,
  jumlah numeric(14,2) not null check (jumlah > 0),
  keterangan text not null,
  ref_transaksi text,
  created_at timestamptz not null default now()
);
create table if not exists public.kas_keluar (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  akun_id uuid not null references public.akun(id) on delete restrict,
  kategori_id uuid references public.kategori(id) on delete set null,
  jumlah numeric(14,2) not null check (jumlah > 0),
  jumlah_beli numeric(14,3),
  harga_satuan numeric(14,2),
  keterangan text not null,
  ref_transaksi text,
  created_at timestamptz not null default now()
);
alter table public.kas_keluar
  add column if not exists jumlah_beli numeric(14,3),
  add column if not exists harga_satuan numeric(14,2);
create table if not exists public.jurnal_umum (
  id uuid primary key default gen_random_uuid(),
  no_jurnal text not null unique,
  tanggal date not null,
  keterangan text not null,
  ref_transaksi text,
  created_at timestamptz not null default now()
);
create table if not exists public.jurnal_detail (
  id uuid primary key default gen_random_uuid(),
  jurnal_id uuid not null references public.jurnal_umum(id) on delete cascade,
  akun_id uuid not null references public.akun(id) on delete restrict,
  debit numeric(16,2) not null default 0 check (debit >= 0),
  kredit numeric(16,2) not null default 0 check (kredit >= 0),
  created_at timestamptz not null default now(),
  check ((debit > 0 and kredit = 0) or (kredit > 0 and debit = 0))
);

create index if not exists jurnal_umum_tanggal_idx on public.jurnal_umum(tanggal, no_jurnal);
create index if not exists jurnal_detail_jurnal_idx on public.jurnal_detail(jurnal_id);
create index if not exists jurnal_detail_akun_idx on public.jurnal_detail(akun_id);
create index if not exists penjualan_tanggal_idx on public.transaksi_penjualan(tanggal desc);

drop trigger if exists akun_set_updated_at on public.akun;
create trigger akun_set_updated_at before update on public.akun for each row execute function public.set_updated_at();
drop trigger if exists produk_set_updated_at on public.produk;
create trigger produk_set_updated_at before update on public.produk for each row execute function public.set_updated_at();
drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at before update on public.inventory for each row execute function public.set_updated_at();
drop trigger if exists karyawan_set_updated_at on public.karyawan;
create trigger karyawan_set_updated_at before update on public.karyawan for each row execute function public.set_updated_at();

insert into public.akun(kode_akun,nama_akun,tipe,saldo_normal) values
 ('1101','Kas','aset','debit'),('1102','Piutang Usaha','aset','debit'),('1103','Persediaan Bahan Baku','aset','debit'),
 ('1104','Perlengkapan','aset','debit'),('1105','Sewa Dibayar di Muka','aset','debit'),('1201','Peralatan Cafe','aset','debit'),
 ('1202','Akumulasi Penyusutan Peralatan','aset','kredit'),('2101','Utang Usaha','kewajiban','kredit'),
 ('2102','Utang PPN','kewajiban','kredit'),('2103','Utang PPh 21','kewajiban','kredit'),
 ('2104','Utang BPJS','kewajiban','kredit'),('2105','Utang Gaji','kewajiban','kredit'),('2106','Utang PBB','kewajiban','kredit'),
 ('3101','Modal Pemilik','ekuitas','kredit'),('3102','Laba Ditahan','ekuitas','kredit'),('3103','Prive','ekuitas','debit'),
 ('4101','Pendapatan Penjualan','pendapatan','kredit'),('4102','Pendapatan Lain-lain','pendapatan','kredit'),
 ('5101','Harga Pokok Penjualan','beban','debit'),('5201','Beban Gaji','beban','debit'),
 ('5202','Beban BPJS Perusahaan','beban','debit'),('5203','Beban Listrik dan Air','beban','debit'),
 ('5204','Beban Sewa','beban','debit'),('5205','Beban Pajak Bangunan','beban','debit'),
 ('5206','Beban Operasional','beban','debit'),('5207','Beban Pemasaran','beban','debit'),
 ('5208','Beban Penyusutan','beban','debit'),('5209','Beban Perlengkapan','beban','debit'),
 ('5210','Beban Administrasi Bank','beban','debit'),('5211','Beban Pemeliharaan','beban','debit')
on conflict(kode_akun) do update set nama_akun=excluded.nama_akun, tipe=excluded.tipe, saldo_normal=excluded.saldo_normal;

insert into public.kategori(nama,nama_kategori,jenis,deskripsi) values
 ('Penjualan','Penjualan','masuk','Penerimaan penjualan cafe'),
 ('Modal','Modal','masuk','Setoran pemilik'),
 ('Operasional','Operasional','keluar','Beban operasional cafe'),
 ('Bahan baku','Bahan baku','keluar','Pembelian bahan baku'),
 ('Gaji','Gaji','keluar','Pembayaran gaji karyawan'),
 ('Pajak','Pajak','keluar','Pembayaran pajak dan iuran')
on conflict(nama) do update set nama_kategori=excluded.nama_kategori, deskripsi=excluded.deskripsi;

do $$ begin
  if not exists(select 1 from public.produk where nama_produk='Danish Pastry') then
    update public.produk set nama_produk='Danish Pastry' where nama_produk='Danish';
  end if;
  if not exists(select 1 from public.produk where nama_produk='Blueberry Muffin') then
    update public.produk set nama_produk='Blueberry Muffin' where nama_produk='Muffin';
  end if;
end $$;

insert into public.produk(nama_produk,tipe,harga_jual,ppn_rate,deskripsi,foto_url) values
 ('Chamomile Tea','minuman',25000,11,'Teh chamomile lembut','https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop'),
 ('Black Tea','minuman',20000,11,'Teh hitam klasik','https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop'),
 ('Oolong Tea','minuman',28000,11,'Teh oolong aromatik','https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop'),
 ('Green Tea','minuman',22000,11,'Teh hijau segar','https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400&h=400&fit=crop'),
 ('Earl Grey Tea','minuman',25000,11,'Teh Earl Grey bergamot','https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400&h=400&fit=crop'),
 ('Croissant','makanan',18000,11,'Croissant butter','https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop'),
 ('Danish Pastry','makanan',20000,11,'Pastry Danish','https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=400&h=400&fit=crop'),
 ('Blueberry Muffin','makanan',15000,11,'Muffin panggang','https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop'),
 ('Scone','makanan',17000,11,'Scone klasik','https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop'),
 ('Pain au Chocolat','makanan',22000,11,'Pastry cokelat','https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=400&h=400&fit=crop')
on conflict(nama_produk) do update set harga_jual=excluded.harga_jual, ppn_rate=excluded.ppn_rate, foto_url=excluded.foto_url;

update public.produk set foto_url='https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop' where nama_produk='Chamomile Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop' where nama_produk='Black Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop' where nama_produk='Oolong Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400&h=400&fit=crop' where nama_produk='Green Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400&h=400&fit=crop' where nama_produk='Earl Grey Tea';
update public.produk set foto_url='https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop' where nama_produk='Croissant';
update public.produk set foto_url='https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=400&h=400&fit=crop' where nama_produk='Danish Pastry';
update public.produk set foto_url='https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop' where nama_produk='Blueberry Muffin';
update public.produk set foto_url='https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop' where nama_produk='Scone';
update public.produk set foto_url='https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=400&h=400&fit=crop' where nama_produk='Pain au Chocolat';

insert into public.karyawan(nama,jabatan,gaji_pokok,ptkp_status,tanggal_masuk)
select seed.nama,seed.jabatan,seed.gaji_pokok,seed.ptkp_status,seed.tanggal_masuk::date
from (values
 ('Rani Putri','Barista',3500000,'TK/0','2025-01-01'),
 ('Dimas Pratama','Kasir',4000000,'TK/0','2025-01-01'),
 ('Siti Lestari','Pastry Chef',5000000,'K/1','2025-01-01')
) as seed(nama,jabatan,gaji_pokok,ptkp_status,tanggal_masuk)
where not exists (select 1 from public.karyawan where karyawan.nama=seed.nama);

create sequence if not exists public.jurnal_nomor_seq;
create or replace function public.buat_jurnal(p_tanggal date,p_keterangan text,p_ref text,p_baris jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_debit numeric(16,2); v_kredit numeric(16,2); v_item jsonb;
begin
  select coalesce(sum((x->>'debit')::numeric),0),coalesce(sum((x->>'kredit')::numeric),0)
    into v_debit,v_kredit from jsonb_array_elements(p_baris) x;
  if v_debit <= 0 or v_debit <> v_kredit then raise exception 'Jurnal tidak seimbang (debit %, kredit %).',v_debit,v_kredit; end if;
  delete from public.jurnal_umum where ref_transaksi=p_ref;
  insert into public.jurnal_umum(no_jurnal,tanggal,keterangan,ref_transaksi)
    values ('JU-'||to_char(p_tanggal,'YYYYMMDD')||'-'||lpad(nextval('public.jurnal_nomor_seq')::text,6,'0'),p_tanggal,p_keterangan,p_ref)
    returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_baris) loop
    insert into public.jurnal_detail(jurnal_id,akun_id,debit,kredit)
      values(v_id,(v_item->>'akun_id')::uuid,coalesce((v_item->>'debit')::numeric,0),coalesce((v_item->>'kredit')::numeric,0));
  end loop;
  return v_id;
end $$;

create or replace function public.proses_penjualan(p_items jsonb,p_metode_bayar text default 'Tunai',p_kasir_id uuid default null,p_tanggal date default current_date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); v_item jsonb; v_produk public.produk%rowtype; v_qty integer;
        v_subtotal numeric(14,2):=0; v_ppn numeric(14,2):=0; v_item_subtotal numeric(14,2); v_item_ppn numeric(14,2);
        v_kas uuid; v_pendapatan uuid; v_utang_ppn uuid; v_baris jsonb;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Keranjang penjualan kosong.'; end if;
  insert into public.transaksi_penjualan(id,no_transaksi,tanggal,metode_bayar,kasir_id)
    values(v_id,'PJ-'||to_char(p_tanggal,'YYYYMMDD')||'-'||upper(substr(replace(v_id::text,'-',''),1,8)),p_tanggal,coalesce(p_metode_bayar,'Tunai'),p_kasir_id);
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_produk from public.produk where id=(v_item->>'produk_id')::uuid;
    if not found then raise exception 'Produk tidak ditemukan.'; end if;
    v_qty:=(v_item->>'qty')::integer;
    if v_qty<=0 or v_qty>1000 then raise exception 'Jumlah produk tidak valid.'; end if;
    v_item_subtotal:=round(v_produk.harga_jual*v_qty,2);
    v_item_ppn:=round(v_item_subtotal*v_produk.ppn_rate/100,2);
    insert into public.detail_penjualan(penjualan_id,produk_id,qty,harga_satuan,ppn_item,subtotal,nama_produk_snapshot)
      values(v_id,v_produk.id,v_qty,v_produk.harga_jual,v_item_ppn,v_item_subtotal,v_produk.nama_produk);
    v_subtotal:=v_subtotal+v_item_subtotal; v_ppn:=v_ppn+v_item_ppn;
  end loop;
  update public.transaksi_penjualan set subtotal=v_subtotal,ppn=v_ppn,total=v_subtotal+v_ppn where id=v_id;
  select id into strict v_kas from public.akun where kode_akun='1101';
  select id into strict v_pendapatan from public.akun where kode_akun='4101';
  select id into strict v_utang_ppn from public.akun where kode_akun='2102';
  v_baris:=jsonb_build_array(jsonb_build_object('akun_id',v_kas,'debit',v_subtotal+v_ppn,'kredit',0),
    jsonb_build_object('akun_id',v_pendapatan,'debit',0,'kredit',v_subtotal));
  if v_ppn>0 then v_baris:=v_baris||jsonb_build_array(jsonb_build_object('akun_id',v_utang_ppn,'debit',0,'kredit',v_ppn)); end if;
  perform public.buat_jurnal(p_tanggal,'Penjualan cafe','penjualan:'||v_id::text,v_baris);
  return v_id;
end $$;

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

create or replace function public.ubah_penjualan(p_no_transaksi text,p_tanggal date,p_metode_bayar text,p_total numeric)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_sale public.transaksi_penjualan%rowtype; v_old_subtotal numeric; v_old_total numeric;
        v_new_subtotal numeric(14,2); v_new_ppn numeric(14,2); v_subtotal_left numeric(14,2);
        v_ppn_left numeric(14,2); v_line_count integer; v_index integer:=0; v_line record;
        v_line_subtotal numeric(14,2); v_line_ppn numeric(14,2);
        v_kas uuid; v_pendapatan uuid; v_utang_ppn uuid; v_baris jsonb;
begin
  if p_tanggal is null or p_metode_bayar is null or p_metode_bayar not in ('Tunai','QRIS')
    or p_total is null or p_total<=0 or p_total>999999999999 then
    raise exception 'Tanggal, metode pembayaran, atau nominal penjualan tidak valid.';
  end if;
  select * into v_sale from public.transaksi_penjualan
    where no_transaksi=p_no_transaksi for update;
  if not found then raise exception 'Transaksi penjualan tidak ditemukan.'; end if;
  select coalesce(sum(subtotal),0),count(*) into v_old_subtotal,v_line_count
    from public.detail_penjualan where penjualan_id=v_sale.id;
  if v_line_count=0 or v_sale.total<=0 then
    raise exception 'Penjualan tanpa rincian produk tidak dapat diubah.';
  end if;
  v_old_total:=v_sale.total;
  v_new_subtotal:=round(p_total*v_old_subtotal/v_old_total,2);
  v_new_ppn:=p_total-v_new_subtotal;
  v_subtotal_left:=v_new_subtotal;
  v_ppn_left:=v_new_ppn;
  for v_line in
    select id,qty,subtotal,ppn_item
    from public.detail_penjualan
    where penjualan_id=v_sale.id
    order by created_at,id
  loop
    v_index:=v_index+1;
    if v_index=v_line_count then
      v_line_subtotal:=v_subtotal_left;
      v_line_ppn:=v_ppn_left;
    else
      v_line_subtotal:=case when v_old_subtotal>0
        then round(v_new_subtotal*v_line.subtotal/v_old_subtotal,2)
        else round(v_new_subtotal/v_line_count,2) end;
      v_line_ppn:=case when v_sale.ppn>0
        then round(v_new_ppn*v_line.ppn_item/v_sale.ppn,2)
        else round(v_new_ppn/v_line_count,2) end;
      v_subtotal_left:=v_subtotal_left-v_line_subtotal;
      v_ppn_left:=v_ppn_left-v_line_ppn;
    end if;
    update public.detail_penjualan
      set subtotal=v_line_subtotal,ppn_item=v_line_ppn,
          harga_satuan=round(v_line_subtotal/v_line.qty,2)
      where id=v_line.id;
  end loop;
  update public.transaksi_penjualan
    set tanggal=p_tanggal,metode_bayar=trim(p_metode_bayar),
        subtotal=v_new_subtotal,ppn=v_new_ppn,total=p_total
    where id=v_sale.id;
  select id into strict v_kas from public.akun where kode_akun='1101';
  select id into strict v_pendapatan from public.akun where kode_akun='4101';
  select id into strict v_utang_ppn from public.akun where kode_akun='2102';
  v_baris:=jsonb_build_array(
    jsonb_build_object('akun_id',v_kas,'debit',p_total,'kredit',0),
    jsonb_build_object('akun_id',v_pendapatan,'debit',0,'kredit',v_new_subtotal));
  if v_new_ppn>0 then
    v_baris:=v_baris||jsonb_build_array(jsonb_build_object('akun_id',v_utang_ppn,'debit',0,'kredit',v_new_ppn));
  end if;
  perform public.buat_jurnal(p_tanggal,'Penjualan cafe','penjualan:'||v_sale.id::text,v_baris);
  return v_sale.id;
end $$;

create or replace function public.hapus_penjualan(p_no_transaksi text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  select id into v_id from public.transaksi_penjualan
    where no_transaksi=p_no_transaksi for update;
  if not found then raise exception 'Transaksi penjualan tidak ditemukan.'; end if;
  delete from public.jurnal_umum where ref_transaksi='penjualan:'||v_id::text;
  delete from public.transaksi_penjualan where id=v_id;
  return v_id;
end $$;

create or replace function public.jurnal_kas_otomatis()
returns trigger language plpgsql security invoker set search_path=public as $$
declare r record; v_ref text; v_kas uuid; v_baris jsonb; v_tanggal date; v_jumlah numeric; v_akun uuid; v_keterangan text; v_id uuid;
begin
  if tg_op='DELETE' then
    v_ref:=lower(tg_table_name)||':'||old.id::text;
    delete from public.jurnal_umum where ref_transaksi=v_ref;
    return old;
  end if;
  v_id:=new.id; v_ref:=lower(tg_table_name)||':'||new.id::text; v_tanggal:=new.tanggal;
  v_jumlah:=new.jumlah; v_akun:=new.akun_id; v_keterangan:=new.keterangan;
  select id into strict v_kas from public.akun where kode_akun='1101';
  if tg_table_name='kas_masuk' then
    v_baris:=jsonb_build_array(jsonb_build_object('akun_id',v_kas,'debit',v_jumlah,'kredit',0),jsonb_build_object('akun_id',v_akun,'debit',0,'kredit',v_jumlah));
  else
    v_baris:=jsonb_build_array(jsonb_build_object('akun_id',v_akun,'debit',v_jumlah,'kredit',0),jsonb_build_object('akun_id',v_kas,'debit',0,'kredit',v_jumlah));
  end if;
  perform public.buat_jurnal(v_tanggal,v_keterangan,v_ref,v_baris);
  return new;
end $$;
drop trigger if exists kas_masuk_jurnal on public.kas_masuk;
create trigger kas_masuk_jurnal after insert or update or delete on public.kas_masuk for each row execute function public.jurnal_kas_otomatis();
drop trigger if exists kas_keluar_jurnal on public.kas_keluar;
create trigger kas_keluar_jurnal after insert or update or delete on public.kas_keluar for each row execute function public.jurnal_kas_otomatis();

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

create or replace function public.jurnal_buku_kas_lama_otomatis()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_transaksi_id uuid; v_jenis text; v_tanggal date; v_keterangan text; v_jumlah numeric;
        v_kategori text; v_kas uuid; v_lawan uuid; v_baris jsonb; v_ref text;
begin
  if tg_op='DELETE' then v_transaksi_id:=old.transaksi_id; else v_transaksi_id:=new.transaksi_id; end if;
  v_ref:='kasbook:'||v_transaksi_id::text;
  select t.jenis,t.tanggal,t.catatan,d.nominal,k.nama
    into v_jenis,v_tanggal,v_keterangan,v_jumlah,v_kategori
    from public.transaksi t
    join public.detail_transaksi d on d.transaksi_id=t.id
    left join public.kategori k on k.id=d.kategori_id
    where t.id=v_transaksi_id
    order by d.created_at limit 1;
  if not found or v_jenis='transfer' then
    delete from public.jurnal_umum where ref_transaksi=v_ref;
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  select id into strict v_kas from public.akun where kode_akun='1101';
  if v_jenis='masuk' then
    select id into strict v_lawan from public.akun
      where kode_akun=case when lower(coalesce(v_kategori,''))='modal' then '3101'
                            when lower(coalesce(v_kategori,''))='penjualan' then '4101' else '4102' end;
    v_baris:=jsonb_build_array(jsonb_build_object('akun_id',v_kas,'debit',v_jumlah,'kredit',0),
      jsonb_build_object('akun_id',v_lawan,'debit',0,'kredit',v_jumlah));
  else
    select id into strict v_lawan from public.akun
      where kode_akun=case when lower(coalesce(v_kategori,''))='gaji' then '5201'
                            when lower(coalesce(v_kategori,''))='bahan baku' then '5101' else '5206' end;
    v_baris:=jsonb_build_array(jsonb_build_object('akun_id',v_lawan,'debit',v_jumlah,'kredit',0),
      jsonb_build_object('akun_id',v_kas,'debit',0,'kredit',v_jumlah));
  end if;
  perform public.buat_jurnal(v_tanggal,v_keterangan,v_ref,v_baris);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists detail_transaksi_jurnal_akuntansi on public.detail_transaksi;
create trigger detail_transaksi_jurnal_akuntansi after insert or update or delete on public.detail_transaksi
for each row execute function public.jurnal_buku_kas_lama_otomatis();
update public.detail_transaksi d set nominal=d.nominal
from public.transaksi t
where t.id=d.transaksi_id and t.jenis<>'transfer'
  and not exists(select 1 from public.jurnal_umum j where j.ref_transaksi='kasbook:'||t.id::text);

do $$ declare t text; begin
  foreach t in array array['akun','produk','inventory','resep_produk','karyawan','transaksi_penjualan','detail_penjualan','kas_masuk','kas_keluar','jurnal_umum','jurnal_detail'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "authenticated accounting access" on public.%I',t);
    execute format('create policy "authenticated accounting access" on public.%I for all to authenticated using (true) with check (true)',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
  end loop;
  alter table public.kategori enable row level security;
  drop policy if exists "authenticated accounting access" on public.kategori;
  create policy "authenticated accounting access" on public.kategori for all to authenticated using (true) with check (true);
end $$;
grant usage on type public.tipe_akun, public.saldo_akun, public.jenis_kategori, public.tipe_produk to authenticated;
grant usage, select on sequence public.jurnal_nomor_seq to authenticated;
grant execute on function public.potong_stok_resep_penjualan() to authenticated;
revoke all on function public.simpan_resep_produk(uuid,jsonb) from public, anon;
grant execute on function public.kembalikan_stok_resep_penjualan() to authenticated;
revoke all on function public.ubah_penjualan(text,date,text,numeric), public.hapus_penjualan(text),
  public.catat_restock_inventory(uuid,numeric,numeric,date,text) from public, anon;
grant execute on function public.proses_penjualan(jsonb,text,uuid,date), public.simpan_resep_produk(uuid,jsonb),
  public.ubah_penjualan(text,date,text,numeric), public.hapus_penjualan(text),
  public.catat_restock_inventory(uuid,numeric,numeric,date,text),
  public.buat_jurnal(date,text,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public)
values ('produk','produk',true)
on conflict(id) do update set public=true;
drop policy if exists "authenticated product image read" on storage.objects;
create policy "authenticated product image read" on storage.objects for select to authenticated using (bucket_id='produk');
drop policy if exists "authenticated product image insert" on storage.objects;
create policy "authenticated product image insert" on storage.objects for insert to authenticated with check (bucket_id='produk');
drop policy if exists "authenticated product image update" on storage.objects;
create policy "authenticated product image update" on storage.objects for update to authenticated using (bucket_id='produk') with check (bucket_id='produk');
drop policy if exists "authenticated product image delete" on storage.objects;
create policy "authenticated product image delete" on storage.objects for delete to authenticated using (bucket_id='produk');

-- Sample sales for the current month; journals are created by the same posting function used by the cashier.
do $$ declare v_items jsonb; i integer; v_date date; v_id uuid; begin
  if not exists(select 1 from public.transaksi_penjualan where no_transaksi like 'DEMO-%') then
    for i in 1..30 loop
      v_date:=date_trunc('month',current_date)::date + ((i-1)%least(extract(day from current_date)::integer,28));
      select jsonb_agg(jsonb_build_object('produk_id',p.id,'qty',1+((i+p.rn)%2))) into v_items
      from (select id,row_number() over(order by nama_produk)::integer rn from public.produk) p
      where p.rn=1+((i-1)%10);
      v_id:=public.proses_penjualan(v_items,'Tunai',null,v_date);
      update public.transaksi_penjualan set no_transaksi='DEMO-'||to_char(v_date,'YYYYMMDD')||'-'||lpad(i::text,2,'0') where id=v_id;
    end loop;
  end if;
end $$;

insert into public.kas_masuk(tanggal,akun_id,kategori_id,jumlah,keterangan,ref_transaksi)
select current_date,a.id,c.id,20000000,'Setoran modal awal contoh','DEMO-MODAL-'||to_char(current_date,'YYYY-MM')
from public.akun a cross join public.kategori c
where a.kode_akun='3101' and c.nama_kategori='Modal'
  and not exists(select 1 from public.kas_masuk where ref_transaksi='DEMO-MODAL-'||to_char(current_date,'YYYY-MM'));

insert into public.kas_keluar(tanggal,akun_id,kategori_id,jumlah,keterangan,ref_transaksi)
select current_date,a.id,c.id,s.jumlah,s.keterangan,'DEMO-'||s.ref||'-'||to_char(current_date,'YYYY-MM')
from (values
 ('5203','Listrik dan air cafe',750000,'LISTRIK'),
 ('5204','Sewa tempat cafe',2000000,'SEWA'),
 ('5206','Pembelian bahan operasional',450000,'OPERASIONAL'),
 ('5211','Pemeliharaan peralatan cafe',250000,'PEMELIHARAAN')
) as s(kode,keterangan,jumlah,ref)
join public.akun a on a.kode_akun=s.kode
left join public.kategori c on c.nama_kategori='Operasional'
where not exists(select 1 from public.kas_keluar k where k.ref_transaksi='DEMO-'||s.ref||'-'||to_char(current_date,'YYYY-MM'));

notify pgrst, 'reload schema';
