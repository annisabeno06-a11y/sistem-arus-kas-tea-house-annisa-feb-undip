-- // DITAMBAH: pastikan akun yang dibutuhkan laporan SAK tersedia.
insert into public.akun (kode_akun, nama_akun, tipe, saldo_normal)
values
  ('1103', 'Persediaan Bahan Baku', 'aset', 'debit'),
  ('5101', 'Harga Pokok Penjualan', 'beban', 'debit'),
  ('5201', 'Beban Gaji Karyawan', 'beban', 'debit'),
  ('5203', 'Beban Listrik & Air', 'beban', 'debit'),
  ('5204', 'Beban Sewa', 'beban', 'debit'),
  ('5205', 'Beban Pajak Bangunan (PBB)', 'beban', 'debit')
on conflict (kode_akun) do update
set nama_akun = excluded.nama_akun,
    tipe = excluded.tipe,
    saldo_normal = excluded.saldo_normal;
