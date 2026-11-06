const state = {
  token: null,
  user: null,
  kas: [],
  kategori: [],
  transaksi: [],
  filter: 'all',
  query: '',
  month: '',
  reportFrom: '',
  reportTo: '',
  reportRangeTouched: false,
  reportScope: 'overall',
  reportAccountId: 'all',
  selectedAccountId: null,
  modal: null,
  accounting: {
    akun: [], produk: [], inventory: [], resep_produk: [], inventoryError: '', karyawan: [], transaksi_penjualan: [],
    detail_penjualan: [], kas_masuk: [], kas_keluar: [],
    jurnal_umum: [], jurnal_detail: [], module: 'cashier', report: 'jurnal',
    cart: new Map(), edit: null, productFilter: 'all', reportFrom: '', reportTo: '',
    reportAccountId: ''
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const today = new Date();
const todayIso = dateKey(today);
const monthIso = todayIso.slice(0, 7);
let salesChart = null;
const productPhotos = {
  'chamomile tea': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop',
  'black tea': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop',
  'oolong tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop',
  'green tea': 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400&h=400&fit=crop',
  'earl grey tea': 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400&h=400&fit=crop',
  croissant: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop',
  'danish pastry': 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=400&h=400&fit=crop',
  danish: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=400&h=400&fit=crop',
  'blueberry muffin': 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop',
  muffin: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=400&fit=crop',
  scone: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop',
  'pain au chocolat': 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=400&h=400&fit=crop'
};
const featuredProductFallbacks = [
  { nama_produk: 'Chamomile Tea', tipe: 'minuman', harga_jual: 25000, foto_url: productPhotos['chamomile tea'] },
  { nama_produk: 'Black Tea', tipe: 'minuman', harga_jual: 20000, foto_url: productPhotos['black tea'] },
  { nama_produk: 'Oolong Tea', tipe: 'minuman', harga_jual: 28000, foto_url: productPhotos['oolong tea'] },
  { nama_produk: 'Croissant', tipe: 'makanan', harga_jual: 18000, foto_url: productPhotos.croissant },
  { nama_produk: 'Pain au Chocolat', tipe: 'makanan', harga_jual: 22000, foto_url: productPhotos['pain au chocolat'] }
];
const cashierProductPreviews = [
  ...featuredProductFallbacks.slice(0, 3),
  { nama_produk: 'Green Tea', tipe: 'minuman', harga_jual: 22000, foto_url: productPhotos['green tea'] },
  { nama_produk: 'Earl Grey Tea', tipe: 'minuman', harga_jual: 25000, foto_url: productPhotos['earl grey tea'] },
  { nama_produk: 'Danish Pastry', tipe: 'makanan', harga_jual: 20000, foto_url: productPhotos['danish pastry'] },
  { nama_produk: 'Blueberry Muffin', tipe: 'makanan', harga_jual: 15000, foto_url: productPhotos['blueberry muffin'] },
  { nama_produk: 'Scone', tipe: 'makanan', harga_jual: 17000, foto_url: productPhotos.scone },
  featuredProductFallbacks[3],
  featuredProductFallbacks[4]
];

function dateKey(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function money(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function displayDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('id-ID', options).format(new Date(`${value}T00:00:00`));
}

function icon(name, className = '') {
  return `<i data-lucide="${name}" class="${className}"></i>`;
}

function refreshIcons() {
  window.lucide?.createIcons();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function productImageSrc(product) {
  const savedUrl = String(product.foto_url || '');
  if (/^(https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(savedUrl)) return savedUrl;
  return productPhotos[String(product.nama_produk || '').trim().toLocaleLowerCase('id-ID')]
    || productPhotos['chamomile tea'];
}

function dummyQrImage() {
  const size = 25;
  const matrix = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => ((x * 13 + y * 7 + x * y) % 5 < 2)));
  const finder = (left, top) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        matrix[top + y][left + x] = x === 0 || y === 0 || x === 6 || y === 6
          || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  const cells = matrix.flatMap((row, y) => row.map((dark, x) => dark ? `<rect x="${x + 4}" y="${y + 4}" width="1" height="1"/>` : '')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33"><rect width="33" height="33" fill="white"/><g fill="#111">${cells}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Foto gagal dibaca. Coba pilih file lain.'));
    reader.readAsDataURL(file);
  });
}

function attachProductImageFallbacks(root) {
  root.querySelectorAll('img[data-fallback-src]').forEach((image) => {
    image.addEventListener('error', () => {
      if (image.src === image.dataset.fallbackSrc) return;
      image.src = image.dataset.fallbackSrc;
    }, { once: true });
  });
}

function setDashboardDataStatus(message = '') {
  const status = $('#dashboard-data-status');
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
}

const directFileMode = window.location.protocol === 'file:';
const githubPagesMode = window.location.hostname.endsWith('.github.io');
const directSupabaseMode = directFileMode || githubPagesMode;
const directSupabaseConfig = {
  url: window.SUPABASE_CONFIG?.SUPABASE_URL || '',
  anonKey: window.SUPABASE_CONFIG?.SUPABASE_ANON_KEY || ''
};
let directSupabaseClient = null;

function getDirectSupabaseStatus() {
  const config = directSupabaseConfig;
  const missing = [];
  if (!config.url || !/^https:\/\//i.test(config.url)) missing.push('SUPABASE_URL di frontend/js/config.js');
  if (!config.anonKey) missing.push('SUPABASE_ANON_KEY di frontend/js/config.js');
  if (!window.supabase?.createClient) missing.push('Supabase JS SDK (periksa koneksi internet)');
  if (missing.length) return { ok: true, configured: false, missing };

  if (!directSupabaseClient) {
    try {
      directSupabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false }
      });
    } catch (error) {
      return { ok: true, configured: false, missing: [error.message] };
    }
  }
  return { ok: true, configured: true, missing: [] };
}

async function requestDirect(path, options = {}) {
  if (path === '/api/health') return getDirectSupabaseStatus();
  const status = getDirectSupabaseStatus();
  if (!status.configured) throw new Error(`Supabase belum siap: ${status.missing.join(', ')}.`);

  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const client = directSupabaseClient;
  const throwIfError = (error) => { if (error) throw new Error(error.message || 'Permintaan Supabase gagal.'); };

  if (path === '/api/auth/login' && method === 'POST') {
    const { data, error } = await client.auth.signInWithPassword(body);
    throwIfError(error);
    state.token = data.session.access_token;
    return { access_token: data.session.access_token, user: { id: data.user.id, email: data.user.email } };
  }
  if (path === '/api/auth/anonymous-login' && method === 'POST') {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) {
      const message = error.message.toLowerCase().includes('anonymous')
        ? 'Aktifkan Anonymous Sign-ins pada pengaturan Authentication Supabase untuk membuka dashboard tanpa login.'
        : error.message;
      throw new Error(message);
    }
    state.token = data.session.access_token;
    return { access_token: data.session.access_token, user: { id: data.user.id, is_anonymous: true } };
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    const { error } = await client.auth.signOut();
    throwIfError(error);
    state.token = null;
    return { ok: true };
  }

  const accountingRpc = path.match(/^\/api\/accounting\/rpc\/(proses_penjualan|simpan_resep_produk|ubah_penjualan|hapus_penjualan|catat_restock_inventory)$/);
  if (accountingRpc && method === 'POST') {
    const result = await client.rpc(accountingRpc[1], body);
    throwIfError(result.error);
    return result.data;
  }
  const receiptRoute = path.match(/^\/api\/accounting\/receipt\/(.+)$/);
  if (receiptRoute && method === 'GET') {
    const receiptNo = decodeURIComponent(receiptRoute[1]);
    const result = await client.from('transaksi_penjualan')
      .select('*,detail_penjualan(*)')
      .eq('no_transaksi', receiptNo)
      .maybeSingle();
    throwIfError(result.error);
    if (!result.data) throw new Error('Transaksi penjualan tidak ditemukan.');
    return result.data;
  }
  if (path === '/api/accounting/upload-image' && method === 'POST') {
    const mimeTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = mimeTypes[body.content_type];
    if (!extension || typeof body.data !== 'string') throw new Error('Pilih foto berformat JPG, PNG, atau WebP.');
    const binary = atob(body.data);
    if (binary.length > 3 * 1024 * 1024) throw new Error('Ukuran foto maksimal 3 MB.');
    const objectPath = `${crypto.randomUUID()}.${extension}`;
    const file = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const result = await client.storage.from('produk').upload(objectPath, file, { contentType: body.content_type, upsert: true });
    throwIfError(result.error);
    return { publicUrl: client.storage.from('produk').getPublicUrl(objectPath).data.publicUrl };
  }
  const accountingRoute = path.match(/^\/api\/accounting\/(akun|kategori|produk|inventory|resep_produk|karyawan|transaksi_penjualan|detail_penjualan|kas_masuk|kas_keluar|jurnal_umum|jurnal_detail)(?:\/([0-9a-f-]{36}))?$/i);
  if (accountingRoute) {
    const [, table, id] = accountingRoute;
    let accountingQuery;
    if (method === 'GET' && !id) {
      const select = ['kas_masuk', 'kas_keluar'].includes(table)
        ? 'id,tanggal,keterangan,jumlah,akun_id,kategori_id,ref_transaksi,created_at'
        : '*';
      accountingQuery = client.from(table).select(select);
      if (table !== 'akun') accountingQuery = accountingQuery.order('created_at', { ascending: false });
    } else if (method === 'POST' && !id) {
      accountingQuery = client.from(table).insert(body).select().single();
    } else if (method === 'PATCH' && id) {
      accountingQuery = client.from(table).update(body).eq('id', id).select().single();
    } else if (method === 'DELETE' && id && ['produk', 'inventory', 'karyawan', 'akun', 'kategori', 'kas_masuk', 'kas_keluar'].includes(table)) {
      accountingQuery = client.from(table).delete().eq('id', id);
    } else {
      throw new Error('Aksi data akuntansi tidak diizinkan.');
    }
    const result = await accountingQuery;
    throwIfError(result.error);
    return result.data;
  }

  const match = path.match(/^\/api\/(kas|kategori|transaksi)(?:\/([0-9a-f-]{36}))?$/i);
  if (!match) throw new Error('Endpoint tidak ditemukan.');
  const [, resource, id] = match;
  let query;

  if (resource === 'transaksi') {
    if (method === 'GET' && !id) {
      const result = await client.from('transaksi')
        .select('*,detail_transaksi(id,kas_id,kategori_id,arah,nominal,catatan,kas(nama),kategori(nama))')
        .order('tanggal', { ascending: false }).order('created_at', { ascending: false });
      throwIfError(result.error);
      return result.data;
    }
    if ((method === 'POST' && !id) || (method === 'PATCH' && id)) {
      const { data: authData, error: authError } = await client.auth.getUser();
      throwIfError(authError);
      if (!authData.user) throw new Error('Sesi berakhir. Silakan masuk kembali.');
      if (body.jenis === 'transfer') {
        const result = await client.rpc('simpan_transfer_kas', {
          p_transaksi_id: id || null,
          p_tanggal: body.tanggal,
          p_catatan: body.catatan,
          p_kas_sumber_id: body.kas_id,
          p_kas_tujuan_id: body.kas_tujuan_id,
          p_nominal: Number(body.nominal)
        });
        throwIfError(result.error);
        return { id: result.data };
      }
      const transactionData = { tanggal: body.tanggal, jenis: body.jenis, catatan: body.catatan };
      let transaction;
      if (method === 'POST') {
        const result = await client.from('transaksi').insert(transactionData).select('id').single();
        throwIfError(result.error);
        transaction = result.data;
      } else {
        const result = await client.from('transaksi').update(transactionData).eq('id', id).select('id').maybeSingle();
        throwIfError(result.error);
        if (!result.data) throw new Error('Transaksi tidak ditemukan.');
        transaction = result.data;
      }

      const detailData = { kas_id: body.kas_id, kategori_id: body.kategori_id, nominal: Number(body.nominal), catatan: String(body.detail_catatan || '').trim() };
      if (method === 'POST') {
        const result = await client.from('detail_transaksi').insert({ ...detailData, transaksi_id: transaction.id });
        if (result.error) {
          await client.from('transaksi').delete().eq('id', transaction.id);
          throwIfError(result.error);
        }
      } else {
        const details = await client.from('detail_transaksi').select('id').eq('transaksi_id', id).order('created_at', { ascending: true });
        throwIfError(details.error);
        const result = details.data?.[0]
          ? await client.from('detail_transaksi').update(detailData).eq('id', details.data[0].id)
          : await client.from('detail_transaksi').insert({ ...detailData, transaksi_id: id });
        throwIfError(result.error);
        const extraDetailIds = (details.data || []).slice(1).map((detail) => detail.id);
        if (extraDetailIds.length) {
          const cleanup = await client.from('detail_transaksi').delete().in('id', extraDetailIds);
          throwIfError(cleanup.error);
        }
      }
      return { id: transaction.id };
    }
  }

  const table = resource;
  if (method === 'GET' && !id) {
    query = client.from(table).select('*').order('created_at', { ascending: false });
  } else if (method === 'POST' && !id) {
    query = client.from(table).insert(body).select().single();
  } else if (method === 'PATCH' && id) {
    query = client.from(table).update(body).eq('id', id).select().single();
  } else if (method === 'DELETE' && id) {
    query = client.from(table).delete().eq('id', id);
  } else if (resource === 'transaksi' && method === 'DELETE' && id) {
    query = client.from(table).delete().eq('id', id);
  } else {
    throw new Error('Metode permintaan tidak diizinkan.');
  }
  const result = await query;
  throwIfError(result.error);
  return result.data;
}

async function request(path, options = {}) {
  if (directSupabaseMode) return requestDirect(path, options);
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new Error(`Tidak dapat terhubung ke server aplikasi di ${window.location.origin}. Jalankan node backend/apps.js dan buka aplikasi melalui alamat server.`);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Permintaan tidak dapat diproses.');
  }
  return result;
}

function setLoginEnabled(enabled) {
  $$('#login-form input, #login-form button[type="submit"]').forEach((control) => { control.disabled = !enabled; });
}

function showLogin(message = '', loginEnabled = true) {
  state.token = null;
  state.user = null;
  $('#app-shell').hidden = true;
  $('#login-screen').hidden = false;
  $('#login-message').textContent = message;
  $('#login-form').classList.toggle('setup-notice', !loginEnabled);
  $('#login-form h2').textContent = loginEnabled ? 'Selamat datang' : 'Dashboard belum siap';
  $('.login-form > .muted').textContent = loginEnabled
    ? 'Masuk untuk membuka pembukuan cafe.'
    : 'Selesaikan pengaturan Supabase di bawah untuk membuka dashboard tanpa login.';
  $('#login-form').reset();
  setLoginEnabled(loginEnabled);
  refreshIcons();
}

function showApp(user) {
  state.user = user;
  $('#login-screen').hidden = true;
  $('#app-shell').hidden = false;
  const email = user.email || 'Annisa Beno';
  $('#user-name').textContent = email.split('@')[0];
  $('#user-avatar').textContent = email[0].toUpperCase();
  $('#logout-button').hidden = Boolean(user.is_anonymous);
  refreshIcons();
}

async function loadData() {
  $('#sync-label').textContent = 'Menyinkronkan...';
  const [kas, kategori, transaksi] = await Promise.all([
    request('/api/kas'), request('/api/kategori'), request('/api/transaksi')
  ]);
  state.kas = kas;
  state.kategori = kategori;
  state.transaksi = transaksi;
  await loadAccountingData();
  if (!state.reportRangeTouched && state.transaksi.length) {
    const earliestDate = state.transaksi.map((transaction) => transaction.tanggal).sort()[0];
    if (earliestDate && earliestDate < state.reportFrom) {
      state.reportFrom = earliestDate;
      $('#report-start').value = earliestDate;
    }
  }
  $('#sync-label').textContent = 'Tersinkron';
  $('#sync-label').closest('.sync-status').classList.add('is-connected');
  setDashboardDataStatus();
  renderAll();
}

async function loadAccountingData() {
  const tables = ['akun', 'produk', 'inventory', 'resep_produk', 'karyawan', 'transaksi_penjualan',
    'detail_penjualan', 'kas_masuk', 'kas_keluar', 'jurnal_umum', 'jurnal_detail'];
  const rows = await Promise.all(tables.map((table) => request(`/api/accounting/${table}`).catch((error) => {
    if (table === 'inventory' && /(?:relation .*inventory.* does not exist|could not find the table .*inventory.*schema cache|table .*inventory.* does not exist)/i.test(error.message)) {
      state.accounting.inventoryError = 'Tabel inventory belum tersedia. Jalankan script CREATE TABLE inventory di Supabase SQL Editor.';
      return [];
    }
    throw error;
  })));
  tables.forEach((table, index) => { state.accounting[table] = rows[index] || []; });
  if (!state.accounting.inventoryError) state.accounting.inventoryError = '';
  if ($('#view-accounting.active')) renderAccounting();
}

function getDetail(transaction) {
  return transaction.detail_transaksi?.[0] || null;
}

function getDetails(transaction) {
  return transaction.detail_transaksi || [];
}

function findReceiptSaleForCashflow(transaction) {
  if (transaction.sumber === 'penjualan') {
    const sale = state.accounting.transaksi_penjualan.find((item) => item.id === transaction.sale_id);
    return sale && state.accounting.detail_penjualan.some((line) => line.penjualan_id === sale.id) ? sale : null;
  }
  const detail = getDetail(transaction);
  const categoryName = String(detail?.kategori?.nama || '').trim().toLocaleLowerCase('id-ID');
  const description = `${transaction.catatan || ''} ${detail?.catatan || ''}`.toLocaleLowerCase('id-ID');
  if (transaction.jenis !== 'masuk' || (categoryName !== 'penjualan' && !description.includes('penjualan'))) return null;
  const haystack = description;
  const explicitMatch = state.accounting.transaksi_penjualan.find((sale) => {
    const receiptNo = String(sale.no_transaksi || '').toLocaleLowerCase('id-ID');
    const saleId = String(sale.id || '').toLocaleLowerCase('id-ID');
    return (saleId && haystack.includes(saleId)) || (receiptNo && haystack.includes(receiptNo));
  });
  if (explicitMatch) return explicitMatch;
  const amount = Number(detail?.nominal);
  if (!Number.isFinite(amount)) return null;
  const itemNames = [
    detail?.catatan,
    String(transaction.catatan || '').replace(/^penjualan(?:\s+(?:minuman|makanan))?\s*/i, '')
  ].map((name) => String(name || '').trim().toLocaleLowerCase('id-ID')).filter(Boolean);
  if (itemNames.length) {
    const lineProductName = (line) => String(
      line.nama_produk_snapshot
        || state.accounting.produk.find((product) => product.id === line.produk_id)?.nama_produk
        || ''
    ).trim().toLocaleLowerCase('id-ID');
    const itemSaleIds = new Set(state.accounting.detail_penjualan
      .filter((line) => itemNames.includes(lineProductName(line)))
      .map((line) => line.penjualan_id));
    const itemMatches = state.accounting.transaksi_penjualan.filter((sale) =>
      sale.tanggal === transaction.tanggal && itemSaleIds.has(sale.id));
    if (itemMatches.length === 1) return itemMatches[0];
    const amountMatches = itemMatches.filter((sale) => state.accounting.detail_penjualan.some((line) =>
      line.penjualan_id === sale.id
        && itemNames.includes(lineProductName(line))
        && (Number(line.subtotal) === amount || Number(line.subtotal) + Number(line.ppn_item) === amount)));
    if (amountMatches.length === 1) return amountMatches[0];
  }
  const possibleMatches = state.accounting.transaksi_penjualan.filter((sale) =>
    sale.tanggal === transaction.tanggal && Number(sale.total) === amount);
  return possibleMatches.length === 1 ? possibleMatches[0] : null;
}

function findTransaction(id) {
  return state.transaksi.find((transaction) => String(transaction.id) === String(id));
}

function getTransferSides(transaction) {
  const details = getDetails(transaction);
  return {
    source: details.find((detail) => detail.arah === 'keluar'),
    destination: details.find((detail) => detail.arah === 'masuk')
  };
}

function getKasDescendantIds(accountId) {
  const descendantIds = new Set([accountId]);
  const pendingIds = [accountId];
  while (pendingIds.length) {
    const parentId = pendingIds.pop();
    state.kas.forEach((account) => {
      if (account.induk_kas_id === parentId && !descendantIds.has(account.id)) {
        descendantIds.add(account.id);
        pendingIds.push(account.id);
      }
    });
  }
  return descendantIds;
}

function orderedKas() {
  return [...state.kas].sort((first, second) => {
    const depthOrder = Number(Boolean(first.induk_kas_id)) - Number(Boolean(second.induk_kas_id));
    return depthOrder || first.nama.localeCompare(second.nama, 'id');
  });
}

function getCashBalance(accountId) {
  const includedAccounts = getKasDescendantIds(accountId);
  return state.transaksi.reduce((total, transaction) => {
    if (transaction.jenis === 'transfer') {
      return total + getDetails(transaction).reduce((balance, detail) => {
        if (!includedAccounts.has(detail.kas_id)) return balance;
        return balance + Number(detail.nominal) * (detail.arah === 'masuk' ? 1 : -1);
      }, 0);
    }
    const detail = getDetail(transaction);
    if (!detail || !includedAccounts.has(detail.kas_id)) return total;
    return total + Number(detail.nominal) * (transaction.jenis === 'masuk' ? 1 : -1);
  }, 0);
}

function getTotalCashBalance() {
  return state.kas.filter((account) => !account.induk_kas_id)
    .reduce((total, account) => total + getCashBalance(account.id), 0);
}

function getMainCashAccount() {
  return state.kas.find((account) => account.nama === 'Kas Utama') || null;
}

function getMainCashTransactions() {
  const categoryName = (categoryId) => {
    const category = state.kategori.find((item) => item.id === categoryId);
    return category?.nama_kategori || category?.nama || 'Tanpa kategori';
  };
  const accountName = (accountId) => {
    const account = state.accounting.akun.find((item) => item.id === accountId);
    return account?.nama_akun || 'Akun kas';
  };
  const accountingMovements = [
    ...state.accounting.kas_masuk.map((row) => ({ row, jenis: 'masuk', table: 'kas_masuk' })),
    ...state.accounting.kas_keluar.map((row) => ({ row, jenis: 'keluar', table: 'kas_keluar' }))
  ].map(({ row, jenis, table }) => ({
    id: `${table}:${row.id}`,
    sumber: 'akuntansi',
    cash_table: table,
    cash_id: row.id,
    tanggal: row.tanggal,
    jenis,
    catatan: row.keterangan,
    created_at: row.created_at || '',
    detail_transaksi: [{
      kas: { nama: 'Kas Utama' },
      kategori: { nama: categoryName(row.kategori_id) },
      kategori_id: row.kategori_id,
      akun_id: row.akun_id,
      akun: { nama: accountName(row.akun_id) },
      nominal: row.jumlah,
      catatan: row.ref_transaksi || ''
    }]
  }));
  const salesMovements = state.accounting.transaksi_penjualan.map((sale) => {
    const details = state.accounting.detail_penjualan.filter((line) => line.penjualan_id === sale.id);
    const itemNames = details.map((line) => line.nama_produk_snapshot
      || state.accounting.produk.find((product) => product.id === line.produk_id)?.nama_produk
      || 'Produk');
    return {
      id: `penjualan:${sale.id}`,
      sumber: 'penjualan',
      sale_id: sale.id,
      no_transaksi: sale.no_transaksi,
      tanggal: sale.tanggal,
      jenis: 'masuk',
      catatan: `Penjualan ${itemNames.join(', ') || 'Kasir'}`,
      created_at: sale.created_at || '',
      detail_transaksi: [{
        kas: { nama: 'Kas Utama' },
        kategori: { nama: 'Penjualan' },
        nominal: sale.total,
        catatan: sale.no_transaksi
      }]
    };
  });
  return [...state.transaksi, ...accountingMovements, ...salesMovements].sort((a, b) =>
    String(b.tanggal || '').localeCompare(String(a.tanggal || ''))
      || String(b.created_at || '').localeCompare(String(a.created_at || ''))
      || String(b.id).localeCompare(String(a.id))
  );
}

function filteredTransactions() {
  return getMainCashTransactions().filter((transaction) => {
    const detail = getDetail(transaction);
    const kindMatches = state.filter === 'all' || transaction.jenis === state.filter;
    const monthMatches = !state.month || transaction.tanggal.startsWith(state.month);
    const linkedNames = getDetails(transaction).map((row) => `${row.catatan || ''} ${row.kategori?.nama || ''} ${row.kas?.nama || ''}`).join(' ');
    const haystack = `${transaction.catatan} ${detail?.catatan || ''} ${linkedNames}`.toLocaleLowerCase('id-ID');
    return kindMatches && monthMatches && haystack.includes(state.query.toLocaleLowerCase('id-ID'));
  });
}

function renderOverview() {
  const cashAccount = state.accounting.akun.find((account) => account.kode_akun === '1101');
  const totalBalance = cashAccount
    ? Number(cashAccount.saldo || 0) + state.accounting.jurnal_detail
      .filter((line) => line.akun_id === cashAccount.id)
      .reduce((balance, line) => balance + Number(line.debit) - Number(line.kredit), 0)
    : getTotalCashBalance();
  const monthJournals = new Map(state.accounting.jurnal_umum.filter((journal) => journal.tanggal.startsWith(monthIso)).map((journal) => [journal.id, journal]));
  const accountById = new Map(state.accounting.akun.map((account) => [account.id, account]));
  const monthLines = state.accounting.jurnal_detail.filter((line) => monthJournals.has(line.jurnal_id));
  const revenue = monthLines.reduce((sum, line) => sum + (accountById.get(line.akun_id)?.tipe === 'pendapatan' ? Number(line.kredit) - Number(line.debit) : 0), 0);
  const expense = monthLines.reduce((sum, line) => sum + (accountById.get(line.akun_id)?.tipe === 'beban' ? Number(line.debit) - Number(line.kredit) : 0), 0);
  $('#total-balance').textContent = money(totalBalance);
  $('#today-income').textContent = money(revenue);
  $('#today-expense').textContent = money(expense);
  $('#month-count').textContent = money(revenue - expense);
  $('#month-caption').textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(today);
  $('#income-caption').textContent = `${state.accounting.transaksi_penjualan.filter((sale) => sale.tanggal.startsWith(monthIso)).length} transaksi penjualan`;
  $('#expense-caption').textContent = 'Dari jurnal pengeluaran dan payroll';
  const mainCash = getMainCashAccount();
  $('#overview-accounts').innerHTML = mainCash
    ? `<div class="account-row"><span class="account-symbol account-color-0">${icon('wallet')}</span><span class="account-row-copy"><strong>Kas Utama</strong><small>Tempat penyimpanan transaksi cafe</small></span><strong class="account-row-balance">${money(getCashBalance(mainCash.id))}</strong></div>`
    : emptyInline('wallet-cards', 'Kas Utama belum tersedia', 'Jalankan seed database Supabase untuk menyiapkan akun default.');
  $('#recent-transactions').innerHTML = state.transaksi.length ? state.transaksi.slice(0, 5).map(activityMarkup).join('') : emptyInline('notebook-tabs', 'Belum ada catatan kas', 'Hubungkan database dan catat arus kas untuk melihat aktivitas.');
  const categoryTotals = new Map();
  state.transaksi.filter((transaction) => transaction.tanggal.startsWith(monthIso)).forEach((transaction) => {
    const detail = getDetail(transaction);
    if (!detail?.kategori) return;
    const key = detail.kategori.nama;
    categoryTotals.set(key, (categoryTotals.get(key) || 0) + Number(detail.nominal));
  });
  const topCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const categoryMax = Math.max(1, ...topCategories.map(([, total]) => total));
  $('#category-summary').innerHTML = topCategories.length ? topCategories.map(([name, total], index) => `<div class="category-bar-row"><span class="category-bar-label">${escapeHtml(name)}</span><span class="category-track"><span class="category-fill fill-${index % 5}" style="width:${Math.max(5, total / categoryMax * 100)}%"></span></span><strong>${money(total)}</strong></div>`).join('') : emptyInline('chart-no-axes-column-increasing', 'Belum ada pergerakan bulan ini', 'Kategori akan terlihat setelah ada transaksi.');
  $('#category-period').textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(today);
  renderSalesChart();
  const latestSales = [...state.accounting.transaksi_penjualan]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal)
      || String(b.created_at || '').localeCompare(String(a.created_at || ''))
      || String(b.no_transaksi).localeCompare(String(a.no_transaksi)));
  $('#latest-sales').innerHTML = latestSales.slice(0, 5).map((sale) => `
    <div class="latest-sale-row"><span><strong>${escapeHtml(sale.no_transaksi)}</strong><small>${displayDate(sale.tanggal)} · ${escapeHtml(sale.metode_bayar)}</small></span><b>${money(sale.total)}</b></div>`).join('')
    || '<div class="dashboard-empty-state"><i data-lucide="receipt-text"></i><strong>Belum ada transaksi penjualan</strong><span>Pastikan database Supabase sudah dikonfigurasi dan skrip database.sql sudah dijalankan.</span></div>';
  renderDashboardProducts();
  refreshIcons();
}

function renderDashboardProducts() {
  const products = state.accounting.produk.length ? state.accounting.produk.slice(0, 5) : featuredProductFallbacks;
  const isPreview = state.accounting.produk.length === 0;
  $('#dashboard-products-note').textContent = isPreview
    ? 'Pratinjau menu · data dan harga produk resmi mengikuti database Supabase.'
    : 'Teh hangat dan pastry favorit untuk menemani hari.';
  $('#dashboard-products').innerHTML = products.map((product) => `
    <article class="dashboard-product-card">
      <div class="dashboard-product-image"><img src="${escapeHtml(productImageSrc(product))}" data-fallback-src="${productPhotos['chamomile tea']}" alt="${escapeHtml(product.nama_produk)}" loading="lazy"></div>
      <div class="dashboard-product-copy"><span>${escapeHtml(product.tipe)}</span><strong>${escapeHtml(product.nama_produk)}</strong>${isPreview ? '' : `<b>${money(product.harga_jual)}</b>`}</div>
    </article>`).join('');
  attachProductImageFallbacks($('#dashboard-products'));
}

function renderSalesChart() {
  const canvas = $('#sales-chart');
  if (!canvas || !window.Chart) return;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = dateKey(date);
    const amount = state.accounting.transaksi_penjualan
      .filter((sale) => sale.tanggal === key)
      .reduce((sum, sale) => sum + Number(sale.total), 0);
    return { key, label: new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' }).format(date), amount };
  });
  if (salesChart) salesChart.destroy();
  salesChart = new window.Chart(canvas, {
    type: 'bar',
    data: { labels: days.map((day) => day.label), datasets: [{ label: 'Penjualan', data: days.map((day) => day.amount), backgroundColor: '#d4a574', borderRadius: 6, maxBarThickness: 42 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => money(context.raw) } } }, scales: { y: { beginAtZero: true, ticks: { callback: (value) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(value) } } } }
  });
}

function emptyInline(iconName, title, description) {
  return `<div class="inline-empty">${icon(iconName)}<strong>${title}</strong><span>${description}</span></div>`;
}

function activityMarkup(transaction) {
  const detail = getDetail(transaction);
  if (transaction.jenis === 'transfer') {
    const { source, destination } = getTransferSides(transaction);
    return `<div class="activity-row"><span class="activity-icon transfer">${icon('arrow-left-right')}</span><span class="activity-copy"><strong>${escapeHtml(transaction.catatan)}</strong><small>${displayDate(transaction.tanggal)} · ${escapeHtml(source?.kas?.nama || 'Kas')} → ${escapeHtml(destination?.kas?.nama || 'Kas')}</small></span><strong class="activity-amount">${money(source?.nominal)}</strong></div>`;
  }
  const incoming = transaction.jenis === 'masuk';
  return `<div class="activity-row"><span class="activity-icon ${incoming ? 'income' : 'expense'}">${icon(incoming ? 'arrow-down-left' : 'arrow-up-right')}</span><span class="activity-copy"><strong>${escapeHtml(transaction.catatan)}</strong><small>${displayDate(transaction.tanggal)} · ${escapeHtml(detail?.kategori?.nama || 'Tanpa kategori')}</small></span><strong class="activity-amount ${incoming ? 'positive' : 'negative'}">${incoming ? '+' : '-'}${money(detail?.nominal)}</strong></div>`;
}

function renderTransactions() {
  const transactions = filteredTransactions();
  const mainTransactions = getMainCashTransactions();
  $('#transaction-count').textContent = mainTransactions.length.toLocaleString('id-ID');
  $('#filter-count-all').textContent = mainTransactions.length.toLocaleString('id-ID');
  $('#transaction-table').innerHTML = transactions.map((transaction) => {
    const detail = getDetail(transaction);
    const transfer = transaction.jenis === 'transfer';
    const incoming = transaction.jenis === 'masuk';
    const categoryName = String(detail?.kategori?.nama || '').trim().toLocaleLowerCase('id-ID');
    const isSaleCategory = !transfer && incoming
      && (categoryName === 'penjualan' || String(transaction.catatan || '').toLocaleLowerCase('id-ID').includes('penjualan'));
    const matchedSale = isSaleCategory ? findReceiptSaleForCashflow(transaction) : null;
    const saleDetails = matchedSale
      ? state.accounting.detail_penjualan.filter((line) => line.penjualan_id === matchedSale.id)
      : [];
    const receiptSale = saleDetails.length ? matchedSale : null;
    const sides = transfer ? getTransferSides(transaction) : null;
    const cashName = transfer ? `${sides.source?.kas?.nama || 'Kas'} → ${sides.destination?.kas?.nama || 'Kas'}` : detail?.kas?.nama || 'Dihapus';
    const amount = transfer ? sides.source?.nominal : detail?.nominal;
    const kindLabel = transfer ? 'Transfer' : incoming ? 'Masuk' : 'Keluar';
    const amountLabel = transfer ? money(amount) : `${incoming ? '+' : '-'}${money(amount)}`;
    const receiptAction = receiptSale
      ? `<button class="button button-quiet receipt-link" type="button" data-view-receipt="${escapeHtml(receiptSale.no_transaksi)}">Lihat Struk</button>`
      : '';
    const cashEvidenceAction = transaction.sumber === 'penjualan' || receiptSale
      ? ''
      : `<button class="button button-quiet evidence-link" type="button" data-view-cash-evidence="${escapeHtml(transaction.id)}">Lihat Bukti</button>`;
    const editDeleteActions = transaction.sumber === 'penjualan'
      ? `<button class="icon-button row-action" data-edit-sale="${escapeHtml(transaction.no_transaksi)}" title="Ubah penjualan" aria-label="Ubah penjualan">${icon('pencil')}</button><button class="icon-button row-action danger-action" data-delete-sale="${escapeHtml(transaction.no_transaksi)}" title="Hapus penjualan" aria-label="Hapus penjualan">${icon('trash-2')}</button>`
      : transaction.sumber === 'akuntansi'
        ? `<button class="icon-button row-action" data-edit-accounting-cash="${transaction.cash_table}:${transaction.cash_id}" title="Ubah transaksi" aria-label="Ubah transaksi">${icon('pencil')}</button><button class="icon-button row-action danger-action" data-delete-accounting-cash="${transaction.cash_table}:${transaction.cash_id}" title="Hapus transaksi" aria-label="Hapus transaksi">${icon('trash-2')}</button>`
        : `<button class="icon-button row-action" data-edit-transaction="${transaction.id}" title="Ubah transaksi" aria-label="Ubah transaksi">${icon('pencil')}</button><button class="icon-button row-action danger-action" data-delete-transaction="${transaction.id}" title="Hapus transaksi" aria-label="Hapus transaksi">${icon('trash-2')}</button>`;
    const actions = `${receiptAction}${cashEvidenceAction}${editDeleteActions}`;
    const receiptNumber = receiptSale?.no_transaksi || transaction.no_transaksi || '-';
    return `<tr><td class="date-cell">${displayDate(transaction.tanggal)}</td><td>${escapeHtml(receiptNumber)}</td><td><strong class="table-description">${escapeHtml(transaction.catatan)}</strong>${!transfer && detail?.catatan ? `<small class="table-subcopy">${escapeHtml(detail.catatan)}</small>` : ''}</td><td><span class="category-chip">${escapeHtml(transfer ? 'Transfer saldo' : detail?.kategori?.nama || 'Dihapus')}</span></td><td><span class="cash-name">${escapeHtml(cashName)}</span></td><td><span class="type-badge ${transfer ? 'transfer' : incoming ? 'in' : 'out'}"><span></span>${kindLabel}</span></td><td class="align-right amount-cell ${transfer ? '' : incoming ? 'positive' : 'negative'}">${amountLabel}</td><td><div class="row-actions">${actions}</div></td></tr>`;
  }).join('');
  $('#transaction-empty').hidden = transactions.length > 0;
  $('#ledger-result-count').textContent = `Menampilkan ${transactions.length} dari ${mainTransactions.length} transaksi`;
  $('#ledger-storage-status').textContent = $('#sync-label').textContent === 'Tersinkron'
    ? 'Tersimpan di Supabase'
    : 'Menunggu koneksi Supabase';
  $('#transaction-table').closest('.table-wrap').classList.toggle('has-empty', !transactions.length);
  renderSalesLedger();
  refreshIcons();
}

function renderSalesLedger() {
  const { transaksi_penjualan: sales, detail_penjualan: details, produk } = state.accounting;
  const latestSales = [...sales]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal)
      || String(b.created_at || '').localeCompare(String(a.created_at || ''))
      || String(b.no_transaksi).localeCompare(String(a.no_transaksi)))
    .slice(0, 10);
  $('#sales-ledger-rows').innerHTML = latestSales.length
    ? latestSales.map((sale) => {
      const count = details.filter((detail) => detail.penjualan_id === sale.id)
        .reduce((sum, detail) => sum + Number(detail.qty), 0);
      return `<tr><td class="date-cell">${displayDate(sale.tanggal)}</td><td><strong class="table-description">${escapeHtml(sale.no_transaksi)}</strong></td><td>${escapeHtml(sale.metode_bayar)}</td><td>${count} item</td><td class="align-right amount-cell">${money(sale.total)}</td><td><button class="button button-quiet receipt-link" type="button" data-view-receipt="${sale.id}">Lihat Struk</button></td></tr>`;
    }).join('')
    : `<tr><td colspan="6" class="sales-ledger-empty">${produk.length
      ? 'Belum ada penjualan. Mulai transaksi melalui menu kasir.'
      : 'Data penjualan belum dimuat. Hubungkan Supabase dan jalankan backend/sql/database.sql untuk menyiapkan tabel serta transaksi contoh.'}</td></tr>`;
}

function renderAccounts() {
  const total = getTotalCashBalance();
  $('#account-total-count').textContent = state.kas.length.toLocaleString('id-ID');
  $('#accounts-total-balance').textContent = money(total);
  $('#account-cards').innerHTML = state.kas.length ? orderedKas().map((account, index) => {
    const accountIds = getKasDescendantIds(account.id);
    const accountTransactions = state.transaksi.filter((transaction) => getDetails(transaction).some((detail) => accountIds.has(detail.kas_id)));
    const cashBalance = getCashBalance(account.id);
    const parent = state.kas.find((candidate) => candidate.id === account.induk_kas_id);
    const description = parent ? `Bagian dari ${parent.nama}` : account.deskripsi || 'Kas cafe';
    return `<article class="account-card account-card-${index % 4}"><div class="account-card-top"><span class="account-card-icon">${icon(['coffee', 'landmark', 'store', 'piggy-bank'][index % 4])}</span><div class="row-actions"><button class="icon-button row-action" data-edit-account="${account.id}" title="Ubah akun" aria-label="Ubah akun">${icon('pencil')}</button><button class="icon-button row-action danger-action" data-delete-account="${account.id}" title="Hapus akun" aria-label="Hapus akun">${icon('trash-2')}</button></div></div><p class="eyebrow">AKUN KAS ${String(index + 1).padStart(2, '0')}</p><h2>${escapeHtml(account.nama)}</h2><p class="account-description">${escapeHtml(description)}</p><strong class="account-card-balance">${money(cashBalance)}</strong><div class="account-card-footer"><span>${accountTransactions.length} transaksi tercatat</span><span class="balance-indicator ${cashBalance >= 0 ? 'positive' : 'negative'}">${cashBalance >= 0 ? 'Saldo positif' : 'Saldo minus'}</span></div><button class="text-button account-open-button" type="button" data-open-account="${account.id}">Lihat transaksi ${icon('arrow-right')}</button></article>`;
  }).join('') : `<div class="empty-block">${emptyInline('wallet-cards', 'Belum ada akun kas', 'Tambahkan Kasir, Kas Utama, Kas Operasional, atau Kas Cadangan.')}</div>`;
  refreshIcons();
}

function renderAccountDetail() {
  const account = state.kas.find((candidate) => candidate.id === state.selectedAccountId);
  if (!account) return;
  const accountIds = getKasDescendantIds(account.id);
  const transactions = state.transaksi.filter((transaction) => getDetails(transaction).some((detail) => accountIds.has(detail.kas_id)));
  const totals = { masuk: 0, keluar: 0 };
  const rows = transactions.map((transaction) => {
    const transfer = transaction.jenis === 'transfer';
    const detail = transfer
      ? null
      : getDetails(transaction).find((row) => accountIds.has(row.kas_id));
    let direction = transaction.jenis;
    let amount = Number(detail?.nominal || 0);
    let accountName = detail?.kas?.nama || account.nama;
    let itemName = detail?.catatan || '';
    let categoryName = detail?.kategori?.nama || 'Tanpa kategori';

    if (transfer) {
      const { source, destination } = getTransferSides(transaction);
      const sourceIncluded = source && accountIds.has(source.kas_id);
      const destinationIncluded = destination && accountIds.has(destination.kas_id);
      const transferNet = (destinationIncluded ? Number(destination.nominal) : 0) - (sourceIncluded ? Number(source.nominal) : 0);
      direction = transferNet > 0 ? 'transfer-masuk' : transferNet < 0 ? 'transfer-keluar' : 'transfer-internal';
      amount = Math.abs(transferNet);
      accountName = `${source?.kas?.nama || 'Kas'} → ${destination?.kas?.nama || 'Kas'}`;
      itemName = direction === 'transfer-internal' ? 'Transfer saldo dalam akun konsolidasi' : 'Transfer antar kas';
      categoryName = 'Transfer saldo';
      if (sourceIncluded) totals.keluar += Number(source.nominal);
      if (destinationIncluded) totals.masuk += Number(destination.nominal);
    } else {
      totals[transaction.jenis] += amount;
    }

    const incoming = direction === 'masuk' || direction === 'transfer-masuk';
    const outgoing = direction === 'keluar' || direction === 'transfer-keluar';
    const directionLabel = ({ masuk: 'Masuk', keluar: 'Keluar', 'transfer-masuk': 'Transfer masuk', 'transfer-keluar': 'Transfer keluar', 'transfer-internal': 'Transfer saldo' })[direction];
    const badgeClass = incoming ? 'in' : outgoing ? 'out' : 'transfer';
    const amountLabel = direction === 'transfer-internal' ? '—' : `${outgoing ? '-' : '+'}${money(amount)}`;
    return `<tr><td class="date-cell">${displayDate(transaction.tanggal)}</td><td><strong class="table-description">${escapeHtml(transaction.catatan)}</strong></td><td>${escapeHtml(itemName || categoryName)}</td><td>${escapeHtml(accountName)}</td><td><span class="type-badge ${badgeClass}"><span></span>${directionLabel}</span></td><td class="align-right amount-cell ${incoming ? 'positive' : outgoing ? 'negative' : ''}">${amountLabel}</td><td><div class="row-actions"><button class="icon-button row-action" data-edit-transaction="${transaction.id}" title="Ubah transaksi" aria-label="Ubah transaksi">${icon('pencil')}</button><button class="icon-button row-action danger-action" data-delete-transaction="${transaction.id}" title="Hapus transaksi" aria-label="Hapus transaksi">${icon('trash-2')}</button></div></td></tr>`;
  });

  $('#account-detail-title').innerHTML = `${escapeHtml(account.nama)} <em>mutasi</em>`;
  $('#account-detail-description').textContent = account.induk_kas_id
    ? `Bagian dari ${state.kas.find((candidate) => candidate.id === account.induk_kas_id)?.nama || 'akun utama'}. Riwayat akun ini saja.`
    : 'Konsolidasi akun ini beserta seluruh kas rinciannya.';
  $('#account-detail-balance').textContent = money(getCashBalance(account.id));
  $('#account-detail-in').textContent = money(totals.masuk);
  $('#account-detail-out').textContent = money(totals.keluar);
  $('#account-detail-count').textContent = transactions.length.toLocaleString('id-ID');
  $('#account-detail-rows').innerHTML = rows.length ? rows.join('') : '<tr><td class="report-empty-cell" colspan="7">Belum ada transaksi pada akun ini.</td></tr>';
  $('#account-detail-empty').hidden = rows.length > 0;
  refreshIcons();
}

function renderCategories() {
  const totalsByCategory = new Map(state.kategori.map((category) => [category.id, { amount: 0, count: 0 }]));
  state.transaksi.forEach((transaction) => {
    if (transaction.jenis === 'transfer') return;
    const detail = getDetail(transaction);
    if (!detail?.kategori_id) return;
    if (!totalsByCategory.has(detail.kategori_id)) totalsByCategory.set(detail.kategori_id, { amount: 0, count: 0 });
    const total = totalsByCategory.get(detail.kategori_id);
    total.amount += Number(detail.nominal || 0);
    total.count += 1;
  });
  const categoryMarkup = (category, index) => {
    const total = totalsByCategory.get(category.id) || { amount: 0, count: 0 };
    return `<div class="category-manager-row"><span class="category-manager-name"><span class="category-dot category-dot-${index % 6}"></span><strong>${escapeHtml(category.nama)}</strong></span><span><span class="type-badge ${category.jenis === 'masuk' ? 'in' : 'out'}"><span></span>${category.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}</span></span><span class="category-usage"><strong>${money(total.amount)}</strong><small>${total.count.toLocaleString('id-ID')} transaksi</small></span><span class="row-actions"><button class="icon-button row-action" data-edit-category="${category.id}" title="Ubah kategori" aria-label="Ubah kategori">${icon('pencil')}</button><button class="icon-button row-action danger-action" data-delete-category="${category.id}" title="Hapus kategori" aria-label="Hapus kategori">${icon('trash-2')}</button></span></div>`;
  };
  const incomeCategories = state.kategori.filter((category) => category.jenis === 'masuk');
  const expenseCategories = state.kategori.filter((category) => category.jenis === 'keluar');
  $('#category-cards').innerHTML = state.kategori.length
    ? `<div class="category-column"><h2>Pemasukan</h2>${incomeCategories.map((category) => categoryMarkup(category, state.kategori.indexOf(category))).join('')}</div><div class="category-column"><h2>Pengeluaran</h2>${expenseCategories.map((category) => categoryMarkup(category, state.kategori.indexOf(category))).join('')}</div>`
    : `<div class="empty-block">${emptyInline('tags', 'Belum ada kategori', 'Buat kategori pemasukan dan pengeluaran.')}</div>`;
  refreshIcons();
}

function reportTransactions() {
  const periodTransactions = state.transaksi.filter((transaction) => transaction.tanggal >= state.reportFrom && transaction.tanggal <= state.reportTo);
  if (state.reportScope === 'overall' || state.reportAccountId === 'all') return periodTransactions;
  if (!state.reportAccountId) return [];
  return periodTransactions.filter((transaction) => getDetails(transaction).some((detail) => detail.kas_id === state.reportAccountId));
}

function renderReports() {
  const reportAccountSelect = $('#report-account-select');
  const selectedReportAccount = state.reportAccountId;
  reportAccountSelect.innerHTML = `<option value="all">Semua Kas</option>${orderedKas().map((account) => `<option value="${account.id}">${escapeHtml(account.nama)}</option>`).join('')}`;
  if (selectedReportAccount === 'all' || state.kas.some((account) => account.id === selectedReportAccount)) reportAccountSelect.value = selectedReportAccount;
  else {
    state.reportAccountId = 'all';
    reportAccountSelect.value = 'all';
  }
  const isAccountReport = state.reportScope === 'account';
  const specificAccount = isAccountReport && state.reportAccountId !== 'all';
  const reportAccount = specificAccount ? state.kas.find((account) => account.id === state.reportAccountId) : null;
  const includedAccounts = reportAccount ? new Set([reportAccount.id]) : null;
  $('#report-account-field').hidden = !isAccountReport;
  $$('[data-report-scope]').forEach((button) => button.classList.toggle('selected', button.dataset.reportScope === state.reportScope));
  const transactions = reportTransactions();
  const totals = { masuk: 0, keluar: 0 };
  const categoryTotals = new Map(state.kategori.map((category) => [category.id, { nama: category.nama, masuk: 0, keluar: 0 }]));
  const accountTotals = new Map(state.kas.map((account) => [account.id, { nama: account.nama, masuk: 0, keluar: 0 }]));
  const addAccountMovement = (detail, kind, amount) => {
    if (!detail?.kas_id || !['masuk', 'keluar'].includes(kind)) return;
    if (specificAccount) {
      if (detail.kas_id !== reportAccount.id) return;
      accountTotals.get(reportAccount.id)[kind] += amount;
      return;
    }
    let account = state.kas.find((candidate) => candidate.id === detail.kas_id);
    if (!account) {
      if (!accountTotals.has(detail.kas_id)) accountTotals.set(detail.kas_id, { nama: detail.kas?.nama || 'Akun kas dihapus', masuk: 0, keluar: 0 });
      accountTotals.get(detail.kas_id)[kind] += amount;
      return;
    }
    while (account) {
      if (!accountTotals.has(account.id)) accountTotals.set(account.id, { nama: account.nama, masuk: 0, keluar: 0 });
      accountTotals.get(account.id)[kind] += amount;
      account = state.kas.find((candidate) => candidate.id === account.induk_kas_id);
    }
  };

  transactions.forEach((transaction) => {
    if (transaction.jenis === 'transfer') {
      getDetails(transaction).forEach((detail) => {
        const amount = Number(detail.nominal || 0);
        addAccountMovement(detail, detail.arah, amount);
        if (specificAccount && includedAccounts.has(detail.kas_id)) totals[detail.arah] += amount;
      });
      return;
    }
    const detail = getDetail(transaction);
    if (specificAccount && !includedAccounts.has(detail?.kas_id)) return;
    const amount = Number(detail?.nominal || 0);
    const kind = transaction.jenis;
    totals[kind] += amount;

    if (detail?.kategori_id) {
      if (!categoryTotals.has(detail.kategori_id)) categoryTotals.set(detail.kategori_id, { nama: detail.kategori?.nama || 'Kategori dihapus', masuk: 0, keluar: 0 });
      categoryTotals.get(detail.kategori_id)[kind] += amount;
    }
    addAccountMovement(detail, kind, amount);
  });

  const net = totals.masuk - totals.keluar;
  $('#report-income').textContent = money(totals.masuk);
  $('#report-expense').textContent = money(totals.keluar);
  $('#report-net').textContent = money(net);
  $('#report-net').classList.toggle('negative', net < 0);
  $('#report-count').textContent = transactions.length.toLocaleString('id-ID');
  $('#report-period-count').textContent = `${transactions.length.toLocaleString('id-ID')} transaksi`;
  $('#report-period-label').textContent = state.reportFrom && state.reportTo
    ? `${displayDate(state.reportFrom)} - ${displayDate(state.reportTo)}${isAccountReport ? ` · ${reportAccount?.nama || 'Semua Kas'}` : ''}`
    : 'Pilih periode';
  $('#report-income-label').textContent = specificAccount ? 'Arus masuk akun' : 'Total kas masuk';
  $('#report-expense-label').textContent = specificAccount ? 'Arus keluar akun' : 'Total kas keluar';
  $('#report-net-label').textContent = specificAccount ? 'Perubahan saldo' : 'Arus bersih';
  $('#report-net-caption').textContent = specificAccount ? 'Termasuk transfer akun ini' : 'Total masuk dikurangi keluar';

  const breakdownRows = (groups) => [...groups.values()]
    .sort((a, b) => (b.masuk + b.keluar) - (a.masuk + a.keluar) || a.nama.localeCompare(b.nama, 'id'));
  const renderBreakdown = (groups, emptyMessage) => {
    const rows = breakdownRows(groups).filter((row) => row.masuk || row.keluar);
    return rows.length ? rows.map((row) => {
      const rowNet = row.masuk - row.keluar;
      return `<tr><td>${escapeHtml(row.nama)}</td><td class="align-right positive">${money(row.masuk)}</td><td class="align-right negative">${money(row.keluar)}</td><td class="align-right ${rowNet < 0 ? 'negative' : 'positive'}">${money(rowNet)}</td></tr>`;
    }).join('') : `<tr><td class="report-empty-cell" colspan="4">${emptyMessage}</td></tr>`;
  };

  $('#report-category-rows').innerHTML = renderBreakdown(categoryTotals, 'Belum ada transaksi per kategori.');
  const visibleAccountTotals = specificAccount && includedAccounts
    ? new Map([...accountTotals].filter(([id]) => includedAccounts.has(id)))
    : accountTotals;
  $('#report-account-rows').innerHTML = renderBreakdown(visibleAccountTotals, 'Belum ada transaksi per akun kas.');
  $('#report-transaction-rows').innerHTML = transactions.length ? transactions.map((transaction) => {
    const detail = getDetail(transaction);
    const transfer = transaction.jenis === 'transfer';
    const sides = transfer ? getTransferSides(transaction) : null;
    const incoming = transaction.jenis === 'masuk';
    const amount = transfer ? sides.source?.nominal : detail?.nominal;
    const cashNames = transfer ? `${sides.source?.kas?.nama || 'Kas'} → ${sides.destination?.kas?.nama || 'Kas'}` : detail?.kas?.nama || 'Tanpa akun';
    const kindLabel = transfer ? 'Transfer' : incoming ? 'Masuk' : 'Keluar';
    return `<tr><td>${displayDate(transaction.tanggal)}</td><td><strong class="table-description">${escapeHtml(transaction.catatan)}</strong>${!transfer && detail?.catatan ? `<small class="table-subcopy">${escapeHtml(detail.catatan)}</small>` : ''}</td><td>${escapeHtml(transfer ? 'Transfer saldo' : detail?.kategori?.nama || 'Tanpa kategori')}</td><td>${escapeHtml(cashNames)}</td><td><span class="type-badge ${transfer ? 'transfer' : incoming ? 'in' : 'out'}"><span></span>${kindLabel}</span></td><td class="align-right ${transfer ? '' : incoming ? 'positive' : 'negative'}">${money(amount)}</td></tr>`;
  }).join('') : '<tr><td class="report-empty-cell" colspan="6">Tidak ada transaksi pada periode ini.</td></tr>';
  refreshIcons();
}

function exportReportCsv() {
  const transactions = reportTransactions();
  const fields = ['Tanggal', 'Jenis', 'Catatan', 'Kategori', 'Kas sumber', 'Kas tujuan', 'Nominal', 'Catatan tambahan'];
  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = transactions.map((transaction) => {
    const detail = getDetail(transaction);
    if (transaction.jenis === 'transfer') {
      const { source, destination } = getTransferSides(transaction);
      return [transaction.tanggal, 'transfer', transaction.catatan, 'Transfer saldo', source?.kas?.nama, destination?.kas?.nama, Number(source?.nominal || 0).toFixed(2), ''].map(csvCell).join(',');
    }
    return [transaction.tanggal, transaction.jenis, transaction.catatan, detail?.kategori?.nama, detail?.kas?.nama, '', Number(detail?.nominal || 0).toFixed(2), detail?.catatan].map(csvCell).join(',');
  });
  const content = `\uFEFF${[fields.map(csvCell).join(','), ...rows].join('\r\n')}`;
  const objectUrl = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `laporan-arus-kas-${state.reportFrom}-${state.reportTo}.csv`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function renderAll() {
  renderOverview();
  renderTransactions();
  renderReports();
  renderAccounts();
  renderCategories();
  renderAccountDetail();
  if ($('#view-accounting')) renderAccounting();
  refreshIcons();
}

function setView(name) {
  $$('.view-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `view-${name}`));
  const activeModule = state.accounting.module;
  const moduleNav = $(`.nav-link[data-view="accounting"][data-accounting-module="${activeModule}"]`);
  $$('.nav-link').forEach((link) => {
    const isActive = name === 'accounting'
      ? link === moduleNav || (!moduleNav && link.matches('.accounting-nav'))
      : link.dataset.view === name;
    link.classList.toggle('active', isActive);
  });
  $('#breadcrumb-current').textContent = name === 'account-detail'
    ? state.kas.find((account) => account.id === state.selectedAccountId)?.nama || 'Akun kas'
    : name === 'accounting'
      ? ({ cashier: 'Kasir (POS)', produk: 'Produk', inventory: 'Inventory', akun: 'Akuntansi SAK', 'akun-kas': 'Akuntansi SAK', 'kategori-akuntansi': 'Akuntansi SAK', reports: 'Akuntansi SAK' })[state.accounting.module] || 'Akuntansi SAK'
      : ({ overview: 'Ringkasan', transactions: 'Arus kas', reports: 'Laporan Arus Kas', accounts: 'Akuntansi SAK', categories: 'Akuntansi SAK', accounting: 'Akuntansi SAK' })[name];
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openAccountDetail(accountId) {
  state.selectedAccountId = accountId;
  renderAccountDetail();
  setView('account-detail');
}

function inputField({ name, label, type = 'text', value = '', required = true, placeholder = '', options = null, min = null, max = null, step = null }) {
  const requiredAttribute = required ? 'required' : '';
  if (options) return `<label class="field-label" for="field-${name}">${label}<select id="field-${name}" name="${name}" ${requiredAttribute}>${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
  return `<label class="field-label" for="field-${name}">${label}<input id="field-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${requiredAttribute}${min !== null ? ` min="${min}"` : ''}${max !== null ? ` max="${max}"` : ''}${step !== null ? ` step="${step}"` : ''}></label>`;
}

function openModal(kind, item = null, presetAccountId = null, presetKind = null) {
  state.modal = { kind, item };
  const titles = {
    transaction: item ? 'Ubah transaksi' : 'Catat transaksi',
    account: item ? 'Ubah akun kas' : 'Tambah akun kas',
    category: item ? 'Ubah kategori' : 'Tambah kategori',
    cash_entry: 'Ubah transaksi kas',
    restock: 'Catat Pembelian / Restock',
    sale: 'Ubah penjualan'
  };
  const eyebrow = { transaction: 'BUKU ARUS KAS', account: 'PENGELOLAAN KAS', category: 'KATEGORI HARIAN', cash_entry: 'BUKU ARUS KAS', restock: 'PEMBELIAN OFFLINE', sale: 'TRANSAKSI KASIR' };
  $('#modal-title').textContent = !item && kind === 'transaction'
    ? ({ masuk: 'Catat kas masuk', keluar: 'Catat kas keluar', transfer: 'Transfer saldo' })[presetKind] || titles[kind]
    : titles[kind];
  $('#modal-eyebrow').textContent = eyebrow[kind];
  $('#modal-description').textContent = kind === 'transaction' ? 'Pilih arah, sumber kas, dan kategori pencatatan.'
    : kind === 'account' ? 'Nama akun yang digunakan untuk menyimpan arus kas cafe.'
      : kind === 'category' ? 'Gunakan kategori untuk mengelompokkan pergerakan kas.'
        : kind === 'cash_entry' ? 'Perubahan transaksi akan memperbarui jurnal akuntansi terkait.'
          : kind === 'restock' ? 'Catat pembelian bahan offline. Nilai pembelian akan mengurangi kas dan menambah persediaan.'
            : 'Ubah tanggal, metode pembayaran, atau total penjualan.';
  $('#modal-error').textContent = '';
  const transferSides = item?.jenis === 'transfer' ? getTransferSides(item) : null;
  const details = item ? getDetail(item) : null;
  let fields = '';
  if (kind === 'restock') {
    const inventoryOptions = state.accounting.inventory.map((inventory) => ({
      value: inventory.id,
      label: `${inventory.nama_bahan} · stok ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(inventory.stok_saat_ini))} ${inventory.satuan}`
    }));
    fields = `<div class="field-grid">${inputField({ name: 'inventory_id', label: 'Pilih bahan', value: '', options: inventoryOptions })}${inputField({ name: 'jumlah_beli', label: 'Jumlah beli', type: 'number', value: '', min: '0.001', step: '0.001' })}</div>
      <div class="field-grid">${inputField({ name: 'harga_satuan', label: 'Harga satuan (Rp)', type: 'number', value: '', min: '0.01', step: '0.01' })}${inputField({ name: 'tanggal', label: 'Tanggal pembelian', type: 'date', value: todayIso })}</div>
      ${inputField({ name: 'vendor', label: 'Nama vendor', value: '', placeholder: 'Nama toko / pemasok' })}`;
  } else if (kind === 'sale') {
    fields = `<div class="field-grid">${inputField({ name: 'tanggal', label: 'Tanggal', type: 'date', value: item.tanggal })}${inputField({ name: 'metode_bayar', label: 'Metode bayar', value: item.metode_bayar || 'Tunai', options: [{ value: 'Tunai', label: 'Tunai' }, { value: 'QRIS', label: 'QRIS' }] })}</div>${inputField({ name: 'total', label: 'Total penjualan (Rp)', type: 'number', value: item.total, min: '1', step: '1' })}`;
  } else if (kind === 'cash_entry') {
    const row = item.row;
    const accountOptions = state.accounting.akun.map((account) => ({ value: account.id, label: `${account.kode_akun} · ${account.nama_akun}` }));
    const categoryOptions = state.kategori.map((category) => ({ value: category.id, label: category.nama_kategori || category.nama }));
    fields = `<div class="field-grid">${inputField({ name: 'tanggal', label: 'Tanggal', type: 'date', value: row.tanggal })}${inputField({ name: 'jumlah', label: 'Nominal (Rp)', type: 'number', value: row.jumlah, min: '1', step: '1' })}</div>${inputField({ name: 'keterangan', label: 'Keterangan', value: row.keterangan })}<div class="field-grid">${inputField({ name: 'akun_id', label: 'Akun lawan', value: row.akun_id, options: accountOptions })}${inputField({ name: 'kategori_id', label: 'Kategori', value: row.kategori_id || '', required: false, options: [{ value: '', label: 'Tanpa kategori' }, ...categoryOptions] })}</div>${inputField({ name: 'ref_transaksi', label: 'Referensi', value: row.ref_transaksi || '', required: false })}`;
  } else if (kind === 'transaction') {
    const allAccountOptions = orderedKas().map((account) => {
      return { value: account.id, label: account.nama };
    });
    const selectedKind = item?.jenis || presetKind || 'masuk';
    const categories = state.kategori.filter((category) => category.jenis === selectedKind);
    const categoryOptions = categories.map((category) => ({ value: category.id, label: category.nama }));
    const mainCash = getMainCashAccount();
    const sourceId = selectedKind === 'transfer'
      ? transferSides?.source?.kas_id || details?.kas_id || presetAccountId || allAccountOptions[0]?.value || ''
      : mainCash?.id || '';
    const destinationId = transferSides?.destination?.kas_id || allAccountOptions.find((option) => option.value !== sourceId)?.value || '';
    const kindOptions = [{ value: 'masuk', label: 'Kas masuk' }, { value: 'keluar', label: 'Kas keluar' }];
    if (item?.jenis === 'transfer') kindOptions.push({ value: 'transfer', label: 'Transfer antar kas' });
    const cashField = selectedKind === 'transfer'
      ? inputField({ name: 'kas_id', label: 'Kas sumber', value: sourceId, options: allAccountOptions })
      : `<input type="hidden" name="kas_id" id="field-kas_id" value="${escapeHtml(sourceId)}"><p class="muted cash-account-note">Penyimpanan otomatis: <strong>Kas Utama</strong></p>`;
    const destinationField = selectedKind === 'transfer'
      ? `<div id="transfer-destination-field">${inputField({ name: 'kas_tujuan_id', label: 'Kas tujuan', value: destinationId, options: allAccountOptions })}</div>`
      : '<div id="transfer-destination-field" hidden></div>';
    fields = `<div class="field-grid">${inputField({ name: 'tanggal', label: 'Tanggal', type: 'date', value: item?.tanggal || todayIso })}${inputField({ name: 'jenis', label: 'Jenis arus kas', value: selectedKind, options: kindOptions })}</div>${inputField({ name: 'catatan', label: 'Catatan transaksi', value: item?.catatan || '', placeholder: selectedKind === 'transfer' ? 'Contoh: Pengisian kas operasional' : 'Contoh: Penjualan minuman' })}<div class="field-grid">${cashField}<div id="transfer-category-field">${inputField({ name: 'kategori_id', label: 'Kategori', value: details?.kategori_id || categoryOptions[0]?.value || '', options: categoryOptions.length ? categoryOptions : [{ value: '', label: 'Tambahkan kategori yang sesuai' }] })}</div>${destinationField}</div><div class="field-grid">${inputField({ name: 'nominal', label: 'Nominal (Rp)', type: 'number', value: transferSides?.source?.nominal || details?.nominal || '', placeholder: '0', min: '1', step: '1' })}${inputField({ name: 'detail_catatan', label: 'Rincian item / catatan', value: transferSides ? '' : details?.catatan || '', required: false, placeholder: 'Contoh: Latte, Americano, atau modal awal' })}</div>`;
  } else if (kind === 'account') {
    const parentOptions = [
      { value: '', label: 'Akun utama (tanpa induk)' },
      ...state.kas.filter((account) => !account.induk_kas_id && account.id !== item?.id).map((account) => ({ value: account.id, label: account.nama }))
    ];
    fields = `<div class="field-grid">${inputField({ name: 'nama', label: 'Nama akun', value: item?.nama || '', placeholder: 'Contoh: Kas Operasional' })}${inputField({ name: 'induk_kas_id', label: 'Bagian dari akun', value: item?.induk_kas_id || '', required: false, options: parentOptions })}</div>${inputField({ name: 'deskripsi', label: 'Deskripsi', value: item?.deskripsi || '', required: false, placeholder: 'Kegunaan akun kas ini' })}`;
  } else {
    fields = `<div class="field-grid">${inputField({ name: 'nama', label: 'Nama kategori', value: item?.nama || '', placeholder: 'Contoh: Bahan baku' })}${inputField({ name: 'jenis', label: 'Jenis arus kas', value: item?.jenis || 'keluar', options: [{ value: 'masuk', label: 'Kas masuk' }, { value: 'keluar', label: 'Kas keluar' }] })}</div>`;
  }
  $('#modal-fields').innerHTML = fields;
  const submitText = kind === 'transaction' ? selectedTransactionLabel(item, presetKind)
    : kind === 'account' ? 'Simpan akun' : kind === 'category' ? 'Simpan kategori'
      : kind === 'restock' ? 'Simpan pembelian' : 'Simpan perubahan';
  $('#modal-submit').innerHTML = `${icon('check')} ${submitText}`;
  $('#modal-backdrop').hidden = false;
  document.body.classList.add('modal-open');
  if (kind === 'transaction') {
    $('#field-jenis').addEventListener('change', () => {
      updateCategoryOptions();
      if (!item) {
        const selectedKind = $('#field-jenis').value;
        $('#modal-title').textContent = ({ masuk: 'Catat kas masuk', keluar: 'Catat kas keluar', transfer: 'Transfer saldo' })[selectedKind];
        $('#modal-submit').innerHTML = `${icon('check')} ${selectedTransactionLabel(null, selectedKind)}`;
        refreshIcons();
      }
    });
    $('#field-kategori_id').addEventListener('change', updateItemDescriptionField);
    $('#field-kas_id')?.addEventListener('change', updateCategoryOptions);
    $('#field-kas_tujuan_id')?.addEventListener('change', updateCategoryOptions);
    updateCategoryOptions();
  }
  $('#modal-fields input, #modal-fields select')?.focus();
  refreshIcons();
}

function selectedTransactionLabel(item, presetKind) {
  if (item) return 'Simpan perubahan';
  if (presetKind === 'masuk') return 'Simpan kas masuk';
  if (presetKind === 'keluar') return 'Simpan kas keluar';
  if (presetKind === 'transfer') return 'Simpan transfer';
  return 'Simpan transaksi';
}

function updateCategoryOptions() {
  const isTransfer = $('#field-jenis').value === 'transfer';
  const sourceSelect = $('#field-kas_id');
  const destinationSelect = $('#field-kas_tujuan_id');
  const categorySelect = $('#field-kategori_id');
  const currentSource = sourceSelect?.value || '';
  const currentDestination = destinationSelect?.value || '';
  const accounts = orderedKas().map((account) => {
    const parent = state.kas.find((candidate) => candidate.id === account.induk_kas_id);
    return { value: account.id, label: account.nama, account };
  });
  if (sourceSelect?.tagName === 'SELECT') {
    const destinationOptions = accounts.filter((option) => option.value !== currentSource);
    const validDestination = destinationOptions.some((option) => option.value === currentDestination) ? currentDestination : destinationOptions[0]?.value || '';
    sourceSelect.innerHTML = accounts.length ? accounts.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join('') : '<option value="">Kas Utama tidak tersedia</option>';
    sourceSelect.value = accounts.some((option) => option.value === currentSource) ? currentSource : accounts[0]?.value || '';
    if (destinationSelect) {
      destinationSelect.innerHTML = destinationOptions.length ? destinationOptions.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join('') : '<option value="">Pilih kas sumber yang berbeda</option>';
      destinationSelect.value = validDestination;
    }
  } else if (sourceSelect) {
    sourceSelect.value = getMainCashAccount()?.id || '';
  }
  $('#transfer-category-field').hidden = isTransfer;
  if (categorySelect) categorySelect.disabled = isTransfer;
  $('#transfer-destination-field').hidden = !isTransfer;
  if (destinationSelect) destinationSelect.disabled = !isTransfer;
  if (sourceSelect?.tagName === 'SELECT') sourceSelect.closest('label').firstChild.textContent = 'Kas sumber';

  const categories = state.kategori.filter((category) => category.jenis === $('#field-jenis').value);
  const selectedCategory = categorySelect.value;
  if (categorySelect) {
    categorySelect.innerHTML = categories.length ? categories.map((category) => `<option value="${category.id}">${escapeHtml(category.nama)}</option>`).join('') : '<option value="">Tambahkan kategori yang sesuai</option>';
    if (categories.some((category) => category.id === selectedCategory)) categorySelect.value = selectedCategory;
  }
  updateItemDescriptionField();
  $('#modal-description').textContent = isTransfer
    ? 'Pindahkan saldo antar akun kas tanpa mengubah pemasukan atau pengeluaran cafe.'
    : 'Kas Utama dipilih otomatis; tentukan tanggal, jenis, kategori, dan nominal.';
}

function updateItemDescriptionField() {
  const category = state.kategori.find((item) => item.id === $('#field-kategori_id')?.value);
  const field = $('#field-detail_catatan');
  const label = field?.closest('label');
  if (!field || !label) return;
  const isSale = category?.jenis === 'masuk' && category.nama.toLocaleLowerCase('id-ID').includes('penjualan');
  label.firstChild.textContent = isSale ? 'Nama minuman / produk' : 'Rincian item / catatan';
  field.placeholder = isSale ? 'Contoh: Caffe, Latte, Americano' : 'Contoh: Latte, Americano, atau modal awal';
}

function closeModal() {
  $('#modal-backdrop').hidden = true;
  document.body.classList.remove('modal-open');
  state.modal = null;
}

function showReceipt({ sale, method, cashier, items, subtotal, tax, total }) {
  const receiptNo = sale?.no_transaksi || `POS-${todayIso.replaceAll('-', '')}-${String(sale?.id || Date.now()).slice(-6)}`;
  const rows = items.map((item) => `<div class="receipt-item"><span>${escapeHtml(item.nama_produk)} × ${item.qty}</span><strong>${money(item.subtotal + item.ppn)}</strong></div>`).join('');
  $('#receipt-content').innerHTML = `<p class="receipt-center">Terima kasih telah berkunjung</p>
    <div class="receipt-divider"></div>
    <div class="receipt-meta"><span>No. transaksi</span><strong>${escapeHtml(receiptNo)}</strong><span>Tanggal</span><strong>${displayDate(sale?.tanggal || todayIso)}</strong><span>Kasir</span><strong>${escapeHtml(cashier || 'Kasir')}</strong><span>Metode bayar</span><strong>${escapeHtml(method)}</strong></div>
    <div class="receipt-divider"></div><div class="receipt-items">${rows}</div>
    <div class="receipt-divider"></div><div class="receipt-totals"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>PPN</span><strong>${money(tax)}</strong></div><div class="receipt-total"><span>TOTAL</span><strong>${money(total)}</strong></div></div>
    <p class="receipt-center receipt-footer">Semoga harimu menyenangkan!</p>`;
  $('#receipt-backdrop').hidden = false;
  document.body.classList.add('receipt-open');
  refreshIcons();
}

function renderSaleReceipt(sale, details) {
  if (!sale || !details.length) {
    toast('Rincian penjualan belum tersedia sehingga struk tidak dapat ditampilkan.', true);
    return;
  }
  const cashier = state.accounting.karyawan.find((person) => person.id === sale.kasir_id)?.nama || 'Kasir';
  const items = details.map((item) => ({
    nama_produk: item.nama_produk_snapshot || state.accounting.produk.find((product) => product.id === item.produk_id)?.nama_produk || 'Produk',
    qty: Number(item.qty),
    subtotal: Number(item.subtotal),
    ppn: Number(item.ppn_item)
  }));
  showReceipt({
    sale,
    method: sale.metode_bayar,
    cashier,
    items,
    subtotal: Number(sale.subtotal),
    tax: Number(sale.ppn),
    total: Number(sale.total)
  });
}

function openSaleReceipt(saleId) {
  const sale = state.accounting.transaksi_penjualan.find((item) => item.id === saleId);
  if (!sale) {
    toast('Data penjualan tidak ditemukan. Muat ulang data terlebih dahulu.', true);
    return;
  }
  const details = state.accounting.detail_penjualan.filter((item) => item.penjualan_id === sale.id);
  renderSaleReceipt(sale, details);
}

async function openSaleReceiptByNumber(receiptNo) {
  try {
    const sale = await request(`/api/accounting/receipt/${encodeURIComponent(receiptNo)}`);
    const details = Array.isArray(sale.detail_penjualan) ? sale.detail_penjualan : [];
    renderSaleReceipt(sale, details);
  } catch (error) {
    toast(`Data struk ${receiptNo} gagal dimuat: ${error.message}`, true);
  }
}

function closeReceipt() {
  $('#receipt-backdrop').hidden = true;
  document.body.classList.remove('receipt-open');
}

function openCashEvidence(transactionId) {
  const transaction = getMainCashTransactions().find((item) => String(item.id) === String(transactionId));
  if (!transaction) {
    toast('Data transaksi tidak ditemukan untuk bukti kas.', true);
    return;
  }
  const detail = getDetail(transaction);
  const amount = transaction.jenis === 'transfer'
    ? getTransferSides(transaction).source?.nominal
    : detail?.nominal;
  $('#cash-evidence-title').textContent = 'Bukti Kas';
  $('#cash-evidence-content').innerHTML = `<div class="cash-evidence-meta">
    <span>Tanggal</span><strong>${displayDate(transaction.tanggal)}</strong>
    <span>Keterangan</span><strong>${escapeHtml(transaction.catatan || '-')}</strong>
    <span>Nominal</span><strong>${money(amount)}</strong>
  </div><div class="cash-evidence-signature"><span>Tanda Tangan Pemilik</span><i></i></div>`;
  $('#cash-evidence-backdrop').hidden = false;
  document.body.classList.add('modal-open');
}

function closeCashEvidence() {
  $('#cash-evidence-backdrop').hidden = true;
  document.body.classList.remove('modal-open');
  document.body.classList.remove('cash-evidence-printing');
}

function showRestockEvidence(purchase) {
  $('#cash-evidence-title').textContent = 'Bukti Pengeluaran Kas';
  $('#cash-evidence-content').innerHTML = `<div class="cash-evidence-receipt">
    <div class="cash-evidence-receipt-meta">
      <div><span>No. Referensi</span><strong>${escapeHtml(purchase.referensi)}</strong></div>
      <div><span>Tanggal</span><strong>${displayDate(purchase.tanggal)}</strong></div>
      <div><span>Vendor</span><strong>${escapeHtml(purchase.vendor)}</strong></div>
    </div>
    <div class="cash-evidence-divider"></div>
    <p class="cash-evidence-description">${escapeHtml(purchase.keterangan || `Pembelian bahan baku: ${purchase.nama_bahan}`)}</p>
    <div class="cash-evidence-divider"></div>
    <div class="cash-evidence-line"><span>Bahan</span><strong>${escapeHtml(purchase.nama_bahan)}</strong></div>
    <div class="cash-evidence-line"><span>Jumlah</span><strong>${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(Number(purchase.jumlah_beli))} ${escapeHtml(purchase.satuan)}</strong></div>
    <div class="cash-evidence-line"><span>Harga Satuan</span><strong>${money(purchase.harga_satuan)}</strong></div>
    <div class="cash-evidence-divider"></div>
    <div class="cash-evidence-line cash-evidence-total"><span>Total</span><strong>${money(purchase.total)}</strong></div>
    <div class="cash-evidence-signature"><span>Tanda Tangan Pemilik</span><i></i></div>
  </div>`;
  $('#cash-evidence-backdrop').hidden = false;
  document.body.classList.add('modal-open');
}

function openSaleEditModal(saleNo) {
  const sale = state.accounting.transaksi_penjualan.find((item) => item.no_transaksi === saleNo);
  if (!sale) {
    toast('Data penjualan tidak ditemukan. Segarkan data dan coba lagi.', true);
    return;
  }
  openModal('sale', sale);
}

function openAccountingCashEdit(table, id) {
  const row = state.accounting[table]?.find((item) => item.id === id);
  if (!row) {
    toast('Transaksi kas tidak ditemukan. Segarkan data dan coba lagi.', true);
    return;
  }
  openModal('cash_entry', { cash_table: table, row });
}

function openRestockModal() {
  if (!state.accounting.inventory.length) {
    toast('Tambahkan bahan Inventory terlebih dahulu sebelum mencatat pembelian.', true);
    return;
  }
  openModal('restock');
}

function openProductModal(product = null) {
  state.modal = { kind: 'product', item: product };
  const productRecipes = product
    ? state.accounting.resep_produk.filter((recipe) => recipe.produk_id === product.id)
    : [];
  const inventoryOptions = state.accounting.inventory.map((item) =>
    `<option value="${item.id}">${escapeHtml(item.nama_bahan)} · ${escapeHtml(item.satuan)}</option>`
  ).join('');
  $('#modal-title').textContent = product ? 'Edit produk' : 'Tambah produk baru';
  $('#modal-eyebrow').textContent = 'KATALOG KASIR';
  $('#modal-description').textContent = 'Simpan data produk langsung ke katalog Supabase.';
  $('#modal-error').textContent = '';
  $('#modal-fields').innerHTML = `<div class="field-grid">
      ${inputField({ name: 'nama_produk', label: 'Nama produk', value: product?.nama_produk || '' })}
      ${inputField({ name: 'tipe', label: 'Jenis produk', value: product?.tipe || 'minuman', options: [{ value: 'minuman', label: 'Minuman' }, { value: 'makanan', label: 'Makanan' }] })}
    </div><div class="field-grid">
      ${inputField({ name: 'harga_jual', label: 'Harga jual (Rp)', type: 'number', value: product?.harga_jual ?? '', min: '0', step: '1' })}
      ${inputField({ name: 'ppn_rate', label: 'PPN (%)', type: 'number', value: product?.ppn_rate ?? 11, min: '0', max: '100', step: '0.01' })}
    </div>${inputField({ name: 'deskripsi', label: 'Deskripsi', value: product?.deskripsi || '', required: false, placeholder: 'Deskripsi singkat produk' })}
    ${inputField({ name: 'foto_url', label: 'URL foto', type: 'url', value: product?.foto_url?.startsWith('data:image/') ? '' : product?.foto_url || '', required: false, placeholder: 'https://...' })}
    <label class="field-label">Upload foto<input id="product-photo-file" name="foto_file" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG, atau WebP · maksimal 512 KB</small></label>
    <div class="product-photo-preview-wrap"><img id="product-photo-preview" class="product-photo-preview" ${product?.foto_url ? `src="${escapeHtml(productImageSrc(product))}"` : ''} alt="Preview foto produk" ${product?.foto_url ? '' : 'hidden'}><span id="product-photo-empty" ${product?.foto_url ? 'hidden' : ''}>Preview foto akan tampil di sini</span></div>
    <section class="product-recipe-section" aria-labelledby="product-recipe-title">
      <div class="product-recipe-heading"><div><strong id="product-recipe-title">Bahan Baku (Resep)</strong><small>Stok dipotong otomatis saat pembayaran berhasil.</small></div><button class="button button-quiet" type="button" id="product-recipe-add" ${state.accounting.inventory.length ? '' : 'disabled'}>Tambah bahan</button></div>
      ${state.accounting.inventory.length ? `<div class="product-recipe-list" id="product-recipe-list"></div>` : '<p class="product-recipe-empty">Tambahkan bahan di Inventory sebelum membuat resep.</p>'}
    </section>`;
  $('#modal-submit').innerHTML = `${icon('check')} ${product ? 'Simpan perubahan' : 'Simpan produk'}`;
  $('#modal-backdrop').hidden = false;
  document.body.classList.add('modal-open');
  const urlInput = $('#modal-fields [name="foto_url"]');
  const fileInput = $('#product-photo-file');
  const preview = $('#product-photo-preview');
  const empty = $('#product-photo-empty');
  const recipeList = $('#product-recipe-list');
  const appendRecipeRow = (recipe = {}) => {
    if (!recipeList) return;
    const selectedIds = $$('.product-recipe-row select', recipeList).map((select) => select.value).filter(Boolean);
    const availableOptions = state.accounting.inventory
      .filter((ingredient) => !selectedIds.includes(ingredient.id) || ingredient.id === recipe.inventory_id)
      .map((ingredient) => `<option value="${ingredient.id}" ${ingredient.id === recipe.inventory_id ? 'selected' : ''}>${escapeHtml(ingredient.nama_bahan)} · ${escapeHtml(ingredient.satuan)}</option>`)
      .join('');
    const row = document.createElement('div');
    row.className = 'product-recipe-row';
    row.innerHTML = `<label class="accounting-field">Bahan<select name="recipe_inventory" required><option value="">Pilih bahan...</option>${availableOptions}</select></label>
      <label class="accounting-field">Jumlah pemakaian<input name="recipe_quantity" type="number" min="0.001" step="0.001" value="${escapeHtml(recipe.jumlah_pemakaian ?? '')}" required></label>
      <button class="button button-quiet danger-text" type="button" data-recipe-remove aria-label="Hapus bahan dari resep">Hapus</button>`;
    recipeList.append(row);
  };
  productRecipes.forEach(appendRecipeRow);
  $('#product-recipe-add')?.addEventListener('click', () => appendRecipeRow());
  recipeList?.addEventListener('click', (event) => {
    if (event.target.closest('[data-recipe-remove]')) event.target.closest('.product-recipe-row').remove();
  });
  const previewSource = (source) => {
    if (!source) {
      preview.hidden = true;
      preview.removeAttribute('src');
      empty.hidden = false;
      return;
    }
    preview.src = source;
    preview.hidden = false;
    empty.hidden = true;
  };
  urlInput.addEventListener('input', () => {
    if (urlInput.value.trim()) {
      fileInput.value = '';
      const source = urlInput.value.trim();
      if (/^https?:\/\//i.test(source)) previewSource(source);
      else {
        previewSource('');
        empty.textContent = 'Masukkan URL HTTPS yang valid.';
      }
    } else if (!fileInput.files.length) previewSource('');
  });
  preview.addEventListener('error', () => {
    preview.hidden = true;
    empty.hidden = false;
    empty.textContent = 'Gambar tidak dapat dimuat. Periksa URL atau file.';
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      fileInput.value = '';
      $('#modal-error').textContent = 'Pilih foto berformat JPG, PNG, atau WebP.';
      return;
    }
    if (file.size > 512 * 1024) {
      fileInput.value = '';
      $('#modal-error').textContent = 'Ukuran foto maksimal 512 KB agar aman disimpan sebagai Base64.';
      return;
    }
    $('#modal-error').textContent = '';
    urlInput.value = '';
    try { previewSource(await fileAsDataUrl(file)); }
    catch (error) { $('#modal-error').textContent = error.message; }
  });
  $('#modal-fields [name="nama_produk"]').focus();
  refreshIcons();
}

async function saveModal(event) {
  event.preventDefault();
  if (!state.modal) return;
  const { kind, item } = state.modal;
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const button = $('#modal-submit');
  button.disabled = true;
  $('#modal-error').textContent = '';
  try {
    if (kind === 'product') {
      const form = event.currentTarget;
      const values = { ...data };
      const recipeRows = $$('.product-recipe-row', form).map((row) => ({
        inventory_id: row.querySelector('[name="recipe_inventory"]').value,
        jumlah_pemakaian: Number(row.querySelector('[name="recipe_quantity"]').value)
      }));
      if (recipeRows.some((recipe) => !recipe.inventory_id || !Number.isFinite(recipe.jumlah_pemakaian) || recipe.jumlah_pemakaian <= 0)) {
        throw new Error('Pilih bahan dan isi jumlah pemakaian resep dengan nilai lebih besar dari nol.');
      }
      if (new Set(recipeRows.map((recipe) => recipe.inventory_id)).size !== recipeRows.length) {
        throw new Error('Bahan yang sama hanya boleh dicantumkan satu kali dalam resep.');
      }
      const photoFile = form.querySelector('[name="foto_file"]').files[0];
      delete values.foto_file;
      if (photoFile) {
        if (photoFile.size > 512 * 1024) throw new Error('Ukuran foto maksimal 512 KB.');
        values.foto_url = await fileAsDataUrl(photoFile);
      } else {
        const submittedUrl = String(values.foto_url || '').trim();
        if (submittedUrl && !/^https?:\/\//i.test(submittedUrl)) {
          throw new Error('URL foto harus menggunakan HTTP atau HTTPS.');
        }
        values.foto_url = submittedUrl || item?.foto_url || '';
      }
      if (values.foto_url && !/^(https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(values.foto_url)) {
        throw new Error('URL foto harus menggunakan HTTPS atau pilih file gambar.');
      }
      values.harga_jual = Number(values.harga_jual);
      values.ppn_rate = Number(values.ppn_rate);
      const savedProduct = await request(`/api/accounting/produk${item ? `/${item.id}` : ''}`, {
        method: item ? 'PATCH' : 'POST',
        body: JSON.stringify(values)
      });
      try {
        await request('/api/accounting/rpc/simpan_resep_produk', {
          method: 'POST',
          body: JSON.stringify({ p_produk_id: savedProduct.id, p_bahan: recipeRows })
        });
      } catch (error) {
        state.modal.item = savedProduct;
        throw new Error(`Produk tersimpan, tetapi resep gagal disimpan: ${error.message} Periksa koneksi/tabel resep, lalu simpan kembali.`);
      }
      closeModal();
      toast(item ? 'Produk berhasil diperbarui.' : 'Produk berhasil ditambahkan.');
      try { await loadData(); }
      catch (error) { toast(`Produk tersimpan, tetapi katalog gagal dimuat ulang: ${error.message}`, true); }
    } else if (kind === 'restock') {
      const quantity = Number(data.jumlah_beli);
      const unitPrice = Number(data.harga_satuan);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error('Jumlah beli dan harga satuan harus lebih besar dari nol.');
      }
      const purchase = await request('/api/accounting/rpc/catat_restock_inventory', {
        method: 'POST',
        body: JSON.stringify({
          p_inventory_id: data.inventory_id,
          p_jumlah: quantity,
          p_harga_satuan: unitPrice,
          p_tanggal: data.tanggal,
          p_vendor: String(data.vendor || '').trim()
        })
      });
      if (!purchase || !purchase.referensi || !purchase.nama_bahan) {
        throw new Error('Pembelian mungkin tersimpan, tetapi data bukti tidak diterima. Segarkan data dan periksa Arus Kas.');
      }
      closeModal();
      try {
        await loadData();
      } catch (error) {
        toast(`Pembelian tersimpan, tetapi data gagal disegarkan: ${error.message}`, true);
      }
      showRestockEvidence(purchase);
      toast('Restock tersimpan; stok, Arus Kas, dan jurnal sudah diperbarui.');
      return;
    } else if (kind === 'sale') {
      const total = Number(data.total);
      if (!Number.isFinite(total) || total <= 0) throw new Error('Total penjualan harus lebih besar dari nol.');
      await request('/api/accounting/rpc/ubah_penjualan', {
        method: 'POST',
        body: JSON.stringify({
          p_no_transaksi: item.no_transaksi,
          p_tanggal: data.tanggal,
          p_metode_bayar: data.metode_bayar,
          p_total: total
        })
      });
    } else if (kind === 'cash_entry') {
      const table = item.cash_table;
      const payload = {
        tanggal: data.tanggal,
        jumlah: Number(data.jumlah),
        keterangan: String(data.keterangan).trim(),
        akun_id: data.akun_id,
        kategori_id: data.kategori_id || null,
        ref_transaksi: data.ref_transaksi || ''
      };
      if (!Number.isFinite(payload.jumlah) || payload.jumlah <= 0) throw new Error('Nominal harus lebih besar dari nol.');
      await request(`/api/accounting/${table}/${item.row.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else if (kind === 'transaction') {
      const mainCash = getMainCashAccount();
      if (!mainCash) throw new Error('Akun Kas Utama belum tersedia. Pastikan seed Kas Utama sudah dijalankan di Supabase.');
      let payload;
      if (data.jenis === 'transfer') {
        if (!data.kas_tujuan_id || data.kas_id === data.kas_tujuan_id) throw new Error('Pilih kas sumber dan kas tujuan yang berbeda.');
        payload = { tanggal: data.tanggal, jenis: 'transfer', catatan: data.catatan, kas_id: data.kas_id, kas_tujuan_id: data.kas_tujuan_id, nominal: Number(data.nominal) };
      } else {
        if (!state.kategori.some((category) => category.jenis === data.jenis)) throw new Error('Tambahkan kategori yang sesuai sebelum mencatat transaksi.');
        payload = { tanggal: data.tanggal, jenis: data.jenis, catatan: data.catatan, kas_id: mainCash.id, kategori_id: data.kategori_id, nominal: Number(data.nominal), detail_catatan: data.detail_catatan };
      }
      await request(item ? `/api/transaksi/${item.id}` : '/api/transaksi', { method: item ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    } else {
      if (kind === 'account' && item?.nama === 'Kas Utama' && data.nama !== 'Kas Utama') {
        throw new Error('Nama Kas Utama harus dipertahankan sebagai akun default.');
      }
      const path = kind === 'account' ? '/api/kas' : '/api/kategori';
      const payload = kind === 'account' ? { ...data, induk_kas_id: data.induk_kas_id || null } : data;
      await request(`${path}${item ? `/${item.id}` : ''}`, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    await loadData();
    toast(kind === 'transaction' ? 'Transaksi tersimpan.'
      : kind === 'account' ? 'Akun kas tersimpan.'
        : kind === 'category' ? 'Kategori tersimpan.'
          : kind === 'sale' ? 'Penjualan diperbarui.'
            : 'Transaksi kas diperbarui.');
  } catch (error) {
    $('#modal-error').textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function deleteItem(kind, id) {
  const names = { transaction: 'transaksi', account: 'akun kas', category: 'kategori' };
  if (kind === 'account' && state.kas.find((account) => account.id === id)?.nama === 'Kas Utama') {
    toast('Kas Utama adalah akun default dan tidak dapat dihapus.', true);
    return;
  }
  if (kind === 'account' && state.kas.some((account) => account.induk_kas_id === id)) {
    toast('Akun utama masih memiliki akun rincian. Pindahkan atau hapus akun rinciannya terlebih dahulu.', true);
    return;
  }
  if (!window.confirm(`Hapus ${names[kind]} ini? Tindakan ini tidak dapat dibatalkan.`)) return;
  const path = kind === 'transaction' ? '/api/transaksi' : kind === 'account' ? '/api/kas' : '/api/kategori';
  try {
    await request(`${path}/${id}`, { method: 'DELETE' });
    await loadData();
    toast(`${names[kind][0].toUpperCase()}${names[kind].slice(1)} dihapus.`);
  } catch (error) {
    toast(error.message, true);
  }
}

function toast(message, error = false) {
  const element = document.createElement('div');
  element.className = `toast${error ? ' toast-error' : ''}`;
  element.innerHTML = `${icon(error ? 'circle-alert' : 'circle-check')}<span>${escapeHtml(message)}</span>`;
  $('#toast-region').append(element);
  refreshIcons();
  window.setTimeout(() => element.remove(), 3600);
}

function setTodayLabel() {
  $('#today-label').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today);
  $('.page-heading .eyebrow').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today).toLocaleUpperCase('id-ID');
  $('#month-filter').value = '';
  state.reportFrom = `${monthIso}-01`;
  state.reportTo = todayIso;
  $('#report-start').value = state.reportFrom;
  $('#report-end').value = state.reportTo;
}

const accountingModules = {
  produk: {
    title: 'Produk', table: 'produk', fields: [
      ['nama_produk', 'Nama produk'], ['tipe', 'Jenis', 'select', [['minuman', 'Minuman'], ['makanan', 'Makanan']]],
      ['harga_jual', 'Harga jual', 'number'], ['ppn_rate', 'PPN (%)', 'number'], ['deskripsi', 'Deskripsi', 'text', null, false],
      ['foto_url', 'URL foto', 'text', null, false]
    ], columns: ['nama_produk', 'tipe', 'harga_jual', 'ppn_rate']
  },
  karyawan: {
    title: 'Karyawan', table: 'karyawan', fields: [
      ['nama', 'Nama'], ['jabatan', 'Jabatan'], ['gaji_pokok', 'Gaji pokok', 'number'],
      ['ptkp_status', 'Status PTKP', 'select', [['TK/0', 'TK/0'], ['TK/1', 'TK/1'], ['TK/2', 'TK/2'], ['TK/3', 'TK/3'], ['K/0', 'K/0'], ['K/1', 'K/1'], ['K/2', 'K/2'], ['K/3', 'K/3']]],
      ['npwp', 'NPWP', 'text', null, false], ['tanggal_masuk', 'Tanggal masuk', 'date']
    ], columns: ['nama', 'jabatan', 'gaji_pokok', 'ptkp_status']
  },
  akun: {
    title: 'Bagan Akun (COA)', table: 'akun', fields: [
      ['kode_akun', 'Kode akun'], ['nama_akun', 'Nama akun'],
      ['tipe', 'Tipe akun', 'select', [['aset', 'Aset'], ['kewajiban', 'Kewajiban'], ['ekuitas', 'Ekuitas'], ['pendapatan', 'Pendapatan'], ['beban', 'Beban']]],
      ['saldo_normal', 'Saldo normal', 'select', [['debit', 'Debit'], ['kredit', 'Kredit']]]
    ], columns: ['kode_akun', 'nama_akun', 'tipe', 'saldo_normal']
  },
  'kategori-akuntansi': {
    title: 'Kategori', table: 'kategori', fields: [
      ['nama_kategori', 'Nama kategori'], ['jenis', 'Jenis', 'select', [['masuk', 'Masuk'], ['keluar', 'Keluar']]],
      ['deskripsi', 'Deskripsi', 'text', null, false]
    ], columns: ['nama_kategori', 'jenis']
  },
  kas_masuk: {
    title: 'Kas Masuk', table: 'kas_masuk', fields: [
      ['tanggal', 'Tanggal', 'date'], ['akun_id', 'Akun lawan (pendapatan/modal)', 'select'],
      ['kategori_id', 'Kategori', 'select', null, false], ['jumlah', 'Jumlah', 'number'], ['keterangan', 'Keterangan'],
      ['ref_transaksi', 'Referensi', 'text', null, false]
    ], columns: ['tanggal', 'jumlah', 'keterangan']
  },
  kas_keluar: {
    title: 'Kas Keluar', table: 'kas_keluar', fields: [
      ['tanggal', 'Tanggal', 'date'], ['akun_id', 'Akun beban', 'select'],
      ['kategori_id', 'Kategori', 'select', null, false], ['jumlah', 'Jumlah', 'number'], ['keterangan', 'Keterangan'],
      ['ref_transaksi', 'Referensi', 'text', null, false]
    ], columns: ['tanggal', 'jumlah', 'keterangan']
  },
  inventory: {
    title: 'Inventory', table: 'inventory', fields: [
      ['nama_bahan', 'Nama Bahan'], ['stok_saat_ini', 'Stok Saat Ini', 'number'],
      ['satuan', 'Satuan', 'select', [['gram', 'gram'], ['liter', 'liter'], ['pcs', 'pcs']]],
      ['minimal_stok', 'Minimal Stok', 'number'], ['no_referensi', 'No. Referensi / Nota', 'text', null, false]
    ], columns: ['nama_bahan', 'stok_saat_ini', 'satuan', 'minimal_stok', 'no_referensi']
  }
};

function accountingField(name, label, value = '', type = 'text', options = null, required = true) {
  const fieldValue = value ?? (type === 'date' ? todayIso : '');
  if (type === 'select') {
    const choices = options || [];
    return `<label class="accounting-field">${escapeHtml(label)}<select name="${name}" ${required ? 'required' : ''}><option value="">Pilih...</option>${choices.map(([key, text]) => `<option value="${escapeHtml(key)}" ${String(key) === String(fieldValue) ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
  }
  const numeric = type === 'number';
  return `<label class="accounting-field">${escapeHtml(label)}<input name="${name}" type="${type}" value="${escapeHtml(fieldValue)}" ${required ? 'required' : ''}${numeric ? ' min="0" step="0.01"' : ''}></label>`;
}

function accountingOptions(module, field) {
  const { akun } = state.accounting;
  if (field === 'akun_id') {
    const allowed = module === 'kas_masuk' ? ['pendapatan', 'ekuitas'] : ['beban'];
    return akun.filter((item) => allowed.includes(item.tipe)).map((item) => [item.id, `${item.kode_akun} · ${item.nama_akun}`]);
  }
  return state.kategori.map((item) => [item.id, item.nama_kategori || item.nama]);
}

function renderAccounting() {
  const accounting = state.accounting;
  const workspace = $('#accounting-workspace');
  if (!workspace) return;
  const isCashier = accounting.module === 'cashier';
  const pageHeading = $('#view-accounting > .page-heading');
  const headingEyebrow = pageHeading.querySelector('.eyebrow');
  const headingTitle = pageHeading.querySelector('h1');
  const headingDescription = pageHeading.querySelector('.muted');
  headingEyebrow.textContent = accounting.module === 'inventory' ? 'MANAJEMEN STOK' : 'PEMBUKUAN BERBASIS SAK INDONESIA';
  headingEyebrow.hidden = isCashier;
  headingTitle.innerHTML = isCashier ? 'Kasir <em>(Point of Sale)</em>'
    : accounting.module === 'inventory' ? 'Inventory <em>stok bahan</em>' : 'Akuntansi <em>SAK</em>';
  headingDescription.hidden = isCashier;
  headingDescription.textContent = accounting.module === 'inventory'
    ? 'Kelola stok bahan, batas minimum, dan catat pembelian untuk restock.'
    : 'Kelola bagan akun, jurnal, buku besar, dan laporan keuangan cafe.';
  $('#accounting-tabs').hidden = isCashier || accounting.module === 'inventory';
  $$('#accounting-tabs [data-accounting-module]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.accountingModule === accounting.module);
  });
  if ($('#view-accounting').classList.contains('active')) {
    const activeModule = accounting.module;
    const activeLink = $(`.nav-link[data-view="accounting"][data-accounting-module="${activeModule}"]`)
      || $('.nav-link.accounting-nav');
    $$('.nav-link[data-view="accounting"]').forEach((link) => link.classList.toggle('active', link === activeLink));
    $('#breadcrumb-current').textContent = ({ cashier: 'Kasir (POS)', produk: 'Produk', inventory: 'Inventory', akun: 'Akuntansi SAK', 'akun-kas': 'Akuntansi SAK', 'kategori-akuntansi': 'Akuntansi SAK', reports: 'Akuntansi SAK' })[accounting.module] || 'Akuntansi SAK';
  }
  if (accounting.module === 'cashier') return renderCashier();
  if (accounting.module === 'akun-kas') return renderCashAccountManager();
  if (accounting.module === 'inventory') return renderInventory();
  if (['jurnal', 'buku_besar', 'reports'].includes(accounting.module)) {
    if (accounting.module === 'jurnal') accounting.report = 'jurnal';
    else if (accounting.module === 'buku_besar') accounting.report = 'buku_besar';
    else if (['jurnal', 'buku_besar'].includes(accounting.report)) accounting.report = 'neraca_saldo';
    return renderAccountingReports();
  }
  const config = accountingModules[accounting.module];
  if (!config) return;
  const moduleRows = config.table === 'kategori' ? state.kategori : accounting[config.table] || [];
  const editing = accounting.edit?.module === accounting.module
    ? moduleRows.find((item) => item.id === accounting.edit.id) : null;
  const fields = config.fields.map(([name, label, type = 'text', staticOptions = null, required = true]) => {
    const options = type === 'select' ? (staticOptions || accountingOptions(accounting.module, name)) : null;
    let value = editing?.[name] ?? '';
    if (!editing && accounting.module === 'produk' && name === 'ppn_rate') value = 11;
    if (accounting.module === 'kategori-akuntansi' && name === 'nama_kategori') value ||= editing?.nama;
    return accountingField(name, label, value, type, options, required);
  }).join('');
  const rows = [...moduleRows]
    .filter((item) => accounting.module !== 'produk' || accounting.productFilter === 'all' || item.tipe === accounting.productFilter)
    .sort((a, b) => String(a[config.columns[0]] || '').localeCompare(String(b[config.columns[0]] || ''), 'id'));
  const headings = config.columns.map((key) => `<th>${escapeHtml(key.replaceAll('_', ' ').toUpperCase())}</th>`).join('');
  const tableRows = rows.map((item) => `<tr>${config.columns.map((key) => {
    const value = key === 'harga_jual' || key === 'gaji_pokok' || key === 'jumlah' || key === 'saldo' ? money(item[key]) : item[key];
    return `<td>${escapeHtml(value ?? '')}</td>`;
  }).join('')}<td class="accounting-row-actions"><button class="button button-quiet" type="button" data-accounting-edit="${item.id}">Ubah</button><button class="button button-quiet danger-text" type="button" data-accounting-delete="${item.id}">Hapus</button></td></tr>`).join('');
  workspace.innerHTML = `<section class="content-section accounting-management">
    <div class="section-heading"><div><p class="eyebrow">DATA MASTER</p><h2>${escapeHtml(config.title)}</h2></div>${accounting.module === 'produk' ? `<label class="product-filter">Filter<select data-product-filter><option value="all" ${accounting.productFilter === 'all' ? 'selected' : ''}>Semua produk</option><option value="minuman" ${accounting.productFilter === 'minuman' ? 'selected' : ''}>Minuman</option><option value="makanan" ${accounting.productFilter === 'makanan' ? 'selected' : ''}>Makanan</option></select></label>` : ''}</div>
    <form class="accounting-form" id="accounting-form" data-table="${config.table}" data-module="${accounting.module}" data-id="${editing?.id || ''}">
      ${fields}${accounting.module === 'produk' ? `<label class="accounting-field">Unggah foto produk<input type="file" name="foto_file" accept="image/jpeg,image/png,image/webp"><small>Maksimal 3 MB · JPG, PNG, WebP</small></label>${editing?.foto_url ? `<img class="product-edit-preview" src="${escapeHtml(editing.foto_url)}" alt="Foto ${escapeHtml(editing.nama_produk)}">` : ''}` : ''}<div class="accounting-form-actions"><button class="button button-primary" type="submit">${editing ? 'Simpan perubahan' : 'Tambah data'}</button>${editing ? '<button class="button button-quiet" type="button" data-accounting-cancel>Batal</button>' : ''}</div>
    </form>
    <div class="table-wrap accounting-table-wrap"><table><thead><tr>${headings}<th>AKSI</th></tr></thead><tbody>${tableRows || `<tr><td colspan="${config.columns.length + 1}">Belum ada data.</td></tr>`}</tbody></table></div>
  </section>`;
  refreshIcons();
}

function renderInventory() {
  const { inventory } = state.accounting;
  const editing = state.accounting.edit?.module === 'inventory'
    ? inventory.find((item) => item.id === state.accounting.edit.id) : null;
  const fields = accountingModules.inventory.fields.map(([name, label, type = 'text', options = null]) =>
    accountingField(name, label, editing?.[name] ?? '', type, options)).join('');
  const rows = [...inventory].sort((a, b) => String(a.nama_bahan).localeCompare(String(b.nama_bahan), 'id'));
  const formatStock = (value) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value));
  const tableRows = rows.map((item) => {
    const stock = Number(item.stok_saat_ini);
    const minimum = Number(item.minimal_stok);
    const percentage = minimum > 0 ? stock / minimum * 100 : stock > 0 ? Infinity : 0;
    const low = percentage <= 100;
    const percentageLabel = Number.isFinite(percentage)
      ? `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(percentage)}%`
      : '>100%';
    return `<tr><td><strong>${escapeHtml(item.nama_bahan)}</strong></td><td>${formatStock(stock)}</td><td>${escapeHtml(item.satuan)}</td><td>${formatStock(minimum)}</td><td><span class="stock-status ${low ? 'stock-low' : 'stock-ok'}">${low ? 'Stok Menipis' : 'Stok Aman'} · Stok: ${percentageLabel}</span></td><td>${escapeHtml(item.no_referensi || '-')}</td><td class="accounting-row-actions"><button class="button button-quiet" type="button" data-accounting-edit="${item.id}">Ubah</button><button class="button button-quiet danger-text" type="button" data-accounting-delete="${item.id}">Hapus</button></td></tr>`;
  }).join('');
  $('#accounting-workspace').innerHTML = `<section class="content-section accounting-management">
    <div class="section-heading"><div><p class="eyebrow">DATA MASTER · PERSEDIAAN</p><h2>Stok Bahan</h2><p class="muted">Pantau bahan cafe dan segera isi ulang saat stok mencapai batas minimum.</p></div><button class="button button-primary" type="button" data-restock-open><i data-lucide="package-plus"></i> Catat Pembelian / Restock</button></div>
    ${state.accounting.inventoryError ? `<div class="inventory-setup-warning" role="alert">${escapeHtml(state.accounting.inventoryError)}</div>` : ''}
    <form class="accounting-form inventory-form" id="accounting-form" data-table="inventory" data-module="inventory" data-id="${editing?.id || ''}">
      ${fields}<div class="accounting-form-actions"><button class="button button-primary" type="submit">${editing ? 'Simpan perubahan' : 'Tambah bahan'}</button>${editing ? '<button class="button button-quiet" type="button" data-accounting-cancel>Batal</button>' : ''}</div>
    </form>
    <div class="table-wrap accounting-table-wrap"><table><thead><tr><th>NAMA BAHAN</th><th>STOK SAAT INI</th><th>SATUAN</th><th>MINIMAL STOK</th><th>STATUS</th><th>NO. REFERENSI / NOTA</th><th>AKSI</th></tr></thead><tbody>${tableRows || '<tr><td colspan="7">Belum ada bahan. Tambahkan bahan pertama menggunakan formulir di atas.</td></tr>'}</tbody></table></div>
  </section>`;
  refreshIcons();
}

function renderCashAccountManager() {
  const mainCash = getMainCashAccount();
  const rows = orderedKas().map((account) => {
    const isMainCash = account.nama === 'Kas Utama';
    const parent = state.kas.find((candidate) => candidate.id === account.induk_kas_id);
    const description = parent ? `Bagian dari ${parent.nama}` : account.deskripsi || 'Akun kas';
    return `<tr><td><strong>${escapeHtml(account.nama)}</strong>${isMainCash ? '<span class="category-chip">Default transaksi</span>' : ''}</td><td>${escapeHtml(description)}</td><td class="align-right">${money(getCashBalance(account.id))}</td><td class="accounting-row-actions">${isMainCash ? '' : `<button class="button button-quiet" type="button" data-account-cash-edit="${account.id}">Ubah</button><button class="button button-quiet danger-text" type="button" data-account-cash-delete="${account.id}">Hapus</button>`}</td></tr>`;
  }).join('');
  $('#accounting-workspace').innerHTML = `<section class="content-section accounting-management">
    <div class="section-heading"><div><p class="eyebrow">PENGATURAN KAS</p><h2>Akun Kas</h2><p class="muted">${mainCash ? 'Transaksi baru otomatis menggunakan Kas Utama.' : 'Kas Utama belum tersedia. Jalankan seed database agar transaksi dapat disimpan.'}</p></div><button class="button button-primary" type="button" data-account-cash-add><i data-lucide="plus"></i> Tambah akun kas</button></div>
    <div class="table-wrap accounting-table-wrap"><table><thead><tr><th>NAMA AKUN</th><th>KETERANGAN</th><th class="align-right">SALDO</th><th>AKSI</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Belum ada akun kas.</td></tr>'}</tbody></table></div>
  </section>`;
  refreshIcons();
}

function renderCashier() {
  const { produk, cart, karyawan } = state.accounting;
  const isPreview = produk.length === 0;
  const products = isPreview ? cashierProductPreviews : produk;
  let subtotal = 0;
  let tax = 0;
  const cards = products.filter((product) => state.accounting.productFilter === 'all' || product.tipe === state.accounting.productFilter).map((product) => {
    const actions = isPreview ? '' : `<span class="product-card-actions no-print"><button type="button" class="product-action product-edit-action" data-product-edit="${product.id}" aria-label="Edit ${escapeHtml(product.nama_produk)}" title="Edit produk">${icon('pencil')}</button><button type="button" class="product-action product-delete-action" data-product-delete="${product.id}" aria-label="Hapus ${escapeHtml(product.nama_produk)}" title="Hapus produk">${icon('trash-2')}</button></span>`;
    return `<article class="product-card${isPreview ? ' product-card-preview' : ''}">
    ${actions}<button type="button" class="product-card-add" data-add-product="${isPreview ? '' : product.id}" ${isPreview ? 'disabled' : ''}>
      <img src="${escapeHtml(productImageSrc(product))}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&amp;h=400&amp;fit=crop'" alt="${escapeHtml(product.nama_produk)}" class="product-img" loading="lazy">
      <span class="product-card-copy"><strong>${escapeHtml(product.nama_produk)}</strong><small>${escapeHtml(product.tipe)} · PPN ${isPreview ? 11 : Number(product.ppn_rate)}%</small><b>${money(product.harga_jual)}</b></span>
    </button>
  </article>`;
  }).join('');
  const cartRows = [...cart.entries()].map(([id, qty]) => {
    const product = produk.find((item) => item.id === id);
    if (!product) return '';
    const lineSubtotal = Number(product.harga_jual) * qty;
    const lineTax = Math.round(lineSubtotal * Number(product.ppn_rate) / 100 * 100) / 100;
    subtotal += lineSubtotal;
    tax += lineTax;
    return `<tr><td>${escapeHtml(product.nama_produk)}</td><td><button type="button" data-cart-change="${id}" data-step="-1" aria-label="Kurangi">−</button> ${qty} <button type="button" data-cart-change="${id}" data-step="1" aria-label="Tambah">+</button></td><td>${money(lineSubtotal + lineTax)}</td></tr>`;
  }).join('');
  $('#accounting-workspace').innerHTML = `<div class="cashier-layout">
    <section class="content-section cart-panel"><div class="section-heading"><div><p class="eyebrow">TRANSAKSI BARU</p><h2>Keranjang</h2></div></div>
      <label class="accounting-field">Metode bayar<select id="sale-method"><option>Tunai</option><option>Transfer</option><option>Kartu</option><option>QRIS</option></select></label>
      <div class="qris-payment" id="qris-payment" hidden><img src="${dummyQrImage()}" width="200" height="200" alt="QR code QRIS contoh"><strong>Silakan scan QRIS</strong></div>
      <label class="accounting-field">Kasir<select id="sale-cashier"><option value="">Pilih kasir (opsional)</option>${karyawan.map((person) => `<option value="${person.id}">${escapeHtml(person.nama)}</option>`).join('')}</select></label>
      <div class="table-wrap"><table><thead><tr><th>PRODUK</th><th>QTY</th><th>TOTAL</th></tr></thead><tbody>${cartRows || '<tr><td colspan="3">Pilih produk untuk memulai.</td></tr>'}</tbody></table></div>
      <div class="cart-totals"><span>Subtotal <strong>${money(subtotal)}</strong></span><span>PPN <strong>${money(tax)}</strong></span><span class="cart-grand-total">Total <strong>${money(subtotal + tax)}</strong></span></div>
      <button class="button button-primary full-width checkout-button" type="button" data-accounting-checkout ${cart.size ? '' : 'disabled'}>Bayar &amp; Simpan</button>
    </section>
    <section class="content-section cashier-products"><div class="section-heading cashier-products-heading"><div><p class="eyebrow">MENU CAFE</p><h2>Pilih Produk</h2>${isPreview ? '<p class="cashier-preview-note">Foto menu pratinjau · sambungkan Supabase untuk memuat produk dan memproses transaksi.</p>' : ''}</div><div class="cashier-product-tools"><label class="product-filter">Filter<select data-product-filter><option value="all" ${state.accounting.productFilter === 'all' ? 'selected' : ''}>Semua produk</option><option value="minuman" ${state.accounting.productFilter === 'minuman' ? 'selected' : ''}>Minuman</option><option value="makanan" ${state.accounting.productFilter === 'makanan' ? 'selected' : ''}>Makanan</option></select></label><button class="button button-primary" type="button" data-product-add><i data-lucide="plus"></i> Tambah Produk Baru</button></div></div><div class="product-grid">${cards || '<p>Belum ada produk untuk filter ini.</p>'}</div></section>
  </div>`;
}

const accountingReportLabels = {
  jurnal: 'Jurnal Umum', buku_besar: 'Buku Besar', neraca_saldo: 'Neraca Saldo',
  laba_rugi: 'Laporan Laba Rugi', ekuitas: 'Perubahan Ekuitas',
  posisi_keuangan: 'Posisi Keuangan', arus_kas: 'Laporan Arus Kas'
};

function renderAccountingReports() {
  const module = state.accounting.module;
  const report = module === 'jurnal' ? 'jurnal'
    : module === 'buku_besar' ? 'buku_besar' : state.accounting.report;
  const reportTabs = Object.entries(accountingReportLabels).filter(([key]) =>
    module !== 'reports' || !['jurnal', 'buku_besar'].includes(key));
  const from = state.accounting.reportFrom || `${monthIso}-01`;
  const to = state.accounting.reportTo || todayIso;
  const accountOptions = state.accounting.akun.map((item) => `<option value="${item.id}" ${item.id === state.accounting.reportAccountId ? 'selected' : ''}>${escapeHtml(item.kode_akun)} · ${escapeHtml(item.nama_akun)}</option>`).join('');
  const printedAt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  $('#accounting-workspace').innerHTML = `<section class="content-section accounting-report">
    <div class="accounting-report-controls no-print">${module === 'reports' ? `<div class="accounting-report-tabs">${reportTabs.map(([key, label]) => `<button type="button" data-accounting-report="${key}" class="${report === key ? 'selected' : ''}">${label}</button>`).join('')}</div>` : ''}
      <form class="accounting-filter" id="accounting-report-filter"><label>Dari<input name="from" type="date" value="${from}" required></label><label>Sampai<input name="to" type="date" value="${to}" required></label>${report === 'buku_besar' ? `<label>Akun<select name="akun_id" required>${accountOptions}</select></label>` : ''}<button class="button button-primary" type="submit">Terapkan</button><button class="button button-quiet" type="button" data-accounting-print><i data-lucide="printer"></i> Cetak Laporan</button></form>
    </div><header id="print-header" class="accounting-print-heading"><strong>KEDAI TEH ANNISA MANAGEMENT · ANNISA BENO CAFE</strong><h2>${accountingReportLabels[report]}</h2><p>Periode: ${displayDate(from)} - ${displayDate(to)}</p></header><div id="accounting-report-content">${accountingReportTable(report, from, to)}</div><footer id="print-footer" class="accounting-print-footer">Dicetak pada ${escapeHtml(printedAt)}</footer>
  </section>`;
  refreshIcons();
}

function accountingReportTable(report, from, to) {
  const { jurnal_umum: journals, jurnal_detail: lines, akun, transaksi_penjualan: sales, detail_penjualan: saleDetails, produk } = state.accounting;
  const accounts = new Map(akun.map((account) => [account.id, account]));
  const journalIds = new Map(journals.map((journal) => [journal.id, journal]));
  const entries = lines.map((line) => ({ ...line, journal: journalIds.get(line.jurnal_id), account: accounts.get(line.akun_id) }))
    .filter((line) => line.journal && line.journal.tanggal >= from && line.journal.tanggal <= to)
    .sort((a, b) => a.journal.tanggal.localeCompare(b.journal.tanggal) || a.journal.no_jurnal.localeCompare(b.journal.no_jurnal));
  const asOf = lines.map((line) => ({ ...line, journal: journalIds.get(line.jurnal_id), account: accounts.get(line.akun_id) }))
    .filter((line) => line.journal && line.journal.tanggal <= to);
  const beforePeriod = asOf.filter((line) => line.journal.tanggal < from);
  const value = (amount) => {
    const number = Number(amount || 0);
    return number < 0 ? `(${money(Math.abs(number))})` : money(number);
  };
  const accountBalance = (account, movements) => {
    const normalSide = account.saldo_normal === 'kredit' ? -1 : 1;
    return Number(account.saldo || 0) + movements
      .filter((line) => line.akun_id === account.id)
      .reduce((sum, line) => sum + (Number(line.debit) - Number(line.kredit)) * normalSide, 0);
  };
  // DITAMBAH: HPP dilaporkan dari akun 5101; ketiadaan akun ini menghasilkan nilai nol.
  const isRevenue = (account) => /^4\d{3}$/.test(account?.kode_akun || '');
  const isExpense = (account) => /^5\d{3}$/.test(account?.kode_akun || '');
  const isHpp = (account) => account?.kode_akun === '5101';
  const isOperatingExpense = (account) => /^52\d{2}$/.test(account?.kode_akun || '');
  const profitFor = (movement) => {
    const income = movement.filter((line) => isRevenue(line.account))
      .reduce((sum, line) => sum + Number(line.kredit) - Number(line.debit), 0);
    const expenses = movement.filter((line) => isExpense(line.account));
    const hpp = expenses.filter((line) => isHpp(line.account))
      .reduce((sum, line) => sum + Number(line.debit) - Number(line.kredit), 0);
    const operating = expenses.filter((line) => isOperatingExpense(line.account))
      .reduce((sum, line) => sum + Number(line.debit) - Number(line.kredit), 0);
    const otherExpenses = expenses.filter((line) => !isHpp(line.account) && !isOperatingExpense(line.account))
      .reduce((sum, line) => sum + Number(line.debit) - Number(line.kredit), 0);
    return { income, hpp, gross: income - hpp, operating, otherExpenses, net: income - hpp - operating - otherExpenses };
  };
  const table = (headers, rows, footer = '') => `<div class="table-wrap accounting-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">Tidak ada data pada periode ini.</td></tr>`}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ''}</table></div>`;
  if (report === 'jurnal') {
    const rows = entries.map((line) => `<tr><td>${escapeHtml(line.journal.no_jurnal)}</td><td>${displayDate(line.journal.tanggal)}</td><td>${escapeHtml(line.journal.keterangan)}</td><td>${escapeHtml(line.account?.kode_akun || '')} · ${escapeHtml(line.account?.nama_akun || 'Akun')}</td><td class="align-right">${value(line.debit)}</td><td class="align-right">${value(line.kredit)}</td></tr>`).join('');
    const debit = entries.reduce((sum, line) => sum + Number(line.debit), 0);
    const credit = entries.reduce((sum, line) => sum + Number(line.kredit), 0);
    const unbalanced = [...new Set(entries.map((line) => line.jurnal_id))].filter((journalId) => {
      const journalLines = entries.filter((line) => line.jurnal_id === journalId);
      return Math.abs(
        journalLines.reduce((sum, line) => sum + Number(line.debit), 0)
        - journalLines.reduce((sum, line) => sum + Number(line.kredit), 0)
      ) >= 0.01;
    });
    const warning = unbalanced.length
      ? `<p class="accounting-report-warning" role="alert">${unbalanced.length} jurnal tidak seimbang. Periksa total debit dan kredit sebelum laporan digunakan.</p>`
      : '';
    return `${warning}${table(['NO JURNAL', 'TANGGAL', 'KETERANGAN', 'AKUN', 'DEBIT', 'KREDIT'], rows, `<tr><th colspan="4">TOTAL · ${unbalanced.length ? 'TIDAK SEIMBANG' : 'SEIMBANG'}</th><th class="align-right">${value(debit)}</th><th class="align-right">${value(credit)}</th></tr>`)}`;
  }
  if (report === 'buku_besar') {
    const accountId = state.accounting.reportAccountId || akun[0]?.id;
    const account = accounts.get(accountId);
    const selected = lines.map((line) => ({ ...line, journal: journalIds.get(line.jurnal_id) }))
      .filter((line) => line.akun_id === accountId && line.journal)
      .sort((a, b) => a.journal.tanggal.localeCompare(b.journal.tanggal) || a.journal.no_jurnal.localeCompare(b.journal.no_jurnal));
    const side = account?.saldo_normal === 'kredit' ? -1 : 1;
    const opening = selected.filter((line) => line.journal.tanggal < from).reduce((sum, line) => sum + (Number(line.debit) - Number(line.kredit)) * side, Number(account?.saldo || 0));
    let balance = opening;
    const rows = selected.filter((line) => line.journal.tanggal >= from && line.journal.tanggal <= to).map((line) => {
      balance += (Number(line.debit) - Number(line.kredit)) * side;
      return `<tr><td>${displayDate(line.journal.tanggal)}</td><td>${escapeHtml(line.journal.keterangan)}</td><td>${escapeHtml(line.journal.no_jurnal)}</td><td class="align-right">${value(line.debit)}</td><td class="align-right">${value(line.kredit)}</td><td class="align-right">${value(balance)}</td></tr>`;
    }).join('');
    return `<p class="accounting-print-context"><strong>Akun:</strong> ${escapeHtml(account?.kode_akun || '')} · ${escapeHtml(account?.nama_akun || 'Pilih akun')}</p>${table(['TANGGAL', 'KETERANGAN', 'REFERENSI', 'DEBIT', 'KREDIT', 'SALDO'], rows, `<tr><th colspan="5">SALDO AKHIR</th><th class="align-right">${value(balance)}</th></tr>`)}`;
  }
  if (report === 'neraca_saldo') {
    let totalDebit = 0;
    let totalCredit = 0;
    const rows = akun.map((account) => {
      const movement = lines.filter((line) => line.akun_id === account.id && journalIds.get(line.jurnal_id)?.tanggal <= to);
      const debit = movement.reduce((sum, line) => sum + Number(line.debit), Number(account.saldo_normal === 'debit' ? account.saldo : 0));
      const credit = movement.reduce((sum, line) => sum + Number(line.kredit), Number(account.saldo_normal === 'kredit' ? account.saldo : 0));
      const balance = debit - credit;
      totalDebit += Math.max(balance, 0);
      totalCredit += Math.max(-balance, 0);
      return `<tr><td>${escapeHtml(account.kode_akun)}</td><td>${escapeHtml(account.nama_akun)}</td><td class="align-right">${value(Math.max(balance, 0))}</td><td class="align-right">${value(Math.max(-balance, 0))}</td></tr>`;
    }).join('');
    return table(['KODE', 'NAMA AKUN', 'DEBIT', 'KREDIT'], rows, `<tr><th colspan="2">${Math.abs(totalDebit - totalCredit) < 0.01 ? 'SEIMBANG' : 'TIDAK SEIMBANG'}</th><th class="align-right">${value(totalDebit)}</th><th class="align-right">${value(totalCredit)}</th></tr>`);
  }
  if (report === 'laba_rugi') {
    const result = profitFor(entries);
    const revenueGroups = new Map([['Makanan', 0], ['Minuman', 0], ['Pendapatan lainnya', 0]]);
    const salesById = new Map(sales.map((sale) => [sale.id, sale]));
    const productsById = new Map(produk.map((item) => [item.id, item]));
    entries.filter((line) => isRevenue(line.account)).forEach((line) => {
      const reference = line.journal.ref_transaksi || '';
      const sale = reference.startsWith('penjualan:')
        ? salesById.get(reference.slice('penjualan:'.length)) : null;
      if (!sale) {
        const accountName = line.account.nama_akun.toLocaleLowerCase('id-ID');
        const group = accountName.includes('makanan') ? 'Makanan'
          : accountName.includes('minuman') ? 'Minuman' : 'Pendapatan lainnya';
        revenueGroups.set(group, revenueGroups.get(group) + Number(line.kredit) - Number(line.debit));
        return;
      }
      const details = saleDetails.filter((detail) => detail.penjualan_id === sale.id);
      let classifiedRevenue = 0;
      details.forEach((detail) => {
        const product = productsById.get(detail.produk_id);
        const group = product?.tipe === 'makanan' ? 'Makanan'
          : product?.tipe === 'minuman' ? 'Minuman' : null;
        if (!group) return;
        const amount = Number(detail.subtotal || 0);
        revenueGroups.set(group, revenueGroups.get(group) + amount);
        classifiedRevenue += amount;
      });
      const journalRevenue = Number(line.kredit) - Number(line.debit);
      if (Math.abs(journalRevenue - classifiedRevenue) >= 0.01) {
        revenueGroups.set('Pendapatan lainnya', revenueGroups.get('Pendapatan lainnya') + journalRevenue - classifiedRevenue);
      }
    });
    const revenueRows = [...revenueGroups.entries()].filter(([label, amount]) => amount !== 0 || ['Makanan', 'Minuman'].includes(label))
      .map(([label, amount]) => `<tr><td>${escapeHtml(label)}</td><td class="align-right">${value(amount)}</td></tr>`).join('');
    const expenseRows = (predicate) => entries
      .filter((line) => isExpense(line.account) && predicate(line.account))
      .map((line) => `<tr><td>${escapeHtml(line.account.nama_akun)}</td><td class="align-right">${value(Number(line.kredit) - Number(line.debit))}</td></tr>`)
      .join('');
    const hppRows = expenseRows(isHpp);
    const operatingRows = expenseRows(isOperatingExpense);
    const rows = `<tr class="accounting-section-row"><th colspan="2">PENDAPATAN PENJUALAN (4xxx)</th></tr>${revenueRows || '<tr><td colspan="2">Tidak ada pendapatan.</td></tr>'}<tr><th>TOTAL PENDAPATAN</th><th class="align-right">${value(result.income)}</th></tr>
      <tr class="accounting-section-row"><th colspan="2">HARGA POKOK PENJUALAN</th></tr>${hppRows || '<tr><td>Harga Pokok Penjualan</td><td class="align-right">(Rp 0)</td></tr>'}<tr><th>TOTAL HPP</th><th class="align-right">${value(-result.hpp)}</th></tr><tr><th>LABA KOTOR</th><th class="align-right">${value(result.gross)}</th></tr>
      <tr class="accounting-section-row"><th colspan="2">BEBAN OPERASIONAL (52xx)</th></tr>${operatingRows || '<tr><td>Tidak ada beban operasional.</td><td class="align-right">(Rp 0)</td></tr>'}<tr><th>TOTAL BEBAN OPERASIONAL</th><th class="align-right">${value(-result.operating)}</th></tr>
      <tr class="accounting-section-row"><th colspan="2">BEBAN LAINNYA (5xxx)</th></tr>${expenseRows((account) => !isHpp(account) && !isOperatingExpense(account)) || '<tr><td>Tidak ada beban lainnya.</td><td class="align-right">(Rp 0)</td></tr>'}<tr><th>TOTAL BEBAN LAINNYA</th><th class="align-right">${value(-result.otherExpenses)}</th></tr>
      <tr><th>LABA / (RUGI) BERSIH</th><th class="align-right">${value(result.net)}</th></tr>`;
    return table(['URAIAN', 'JUMLAH'], rows);
  }
  if (report === 'ekuitas') {
    const openingEquity = akun.filter((account) => account.tipe === 'ekuitas')
      .reduce((sum, account) => sum + accountBalance(account, beforePeriod) * (account.kode_akun === '3103' ? -1 : 1), 0);
    const additionalCapital = entries.filter((line) => line.account?.tipe === 'ekuitas' && line.account.kode_akun !== '3103')
      .reduce((sum, line) => sum + Number(line.kredit) - Number(line.debit), 0);
    const periodPrive = entries.filter((line) => line.account?.kode_akun === '3103')
      .reduce((sum, line) => sum + Number(line.debit) - Number(line.kredit), 0);
    const net = profitFor(entries).net;
    const endingEquity = openingEquity + additionalCapital + net - periodPrive;
    return table(['KOMPONEN EKUITAS', 'JUMLAH'], `<tr><td>Modal awal</td><td class="align-right">${value(openingEquity)}</td></tr><tr><td>Setoran modal periode berjalan</td><td class="align-right">${value(additionalCapital)}</td></tr><tr><td>Laba / (rugi) bersih periode berjalan</td><td class="align-right">${value(net)}</td></tr><tr><td>Prive</td><td class="align-right">${value(-periodPrive)}</td></tr>`, `<tr><th>MODAL AKHIR</th><th class="align-right">${value(endingEquity)}</th></tr>`);
  }
  if (report === 'posisi_keuangan') {
    const balances = akun.map((account) => ({ account, balance: accountBalance(account, asOf) }));
    const assets = balances.filter((item) => /^1\d{3}$/.test(item.account.kode_akun)).map(({ account, balance }) => ({
      account,
      signed: account.saldo_normal === 'kredit' ? -balance : balance
    }));
    // // DITAMBAH: 1103 termasuk aset lancar persediaan bahan baku.
    const currentAssets = assets.filter(({ account }) => /^11/.test(account.kode_akun) || account.kode_akun === '1103');
    const fixedAssets = assets.filter(({ account }) => /^12/.test(account.kode_akun));
    const currentTotal = currentAssets.reduce((sum, item) => sum + item.signed, 0);
    const fixedTotal = fixedAssets.reduce((sum, item) => sum + item.signed, 0);
    const assetTotal = currentTotal + fixedTotal;
    const liabilities = balances.filter((item) => /^2\d{3}$/.test(item.account.kode_akun))
      .map((item) => ({ ...item, signed: item.balance * (item.account.saldo_normal === 'debit' ? -1 : 1) }));
    const liabilityTotal = liabilities.reduce((sum, item) => sum + item.signed, 0);
    const equityAccounts = balances.filter((item) => /^3\d{3}$/.test(item.account.kode_akun));
    const equityBase = equityAccounts.reduce((sum, item) =>
      sum + item.balance * (item.account.saldo_normal === 'debit' ? -1 : 1), 0);
    const cumulativeProfit = balances
      .filter((item) => isRevenue(item.account) || isExpense(item.account))
      .reduce((sum, item) => {
        const normalSide = item.account.saldo_normal === 'kredit' ? 1 : -1;
        return sum + item.balance * normalSide;
      }, 0);
    const closingEquity = equityBase + cumulativeProfit;
    const liabilitiesAndEquity = liabilityTotal + closingEquity;
    const difference = assetTotal - liabilitiesAndEquity;
    const accountRows = (items) => items.map((item) => `<tr><td>${escapeHtml(item.account.kode_akun)} · ${escapeHtml(item.account.nama_akun)}</td><td class="align-right">${value(item.signed ?? item.balance)}</td></tr>`).join('');
    const rows = `<tr class="accounting-section-row"><th colspan="2">ASET LANCAR</th></tr>${accountRows(currentAssets)}<tr><th>TOTAL ASET LANCAR</th><th class="align-right">${value(currentTotal)}</th></tr>
      <tr class="accounting-section-row"><th colspan="2">ASET TETAP</th></tr>${accountRows(fixedAssets)}<tr><th>TOTAL ASET TETAP</th><th class="align-right">${value(fixedTotal)}</th></tr>
      <tr class="accounting-section-row"><th colspan="2">KEWAJIBAN JANGKA PENDEK</th></tr>${accountRows(liabilities)}<tr><th>TOTAL KEWAJIBAN JANGKA PENDEK</th><th class="align-right">${value(liabilityTotal)}</th></tr>
      <tr class="accounting-section-row"><th colspan="2">EKUITAS</th></tr>${accountRows(equityAccounts.map(({ account, balance }) => ({ account, signed: balance * (account.saldo_normal === 'debit' ? -1 : 1) })))}<tr><td>Laba / (rugi) kumulatif</td><td class="align-right">${value(cumulativeProfit)}</td></tr><tr><th>MODAL AKHIR</th><th class="align-right">${value(closingEquity)}</th></tr>`;
    const warning = Math.abs(difference) < 0.01 ? '' : `<p class="accounting-report-warning" role="alert">Neraca tidak balance. Selisih total aset dan total kewajiban + ekuitas: ${value(difference)}. Periksa jurnal, saldo awal, dan saldo laba.</p>`;
    return `${warning}${table(['POSISI KEUANGAN', 'JUMLAH'], rows, `<tr><th>TOTAL ASET</th><th class="align-right">${value(assetTotal)}</th></tr><tr><th>TOTAL KEWAJIBAN + EKUITAS</th><th class="align-right">${value(liabilitiesAndEquity)}</th></tr><tr><th>${Math.abs(difference) < 0.01 ? 'NERACA SEIMBANG' : 'SELISIH NERACA'}</th><th class="align-right">${value(difference)}</th></tr>`)}`;
  }
  const cashAccount = akun.find((account) => account.kode_akun === '1101');
  if (!cashAccount) return '<p class="accounting-report-warning" role="alert">Akun Kas (1101) tidak ditemukan pada bagan akun.</p>';
  const cashJournalIds = [...new Set(entries.filter((line) => line.akun_id === cashAccount.id).map((line) => line.jurnal_id))];
  const cashRows = cashJournalIds.map((journalId) => {
    const journalLines = entries.filter((line) => line.jurnal_id === journalId);
    const amount = journalLines.filter((line) => line.akun_id === cashAccount.id)
      .reduce((sum, line) => sum + Number(line.debit) - Number(line.kredit), 0);
    const counterparts = journalLines.filter((line) => line.akun_id !== cashAccount.id);
    const investing = counterparts.some((line) => /^12/.test(line.account?.kode_akun || ''));
    const financing = counterparts.some((line) => line.account?.tipe === 'ekuitas' || /pinjaman|utang bank/i.test(line.account?.nama_akun || ''));
    const type = investing ? 'Investasi' : financing ? 'Pendanaan' : 'Operasi';
    const label = [...new Set(counterparts.map((line) => line.account?.nama_akun).filter(Boolean))].join(', ')
      || journalLines[0]?.journal.keterangan || 'Mutasi kas';
    return { journal: journalLines[0].journal, type, label, amount };
  });
  const activityTotals = Object.fromEntries(['Operasi', 'Investasi', 'Pendanaan'].map((type) => [
    type, cashRows.filter((line) => line.type === type).reduce((sum, line) => sum + line.amount, 0)
  ]));
  const cashOpening = accountBalance(cashAccount, beforePeriod);
  const periodNet = Object.values(activityTotals).reduce((sum, amount) => sum + amount, 0);
  const cashClosing = cashOpening + periodNet;
  const balanceSheetCash = accountBalance(cashAccount, asOf);
  const discrepancy = cashClosing - balanceSheetCash;
  const details = cashRows.map((line) => `<tr><td>${displayDate(line.journal.tanggal)}</td><td>${escapeHtml(line.type)}</td><td>${escapeHtml(line.label)}</td><td class="align-right">${value(line.amount)}</td></tr>`).join('');
  const activityRows = ['Operasi', 'Investasi', 'Pendanaan']
    .map((type) => `<tr><td>Arus kas dari aktivitas ${type.toLocaleLowerCase('id-ID')}</td><td class="align-right">${value(activityTotals[type])}</td></tr>`).join('');
  const warning = Math.abs(discrepancy) < 0.01 ? '' : `<p class="accounting-report-warning" role="alert">Saldo kas akhir laporan arus kas berbeda dari saldo kas di neraca sebesar ${value(discrepancy)}. Periksa jurnal atau saldo awal kas.</p>`;
  const summary = `<tr><td>Saldo kas awal</td><td class="align-right">${value(cashOpening)}</td></tr>${activityRows}<tr><th>TOTAL KENAIKAN / (PENURUNAN) KAS</th><th class="align-right">${value(periodNet)}</th></tr><tr><th>SALDO KAS AKHIR</th><th class="align-right">${value(cashClosing)}</th></tr><tr><td>Saldo kas pada neraca</td><td class="align-right">${value(balanceSheetCash)}</td></tr>`;
  return `${warning}<h3>Arus Kas Metode Langsung</h3>${table(['AKTIVITAS', 'ARUS KAS'], summary)}<h3>Rincian penerimaan dan pembayaran</h3>${table(['TANGGAL', 'AKTIVITAS', 'KETERANGAN', 'ARUS KAS'], details)}`;
}

function initializeEvents() {
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#login-message');
    message.textContent = 'Memeriksa akun...';
    const formData = new FormData(event.currentTarget);
    try {
      const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') }) });
      state.token = result.access_token;
      showApp(result.user);
      await loadData();
    } catch (error) { message.textContent = error.message; }
  });
  $('#logout-button').addEventListener('click', async () => {
    try { await request('/api/auth/logout', { method: 'POST' }); } catch { /* Clear the local in-memory session even if logout cannot reach Supabase. */ }
    showLogin();
  });
  $$('.nav-link').forEach((link) => link.addEventListener('click', () => {
    if (link.dataset.accountingModule) {
      state.accounting.module = link.dataset.accountingModule;
      state.accounting.edit = null;
    }
    setView(link.dataset.view);
    if (link.dataset.view === 'accounting') renderAccounting();
  }));
  $$('[data-navigate]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.accountingModule) state.accounting.module = button.dataset.accountingModule;
    else if (button.dataset.navigate === 'accounting') state.accounting.module = 'cashier';
    setView(button.dataset.navigate);
    if (button.dataset.navigate === 'accounting') renderAccounting();
  }));
  $$('[data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.action;
    const isTransaction = ['new-transaction', 'new-cash-in', 'new-cash-out'].includes(action);
    const accountId = isTransaction && $('#view-account-detail').classList.contains('active') ? state.selectedAccountId : null;
    const presetKind = { 'new-cash-in': 'masuk', 'new-cash-out': 'keluar' }[action] || null;
    openModal(isTransaction ? 'transaction' : action === 'new-account' ? 'account' : 'category', null, accountId, presetKind);
  }));
  $$('#modal-backdrop [data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  $('#modal-backdrop').addEventListener('click', (event) => { if (event.target === $('#modal-backdrop')) closeModal(); });
  $('#modal-form').addEventListener('submit', saveModal);
  $('#modal-form').addEventListener('invalid', (event) => {
    const field = event.target;
    const label = field.closest('label')?.firstChild?.textContent?.trim() || 'Kolom ini';
    $('#modal-error').textContent = field.validity.valueMissing
      ? `${label} wajib diisi.`
      : field.validity.rangeUnderflow
        ? `${label} harus lebih besar dari 0.`
        : 'Periksa kembali isian transaksi.';
  }, true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#modal-backdrop').hidden) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#receipt-backdrop').hidden) closeReceipt(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#cash-evidence-backdrop').hidden) closeCashEvidence(); });
  $('#cash-evidence-backdrop').addEventListener('click', (event) => {
    if (event.target === $('#cash-evidence-backdrop') || event.target.closest('[data-cash-evidence-close]')) closeCashEvidence();
    if (event.target.closest('[data-print-cash-evidence]')) {
      document.body.classList.add('cash-evidence-printing');
      window.print();
    }
  });
  $('#receipt-backdrop').addEventListener('click', (event) => {
    if (event.target === $('#receipt-backdrop') || event.target.closest('[data-close-receipt]')) closeReceipt();
    if (event.target.closest('[data-print-receipt]')) {
      document.body.classList.add('receipt-printing');
      window.print();
    }
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('receipt-printing', 'cash-evidence-printing');
  });
  $('#transaction-search').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderTransactions(); });
  $('#month-filter').addEventListener('change', (event) => { state.month = event.target.value; renderTransactions(); });
  $$('[data-report-scope]').forEach((button) => button.addEventListener('click', () => {
    state.reportScope = button.dataset.reportScope;
    renderReports();
  }));
  $('#report-account-select').addEventListener('change', (event) => {
    state.reportAccountId = event.target.value;
    renderReports();
  });
  $('#report-filter-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const start = $('#report-start').value;
    const end = $('#report-end').value;
    if (!start || !end || start > end) {
      $('#report-error').textContent = 'Tanggal awal harus sama dengan atau sebelum tanggal akhir.';
      return;
    }
    $('#report-error').textContent = '';
    state.reportFrom = start;
    state.reportTo = end;
    state.reportRangeTouched = true;
    renderReports();
  });
  $('#report-export').addEventListener('click', exportReportCsv);
  $('#report-print').addEventListener('click', () => window.print());
  $('#accounting-refresh').addEventListener('click', async () => {
    try { await loadData(); toast('Data akuntansi berhasil diperbarui.'); }
    catch (error) { toast(error.message, true); }
  });
  $$('#accounting-tabs [data-accounting-module]').forEach((button) => button.addEventListener('click', () => {
    state.accounting.module = button.dataset.accountingModule;
    state.accounting.edit = null;
    renderAccounting();
  }));
  $('#accounting-workspace').addEventListener('click', async (event) => {
    if (event.target.closest('[data-restock-open]')) {
      openRestockModal();
      return;
    }
    const addProduct = event.target.closest('[data-add-product]');
    const editProduct = event.target.closest('[data-product-edit]');
    const deleteProduct = event.target.closest('[data-product-delete]');
    const changeQuantity = event.target.closest('[data-cart-change]');
    const edit = event.target.closest('[data-accounting-edit]');
    const remove = event.target.closest('[data-accounting-delete]');
    const changeReport = event.target.closest('[data-accounting-report]');
    const editCashAccount = event.target.closest('[data-account-cash-edit]');
    const deleteCashAccount = event.target.closest('[data-account-cash-delete]');
    if (event.target.closest('[data-account-cash-add]')) openModal('account');
    if (event.target.closest('[data-product-add]')) openProductModal();
    if (editProduct) {
      event.preventDefault();
      event.stopPropagation();
      openProductModal(state.accounting.produk.find((product) => product.id === editProduct.dataset.productEdit));
      return;
    }
    if (deleteProduct) {
      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm('Hapus produk ini? Tindakan ini tidak dapat dibatalkan.')) return;
      try {
        await request(`/api/accounting/produk/${deleteProduct.dataset.productDelete}`, { method: 'DELETE' });
        state.accounting.cart.delete(deleteProduct.dataset.productDelete);
        await loadData();
        toast('Produk berhasil dihapus.');
      } catch (error) { toast(error.message, true); }
      return;
    }
    if (editCashAccount) openModal('account', state.kas.find((account) => account.id === editCashAccount.dataset.accountCashEdit));
    if (deleteCashAccount) deleteItem('account', deleteCashAccount.dataset.accountCashDelete);
    if (addProduct) {
      const current = state.accounting.cart.get(addProduct.dataset.addProduct) || 0;
      state.accounting.cart.set(addProduct.dataset.addProduct, current + 1);
      renderCashier();
    }
    if (changeQuantity) {
      const id = changeQuantity.dataset.cartChange;
      const quantity = (state.accounting.cart.get(id) || 0) + Number(changeQuantity.dataset.step);
      if (quantity <= 0) state.accounting.cart.delete(id);
      else state.accounting.cart.set(id, quantity);
      renderCashier();
    }
    if (edit) {
      state.accounting.edit = { module: state.accounting.module, id: edit.dataset.accountingEdit };
      renderAccounting();
      $('#accounting-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (remove) {
      const table = accountingModules[state.accounting.module]?.table;
      if (!table || !window.confirm('Hapus data ini? Jurnal terkait kas akan ikut diperbarui.')) return;
      try {
        await request(`/api/accounting/${table}/${remove.dataset.accountingDelete}`, { method: 'DELETE' });
        state.accounting.edit = null;
        await loadData();
        toast('Data berhasil dihapus.');
      } catch (error) { toast(error.message, true); }
    }
    if (changeReport) {
      state.accounting.report = changeReport.dataset.accountingReport;
      renderAccountingReports();
    }
    if (event.target.closest('[data-accounting-print]')) window.print();
    if (event.target.closest('[data-accounting-checkout]')) {
      const cartItems = [...state.accounting.cart].map(([produk_id, qty]) => ({ produk_id, qty }));
      if (!cartItems.length) return;
      const button = event.target.closest('[data-accounting-checkout]');
      button.disabled = true;
      const method = $('#sale-method').value;
      const cashier = $('#sale-cashier').value ? $('#sale-cashier').selectedOptions[0]?.textContent : 'Kasir';
      try {
        const receiptItems = cartItems.map(({ produk_id, qty }) => {
          const product = state.accounting.produk.find((item) => item.id === produk_id);
          if (!product) throw new Error('Produk di keranjang tidak ditemukan. Segarkan data dan pilih produk kembali.');
          const price = Number(product.harga_jual);
          const quantity = Number(qty);
          const taxRate = Number(product.ppn_rate);
          if (!Number.isFinite(price) || price < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !Number.isInteger(quantity) || quantity <= 0) {
            throw new Error(`Harga atau jumlah untuk ${product.nama_produk} tidak valid.`);
          }
          const lineSubtotal = price * quantity;
          const lineTax = Math.round(lineSubtotal * taxRate / 100 * 100) / 100;
          return { nama_produk: product.nama_produk, harga_satuan: price, qty: quantity, subtotal: lineSubtotal, ppn: lineTax };
        });
        const subtotal = receiptItems.reduce((sum, item) => sum + item.harga_satuan * item.qty, 0);
        const tax = receiptItems.reduce((sum, item) => sum + item.ppn, 0);
        const total = subtotal + tax;
        const saleId = await request('/api/accounting/rpc/proses_penjualan', {
          method: 'POST',
          body: JSON.stringify({
            p_items: cartItems,
            p_metode_bayar: method,
            p_kasir_id: $('#sale-cashier').value || null,
            p_tanggal: todayIso
          })
        });
        state.accounting.cart.clear();
        await loadData();
        toast('Penjualan tercatat; jurnal dibuat dan stok bahan resep dipotong otomatis.');
        const sale = state.accounting.transaksi_penjualan.find((item) => item.id === saleId);
        showReceipt({ sale, method, cashier, items: receiptItems, subtotal, tax, total });
      } catch (error) {
        button.disabled = false;
        toast(error.message, true);
      }
    }
  });
  $('#accounting-workspace').addEventListener('change', (event) => {
    if (event.target.id === 'sale-method') {
      $('#qris-payment').hidden = event.target.value !== 'QRIS';
      return;
    }
    if (!event.target.matches('[data-product-filter]')) return;
    state.accounting.productFilter = event.target.value;
    renderAccounting();
  });
  $('#accounting-workspace').addEventListener('submit', async (event) => {
    const form = event.target;
    if (form.id === 'accounting-report-filter') {
      event.preventDefault();
      const values = new FormData(form);
      const from = String(values.get('from') || '');
      const to = String(values.get('to') || '');
      if (!from || !to || from > to) {
        $('#accounting-error').textContent = 'Tanggal awal harus sama dengan atau sebelum tanggal akhir.';
        return;
      }
      $('#accounting-error').textContent = '';
      state.accounting.reportFrom = from;
      state.accounting.reportTo = to;
      state.accounting.reportAccountId = String(values.get('akun_id') || state.accounting.reportAccountId);
      renderAccountingReports();
      return;
    }
    if (form.id !== 'accounting-form') return;
    event.preventDefault();
    const config = accountingModules[form.dataset.module];
    if (!config) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const imageFile = form.querySelector('input[name="foto_file"]')?.files?.[0];
    delete values.foto_file;
    for (const [key, value] of Object.entries(values)) {
      if (value === '') delete values[key];
      else if (['jumlah', 'harga_jual', 'ppn_rate', 'gaji_pokok', 'saldo', 'luas_bangunan', 'njop', 'pbb_terutang', 'tahun', 'stok_saat_ini', 'minimal_stok'].includes(key)) values[key] = Number(value);
    }
    if (form.dataset.module === 'inventory') values.no_referensi = String(values.no_referensi || '').trim();
    if (form.dataset.module === 'kategori-akuntansi') values.nama = values.nama_kategori;
    try {
      if (form.dataset.module === 'produk' && values.foto_url && !/^https?:\/\//i.test(String(values.foto_url))) {
        throw new Error('URL foto harus menggunakan HTTP atau HTTPS.');
      }
      if (imageFile) {
        if (imageFile.size > 3 * 1024 * 1024) throw new Error('Ukuran foto maksimal 3 MB.');
        const bytes = new Uint8Array(await imageFile.arrayBuffer());
        let binary = '';
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        const upload = await request('/api/accounting/upload-image', {
          method: 'POST',
          body: JSON.stringify({ content_type: imageFile.type, data: btoa(binary) })
        });
        values.foto_url = upload.publicUrl;
      }
      await request(`/api/accounting/${config.table}${form.dataset.id ? `/${form.dataset.id}` : ''}`, {
        method: form.dataset.id ? 'PATCH' : 'POST',
        body: JSON.stringify(values)
      });
      state.accounting.edit = null;
      await loadData();
      toast(`${config.title} berhasil disimpan.`);
    } catch (error) { $('#accounting-error').textContent = error.message; }
  });
  $('#accounting-workspace').addEventListener('click', (event) => {
    if (event.target.closest('[data-accounting-cancel]')) {
      state.accounting.edit = null;
      renderAccounting();
    }
  });
  $$('.segmented-control button').forEach((button) => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    $$('.segmented-control button').forEach((option) => option.classList.toggle('selected', option === button));
    renderTransactions();
  }));
  $('#transaction-table').addEventListener('click', async (event) => {
    const receiptButton = event.target.closest('[data-view-receipt]');
    const evidenceButton = event.target.closest('[data-view-cash-evidence]');
    const editSaleButton = event.target.closest('[data-edit-sale]');
    const deleteSaleButton = event.target.closest('[data-delete-sale]');
    const editAccountingCashButton = event.target.closest('[data-edit-accounting-cash]');
    const deleteAccountingCashButton = event.target.closest('[data-delete-accounting-cash]');
    const editButton = event.target.closest('[data-edit-transaction]');
    const deleteButton = event.target.closest('[data-delete-transaction]');
    if (receiptButton) openSaleReceiptByNumber(receiptButton.dataset.viewReceipt);
    if (evidenceButton) openCashEvidence(evidenceButton.dataset.viewCashEvidence);
    if (editSaleButton) openSaleEditModal(editSaleButton.dataset.editSale);
    if (editAccountingCashButton) {
      const [table, id] = editAccountingCashButton.dataset.editAccountingCash.split(':');
      openAccountingCashEdit(table, id);
    }
    if (deleteSaleButton) {
      const saleNo = deleteSaleButton.dataset.deleteSale;
      if (window.confirm(`Hapus penjualan ${saleNo} beserta rincian dan jurnalnya?`)) {
        try {
          await request('/api/accounting/rpc/hapus_penjualan', {
            method: 'POST',
            body: JSON.stringify({ p_no_transaksi: saleNo })
          });
          await loadData();
          toast('Penjualan, rincian, jurnal, dan stok resep berhasil diperbarui.');
        } catch (error) { toast(error.message, true); }
      }
    }
    if (deleteAccountingCashButton) {
      const [table, id] = deleteAccountingCashButton.dataset.deleteAccountingCash.split(':');
      if (!['kas_masuk', 'kas_keluar'].includes(table)) {
        toast('Sumber transaksi kas tidak valid.', true);
      } else if (window.confirm('Hapus transaksi kas ini? Jurnal terkait akan ikut dihapus.')) {
        try {
          await request(`/api/accounting/${table}/${id}`, { method: 'DELETE' });
          await loadData();
          toast('Transaksi kas dan jurnal terkait berhasil dihapus.');
        } catch (error) { toast(error.message, true); }
      }
    }
    if (editButton) {
      const transaction = findTransaction(editButton.dataset.editTransaction);
      if (transaction) openModal('transaction', transaction);
      else toast('Transaksi tidak ditemukan. Muat ulang data terlebih dahulu.', true);
    }
    if (deleteButton) deleteItem('transaction', deleteButton.dataset.deleteTransaction);
  });
  $('#sales-ledger-rows').addEventListener('click', (event) => {
    const receiptButton = event.target.closest('[data-view-receipt]');
    if (receiptButton) openSaleReceipt(receiptButton.dataset.viewReceipt);
  });
  $('#account-cards').addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open-account]');
    const editButton = event.target.closest('[data-edit-account]');
    const deleteButton = event.target.closest('[data-delete-account]');
    if (openButton) openAccountDetail(openButton.dataset.openAccount);
    if (editButton) openModal('account', state.kas.find((account) => account.id === editButton.dataset.editAccount));
    if (deleteButton) deleteItem('account', deleteButton.dataset.deleteAccount);
  });
  $('#account-detail-rows').addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-transaction]');
    const deleteButton = event.target.closest('[data-delete-transaction]');
    if (editButton) {
      const transaction = findTransaction(editButton.dataset.editTransaction);
      if (transaction) openModal('transaction', transaction);
      else toast('Transaksi tidak ditemukan. Muat ulang data terlebih dahulu.', true);
    }
    if (deleteButton) deleteItem('transaction', deleteButton.dataset.deleteTransaction);
  });
  $('#category-cards').addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-category]');
    const deleteButton = event.target.closest('[data-delete-category]');
    if (editButton) openModal('category', state.kategori.find((category) => category.id === editButton.dataset.editCategory));
    if (deleteButton) deleteItem('category', deleteButton.dataset.deleteCategory);
  });
  $('#refresh-button').addEventListener('click', async () => {
    const iconElement = $('#refresh-button i');
    iconElement?.classList.add('spinning');
    try { await loadData(); toast('Data berhasil diperbarui.'); } catch (error) { toast(error.message, true); }
    iconElement?.classList.remove('spinning');
  });
  $('#menu-button').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
}

async function initialize() {
  initializeEvents();
  setTodayLabel();
  refreshIcons();
  showApp({ email: 'Annisa Beno', is_anonymous: true });
  try {
    const health = await request('/api/health');
    if (!health.configured) {
      const setup = directSupabaseMode
        ? 'Isi SUPABASE_URL dan SUPABASE_ANON_KEY pada frontend/js/config.js.'
        : 'Atur variabel koneksi di terminal server, lalu jalankan ulang backend.';
      $('#sync-label').textContent = 'Belum tersambung';
      setDashboardDataStatus(`Data transaksi belum dimuat. ${setup} Setelah terhubung, pastikan backend/sql/database.sql sudah dijalankan di proyek Supabase.`);
      renderAll();
      toast(`Supabase belum dikonfigurasi. ${setup} Belum siap: ${health.missing.join(', ')}.`, true);
      return;
    }
    const session = await request('/api/auth/anonymous-login', { method: 'POST' });
    state.token = session.access_token;
    showApp(session.user);
    await loadData();
  } catch (error) {
    $('#sync-label').textContent = 'Gagal tersinkron';
    setDashboardDataStatus('Data transaksi belum dapat dimuat. Periksa koneksi Supabase, kebijakan akses, dan pastikan backend/sql/database.sql sudah berhasil dijalankan.');
    renderAll();
    toast(error.message, true);
  }
}

document.addEventListener('DOMContentLoaded', initialize);

(() => {
  const journal = {
    accountId: 'all',
    from: '',
    to: '',
    printMode: null,
    initialized: false
  };

  const accountName = (id) => state.kas.find((account) => account.id === id)?.nama || 'Akun dihapus';
  const isFile = window.location.protocol === 'file:' || window.location.hostname.endsWith('.github.io');
  const today = new Date();
  const todayDate = dateKey(today);
  const monthStart = `${todayDate.slice(0, 7)}-01`;

  function defaultJournalFrom() {
    return state.transaksi.map((transaction) => transaction.tanggal).sort()[0] || monthStart;
  }

  function currentPrintRoute() {
    if (window.location.pathname === '/cetak/kas-semua') return { mode: 'all' };
    const match = window.location.pathname.match(/^\/cetak\/kas\/([0-9a-f-]{36})$/i);
    if (match) return { mode: 'account', accountId: match[1] };
    if (isFile && window.location.hash.startsWith('#cetak-kas-semua')) return { mode: 'all' };
    if (isFile && window.location.hash.startsWith('#cetak-kas-')) return { mode: 'account', accountId: window.location.hash.slice('#cetak-kas-'.length) };
    return null;
  }

  function setRoute(route) {
    if (isFile) {
      window.location.hash = route === '/jurnal-kas' ? 'jurnal-kas' : route.replaceAll('/', '-').slice(1);
      return;
    }
    window.history.pushState({}, '', route);
  }

  function ensurePanel() {
    let panel = document.getElementById('view-jurnal-kas');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'view-panel jurnal-kas-view';
    panel.id = 'view-jurnal-kas';
    panel.innerHTML = `
      <div class="page-heading jurnal-heading no-print">
        <div><p class="eyebrow">BUKU BESAR KAS</p><h1>Jurnal <em>kas</em></h1><p class="muted">Saldo awal dihitung dari seluruh mutasi sebelum tanggal mulai.</p></div>
        <button class="button button-quiet" type="button" id="journal-back"><i data-lucide="arrow-left"></i> Kembali</button>
      </div>
      <div class="jurnal-print-header"><strong>ANNISA BENO TEA HOUSE</strong><h1 id="journal-print-title">BUKU KAS</h1><p id="journal-print-period"></p></div>
      <form class="jurnal-filter no-print" id="journal-filter">
        <label>Akun kas<select id="journal-account"></select></label>
        <label>Dari tanggal<input id="journal-from" type="date" required></label>
        <label>Sampai tanggal<input id="journal-to" type="date" required></label>
        <button class="button button-primary" type="submit"><i data-lucide="filter"></i> Terapkan</button>
        <span class="jurnal-filter-spacer"></span>
        <button class="button button-quiet" type="button" id="journal-print-account"><i data-lucide="printer"></i> Cetak Akun Ini</button>
        <button class="button button-quiet" type="button" id="journal-print-all"><i data-lucide="printer"></i> Cetak Semua Kas</button>
        <p class="jurnal-error" id="journal-error" aria-live="polite"></p>
      </form>
      <div class="jurnal-print-account" id="journal-account-report">
        <div class="jurnal-summary"><div><span>Saldo awal</span><strong id="journal-opening">Rp0</strong></div><div><span>Total kas masuk</span><strong class="jurnal-debit" id="journal-debit">Rp0</strong></div><div><span>Total kas keluar</span><strong class="jurnal-credit" id="journal-credit">Rp0</strong></div><div><span>Saldo akhir</span><strong id="journal-closing">Rp0</strong></div></div>
        <div class="jurnal-table-wrap"><table class="jurnal-table"><thead><tr><th>TANGGAL</th><th>KETERANGAN</th><th class="jurnal-number">MASUK</th><th class="jurnal-number">KELUAR</th><th class="jurnal-number">SALDO</th></tr></thead><tbody id="journal-rows"></tbody><tfoot><tr><th colspan="2">TOTAL PERIODE</th><th class="jurnal-number jurnal-debit" id="journal-total-debit">Rp0</th><th class="jurnal-number jurnal-credit" id="journal-total-credit">Rp0</th><th class="jurnal-number" id="journal-total-balance">Rp0</th></tr></tfoot></table></div>
        <div class="jurnal-signatures"><div>Dibuat oleh,<span></span></div><div>Disetujui oleh,<span></span></div></div>
      </div>
      <div class="jurnal-print-all" id="journal-all-report">
        <div class="jurnal-table-wrap"><table class="jurnal-table"><thead><tr><th>NO</th><th>NAMA AKUN</th><th class="jurnal-number">SALDO AWAL</th><th class="jurnal-number">TOTAL MASUK</th><th class="jurnal-number">TOTAL KELUAR</th><th class="jurnal-number">SALDO AKHIR</th></tr></thead><tbody id="journal-all-rows"></tbody><tfoot><tr><th colspan="2">TOTAL</th><th class="jurnal-number" id="journal-all-opening">Rp0</th><th class="jurnal-number jurnal-debit" id="journal-all-debit">Rp0</th><th class="jurnal-number jurnal-credit" id="journal-all-credit">Rp0</th><th class="jurnal-number" id="journal-all-closing">Rp0</th></tr></tfoot></table></div>
        <div class="jurnal-signatures"><div>Dibuat oleh,<span></span></div><div>Disetujui oleh,<span></span></div></div>
      </div>`;
    document.querySelector('.main-content').append(panel);
    bindPanelEvents(panel);
    return panel;
  }

  function movements(accountId = 'all') {
    const rows = [];
    state.transaksi.forEach((transaction) => {
      (transaction.detail_transaksi || []).forEach((detail) => {
        if (accountId !== 'all' && detail.kas_id !== accountId) return;
        const direction = transaction.jenis === 'transfer' ? detail.arah : transaction.jenis;
        if (!['masuk', 'keluar'].includes(direction)) return;
        rows.push({
          tanggal: transaction.tanggal,
          createdAt: transaction.created_at || '',
          keterangan: transaction.catatan,
          akun: accountName(detail.kas_id),
          rincian: detail.catatan || detail.kategori?.nama || '',
          arah: direction,
          nominal: Number(detail.nominal || 0),
          jenis: transaction.jenis
        });
      });
    });
    return rows.sort((first, second) => first.tanggal.localeCompare(second.tanggal) || first.createdAt.localeCompare(second.createdAt));
  }

  function accountPeriod(accountId) {
    const allRows = movements(accountId);
    const openingRows = allRows.filter((row) => row.tanggal < journal.from);
    const periodRows = allRows.filter((row) => row.tanggal >= journal.from && row.tanggal <= journal.to);
    const opening = openingRows.reduce((balance, row) => balance + (row.arah === 'masuk' ? row.nominal : -row.nominal), 0);
    let balance = opening;
    let debit = 0;
    let credit = 0;
    const rows = periodRows.map((row) => {
      if (row.arah === 'masuk') debit += row.nominal;
      else credit += row.nominal;
      balance += row.arah === 'masuk' ? row.nominal : -row.nominal;
      return { ...row, saldo: balance };
    });
    return { opening, debit, credit, closing: balance, rows };
  }

  function renderJournal() {
    const panel = ensurePanel();
    const accountSelect = panel.querySelector('#journal-account');
    journal.from = journal.from || defaultJournalFrom();
    journal.to = journal.to || todayDate;
    const printRoute = currentPrintRoute();
    if (printRoute?.mode === 'account') journal.accountId = printRoute.accountId;
    const selectedAccount = journal.accountId || state.kas.find((account) => account.nama === 'Kas Utama')?.id || state.kas[0]?.id || 'all';
    journal.accountId = selectedAccount;
    accountSelect.innerHTML = `<option value="all">Semua Kas</option>${orderedKas().map((account) => `<option value="${account.id}">${escapeHtml(account.nama)}</option>`).join('')}`;
    accountSelect.value = selectedAccount;
    panel.querySelector('#journal-from').value = journal.from || monthStart;
    panel.querySelector('#journal-to').value = journal.to || todayDate;
    const account = state.kas.find((item) => item.id === journal.accountId);
    const allMode = journal.printMode === 'all' || printRoute?.mode === 'all';
    const selectedAccountId = journal.accountId === 'all' ? 'all' : journal.accountId;
    const period = accountPeriod(selectedAccountId);

    panel.querySelector('#journal-print-title').textContent = allMode ? 'REKAPITULASI SEMUA AKUN KAS' : `BUKU KAS - ${account?.nama || 'Semua Kas'}`;
    panel.querySelector('#journal-print-period').textContent = `Periode ${displayDate(journal.from)} s.d. ${displayDate(journal.to)}`;
    panel.querySelector('#journal-account-report').hidden = allMode;
    panel.querySelector('#journal-all-report').hidden = !allMode;
    panel.querySelector('#journal-print-account').disabled = state.kas.length === 0;

    panel.querySelector('#journal-opening').textContent = money(period.opening);
    panel.querySelector('#journal-debit').textContent = money(period.debit);
    panel.querySelector('#journal-credit').textContent = money(period.credit);
    panel.querySelector('#journal-closing').textContent = money(period.closing);
    panel.querySelector('#journal-total-debit').textContent = money(period.debit);
    panel.querySelector('#journal-total-credit').textContent = money(period.credit);
    panel.querySelector('#journal-total-balance').textContent = money(period.closing);
    panel.querySelector('#journal-rows').innerHTML = [
      `<tr class="jurnal-opening-row"><td>${displayDate(journal.from)}</td><td>Saldo Awal</td><td class="jurnal-number">-</td><td class="jurnal-number">-</td><td class="jurnal-number">${money(period.opening)}</td></tr>`,
      ...period.rows.map((row) => `<tr><td>${displayDate(row.tanggal)}</td><td>${escapeHtml(row.keterangan)}${journal.accountId === 'all' ? ` · ${escapeHtml(row.akun)}` : ''}${row.rincian ? `<small>${escapeHtml(row.rincian)}</small>` : ''}</td><td class="jurnal-number jurnal-debit">${row.arah === 'masuk' ? money(row.nominal) : '-'}</td><td class="jurnal-number jurnal-credit">${row.arah === 'keluar' ? money(row.nominal) : '-'}</td><td class="jurnal-number">${money(row.saldo)}</td></tr>`)
    ].join('');

    const accounts = state.kas.map((item) => {
      const summary = accountPeriod(item.id);
      return { nama: item.nama, ...summary };
    });
    const allTotals = accounts.reduce((totals, item) => ({ opening: totals.opening + item.opening, debit: totals.debit + item.debit, credit: totals.credit + item.credit, closing: totals.closing + item.closing }), { opening: 0, debit: 0, credit: 0, closing: 0 });
    panel.querySelector('#journal-all-rows').innerHTML = accounts.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.nama)}</td><td class="jurnal-number">${money(item.opening)}</td><td class="jurnal-number jurnal-debit">${money(item.debit)}</td><td class="jurnal-number jurnal-credit">${money(item.credit)}</td><td class="jurnal-number">${money(item.closing)}</td></tr>`).join('');
    panel.querySelector('#journal-all-opening').textContent = money(allTotals.opening);
    panel.querySelector('#journal-all-debit').textContent = money(allTotals.debit);
    panel.querySelector('#journal-all-credit').textContent = money(allTotals.credit);
    panel.querySelector('#journal-all-closing').textContent = money(allTotals.closing);
    refreshIcons();
  }

  function activateJournalView() {
    const panel = ensurePanel();
    document.querySelectorAll('.view-panel').forEach((item) => item.classList.toggle('active', item === panel));
    document.querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.view === 'jurnal-kas'));
    document.querySelector('#breadcrumb-current').textContent = 'Jurnal Kas';
    document.querySelector('#sidebar').classList.remove('open');
  }

  function openJournal(route = true) {
    ensurePanel();
    if (!journal.from) journal.from = defaultJournalFrom();
    if (!journal.to) journal.to = todayDate;
    activateJournalView();
    renderJournal();
    if (route) setRoute('/jurnal-kas');
  }

  function printAccount() {
    if (journal.accountId === 'all') {
      const accountWithActivity = state.kas.find((account) => movements(account.id).some((row) => row.tanggal >= journal.from && row.tanggal <= journal.to));
      journal.accountId = accountWithActivity?.id || state.kas.find((account) => account.nama === 'Kas Utama')?.id || state.kas[0]?.id || '';
    }
    if (!journal.accountId) return;
    journal.printMode = 'account';
    setRoute(`/cetak/kas/${journal.accountId}`);
    activateJournalView();
    renderJournal();
    document.body.classList.add('jurnal-printing');
    window.print();
  }

  function printAllAccounts() {
    journal.printMode = 'all';
    setRoute('/cetak/kas-semua');
    activateJournalView();
    renderJournal();
    document.body.classList.add('jurnal-printing');
    window.print();
  }

  function bindPanelEvents(panel) {
    panel.querySelector('#journal-filter').addEventListener('submit', (event) => {
      event.preventDefault();
      const from = panel.querySelector('#journal-from').value;
      const to = panel.querySelector('#journal-to').value;
      if (!from || !to || from > to) {
        panel.querySelector('#journal-error').textContent = 'Tanggal awal harus sama dengan atau sebelum tanggal akhir.';
        return;
      }
      panel.querySelector('#journal-error').textContent = '';
      journal.from = from;
      journal.to = to;
      journal.accountId = panel.querySelector('#journal-account').value;
      renderJournal();
    });
    panel.querySelector('#journal-account').addEventListener('change', (event) => {
      journal.accountId = event.target.value;
      renderJournal();
    });
    panel.querySelector('#journal-print-account').addEventListener('click', printAccount);
    panel.querySelector('#journal-print-all').addEventListener('click', printAllAccounts);
    panel.querySelector('#journal-back').addEventListener('click', () => {
      setView('overview');
      document.querySelector('#breadcrumb-current').textContent = 'Ringkasan';
      setRoute('/');
    });
  }

  function setupJournal() {
    const link = document.querySelector('[data-view="jurnal-kas"]');
    if (link) link.addEventListener('click', (event) => {
      event.preventDefault();
      openJournal();
    });

    window.addEventListener('afterprint', () => {
      journal.printMode = null;
      document.body.classList.remove('jurnal-printing', 'jurnal-print-all');
      if ((!isFile && window.location.pathname.startsWith('/cetak/')) || (isFile && window.location.hash.startsWith('#cetak-kas'))) setRoute('/jurnal-kas');
      activateJournalView();
      renderJournal();
    });

    const printRoute = currentPrintRoute();
    const journalRoute = window.location.pathname === '/jurnal-kas' || (isFile && window.location.hash === '#jurnal-kas');
    if (printRoute) {
      journal.printMode = printRoute.mode;
      if (printRoute.accountId) journal.accountId = printRoute.accountId;
    }

    const appShell = document.querySelector('#app-shell');
    const syncLabel = document.querySelector('#sync-label');
    let initialRouteHandled = false;
    const observer = new MutationObserver(() => {
      if (appShell.hidden || syncLabel.textContent !== 'Tersinkron') return;
      if (!initialRouteHandled) {
        initialRouteHandled = true;
        if (printRoute) {
          journal.from = journal.from || defaultJournalFrom();
          journal.to = journal.to || todayDate;
          openJournal(false);
          renderJournal();
          window.setTimeout(() => window.print(), 150);
        } else if (journalRoute) {
          openJournal(false);
        }
        return;
      }
      if (document.querySelector('#view-jurnal-kas.active')) renderJournal();
    });
    observer.observe(syncLabel, { childList: true, characterData: true, subtree: true });
    observer.observe(appShell, { attributes: true, attributeFilter: ['hidden'] });
    if (!appShell.hidden && syncLabel.textContent === 'Tersinkron') {
      if (printRoute) {
        journal.from = journal.from || defaultJournalFrom();
        journal.to = journal.to || todayDate;
        openJournal(false);
        renderJournal();
        window.setTimeout(() => window.print(), 150);
      } else if (journalRoute) {
        openJournal(false);
      }
      initialRouteHandled = true;
    }

    window.addEventListener('popstate', () => {
      if (window.location.pathname === '/jurnal-kas') openJournal(false);
      else if (!window.location.pathname.startsWith('/cetak/')) {
        setView('overview');
        document.querySelector('#breadcrumb-current').textContent = 'Ringkasan';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupJournal();
    if (window.location.hash === '#jurnal-kas' && !document.querySelector('#app-shell').hidden) openJournal(false);
  });
})();
