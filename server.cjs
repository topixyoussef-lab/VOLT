const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE_SRC = path.join(__dirname, 'data', 'data.json');
const DATA_FILE_TMP = path.join('/tmp', 'data.json');

// Redis config (Upstash REST API — shared across all Vercel instances)
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);
const REDIS_KEY = 'volt_data';

// In-memory active customer tracking (falls back if Redis unavailable)
const activeMap = new Map();
const ACTIVE_TTL = 70000; // 70 seconds (longer than 30s heartbeat interval)

function redisGet(key) {
  return new Promise((resolve) => {
    if (!USE_REDIS) { resolve(null); return; }
    const url = new URL('/get/' + key, UPSTASH_URL);
    const opts = {
      hostname: url.hostname, path: url.pathname, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + UPSTASH_TOKEN }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body).result); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function redisSet(key, value) {
  return new Promise((resolve) => {
    if (!USE_REDIS) { resolve(false); return; }
    const url = new URL('/set/' + key + '/' + encodeURIComponent(value), UPSTASH_URL);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + UPSTASH_TOKEN }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body.trim() === 'OK'));
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Detect writable data path once at startup
function detectDataFile() {
  if (process.env.VERCEL) return DATA_FILE_TMP;
  try {
    fs.accessSync(path.join(__dirname, 'data'), fs.constants.W_OK);
    return DATA_FILE_SRC;
  } catch {
    return DATA_FILE_TMP;
  }
}
let DATA_FILE = detectDataFile();

// Seed /tmp/data.json from the deployment copy on cold start
if (DATA_FILE === DATA_FILE_TMP) {
  try {
    if (!fs.existsSync(DATA_FILE_TMP)) {
      const seed = fs.readFileSync(DATA_FILE_SRC, 'utf-8');
      fs.writeFileSync(DATA_FILE_TMP, seed, 'utf-8');
    }
  } catch {}
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

async function readData() {
  // Redis: shared across all Vercel instances
  if (USE_REDIS) {
    const raw = await redisGet(REDIS_KEY);
    if (raw) { return JSON.parse(raw); }
    // Seed Redis from file on first use
    const seed = (() => { try { return JSON.parse(fs.readFileSync(DATA_FILE_SRC, 'utf-8')); } catch { return null; } })();
    if (seed) { await redisSet(REDIS_KEY, JSON.stringify(seed, null, 2)); return seed; }
    const empty = { products: [], orders: [], customers: [], messages: [], offers: [], notifications: [] };
    await redisSet(REDIS_KEY, JSON.stringify(empty));
    return empty;
  }
  // File-based fallback (local / Render)
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch {}
  try { return JSON.parse(fs.readFileSync(DATA_FILE_SRC, 'utf-8')); } catch {}
  return { products: [], orders: [], customers: [], messages: [], offers: [], notifications: [] };
}
async function writeData(d) {
  const str = JSON.stringify(d, null, 2);
  if (USE_REDIS) { await redisSet(REDIS_KEY, str); }
  try { fs.writeFileSync(DATA_FILE, str, 'utf-8'); } catch {}
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(500); res.end(); return; }
    res.writeHead(200, { 'Content-Type': contentType || 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    res.end(data);
  });
}

function serveStatic(req, res) {
  let fp = path.join(ROOT, req.url);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end(data);
  });
}

// ============================================================
// HANDLER (shared between http server and Vercel)
// ============================================================
async function handleRequest(req, res) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const p = u.pathname;

  // ---- ADMIN ROUTES ----
  if (p === '/login' || p === '/login.html')
    return serveFile(res, path.join(ROOT, 'login.html'));

  if (p === '/admin' || p === '/admin.html')
    return serveFile(res, path.join(ROOT, 'admin.html'));

  if (p === '/api/admin/products' && req.method === 'GET')
    return sendJSON(res, 200, (await readData()).products);

  if (p === '/api/admin/products' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = await readData();
    body.id = Date.now();
    data.products.push(body);
    writeData(data);
    return sendJSON(res, 200, { success: true, id: body.id });
  }

  const putM = p.match(/^\/api\/admin\/products\/(\d+)$/);
  if (putM && req.method === 'PUT') {
    const id = parseInt(putM[1]);
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = await readData();
    const idx = data.products.findIndex(x => x.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    data.products[idx] = { ...data.products[idx], ...body, id };
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  const delM = p.match(/^\/api\/admin\/products\/(\d+)$/);
  if (delM && req.method === 'DELETE') {
    const data = await readData();
    data.products = data.products.filter(x => x.id !== parseInt(delM[1]));
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (p === '/api/admin/orders' && req.method === 'GET')
    return sendJSON(res, 200, (await readData()).orders);

  if (p === '/api/admin/orders' && req.method === 'DELETE') {
    const data = await readData();
    data.orders = [];
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (p === '/api/admin/customers' && req.method === 'GET')
    return sendJSON(res, 200, (await readData()).customers);

  const custDel = p.match(/^\/api\/admin\/customers\/(\d+)$/);
  if (custDel && req.method === 'DELETE') {
    const data = await readData();
    data.customers = data.customers.filter(x => x.id !== parseInt(custDel[1]));
    data.messages = (data.messages || []).filter(m => m.customerId !== parseInt(custDel[1]));
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (p === '/api/admin/notifications' && req.method === 'GET')
    return sendJSON(res, 200, ((await readData()).notifications || []).reverse());

  if (p === '/api/admin/notifications/read' && req.method === 'POST') {
    const data = await readData();
    (data.notifications || []).forEach(n => n.read = true);
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (p === '/api/admin/offers' && req.method === 'GET')
    return sendJSON(res, 200, (await readData()).offers || []);

  if (p === '/api/admin/offers' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = await readData();
    body.id = Date.now();
    if (!data.offers) data.offers = [];
    data.offers.push(body);
    writeData(data);
    return sendJSON(res, 200, { success: true, id: body.id });
  }

  const offerDel = p.match(/^\/api\/admin\/offers\/(\d+)$/);
  if (offerDel && req.method === 'DELETE') {
    const data = await readData();
    data.offers = (data.offers || []).filter(x => x.id !== parseInt(offerDel[1]));
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (offerDel && req.method === 'PUT') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = await readData();
    const idx = (data.offers || []).findIndex(x => x.id === parseInt(offerDel[1]));
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    data.offers[idx] = { ...data.offers[idx], ...body, id: data.offers[idx].id };
    writeData(data);
    return sendJSON(res, 200, { success: true, offer: data.offers[idx] });
  }

  if (p === '/api/admin/chat' && req.method === 'GET') {
    const data = await readData();
    const customerId = parseInt(u.searchParams.get('customerId'));
    let msgs = data.messages || [];
    if (customerId) msgs = msgs.filter(m => m.customerId === customerId);
    return sendJSON(res, 200, msgs);
  }

  if (p === '/api/admin/chat' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.customerId) return sendJSON(res, 400, { error: 'customerId required' });
    const data = await readData();
    if (!data.messages) data.messages = [];
    data.messages.push({
      id: Date.now(),
      customerId: body.customerId,
      from: 'admin',
      text: body.text,
      time: new Date().toLocaleString('en-GB')
    });
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  // ---- ACTIVE / ONLINE TRACKING ----

  if (p === '/api/heartbeat' && req.method === 'POST') {
    const body = await parseBody(req);
    if (body && body.customerId) {
      const now = Date.now();
      activeMap.set(body.customerId, now);
      if (USE_REDIS) {
        try {
          const raw = await redisGet('active:customers');
          const active = raw ? JSON.parse(raw) : {};
          active[body.customerId] = now;
          for (const k of Object.keys(active)) { if (now - active[k] > ACTIVE_TTL) delete active[k]; }
          await redisSet('active:customers', JSON.stringify(active));
        } catch {}
      }
    }
    return sendJSON(res, 200, { success: true });
  }

  if (p === '/api/admin/online' && req.method === 'GET') {
    const now = Date.now();
    let count = 0;
    if (USE_REDIS) {
      try {
        const raw = await redisGet('active:customers');
        if (raw) {
          const active = JSON.parse(raw);
          for (const [k, v] of Object.entries(active)) {
            if (now - v > ACTIVE_TTL) delete active[k];
            else count++;
          }
          await redisSet('active:customers', JSON.stringify(active));
        }
      } catch {}
    }
    if (!count) {
      activeMap.forEach((ts, id) => {
        if (now - ts > ACTIVE_TTL) activeMap.delete(id);
        else count++;
      });
    }
    return sendJSON(res, 200, { count });
  }

  if (p === '/api/admin/stats/daily' && req.method === 'GET') {
    const data = await readData();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const dateStr = today.toLocaleDateString('en-GB');
    const yesStr = yesterday.toLocaleDateString('en-GB');

    function inRange(order, start, end) {
      if (!order.date) return false;
      const d = new Date(order.date.split(',')[0].split('/').reverse().join('-'));
      return d >= start && d < end;
    }

    const todayOrders = data.orders.filter(o => o.date && o.date.indexOf(dateStr) !== -1);
    const yesOrders = data.orders.filter(o => o.date && o.date.indexOf(yesStr) !== -1);
    const weekOrders = data.orders.filter(o => o.date && new Date(o.date.split(',')[0].split('/').reverse().join('-')) >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
    const lastWeekOrders = data.orders.filter(o => o.date && new Date(o.date.split(',')[0].split('/').reverse().join('-')) >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13) && new Date(o.date.split(',')[0].split('/').reverse().join('-')) < new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));

    function sumRevenue(ords) { return ords.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0) : 0), 0); }
    function sumItems(ords) { return ords.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.qty || 0), 0) : 0), 0); }
    function avgOrder(ords) { const r = sumRevenue(ords); return ords.length ? Math.round(r / ords.length) : 0; }

    const todayCustomers = data.customers.filter(c => c.createdAt && c.createdAt.indexOf(dateStr) !== -1);
    const yesCustomers = data.customers.filter(c => c.createdAt && c.createdAt.indexOf(yesStr) !== -1);

    return sendJSON(res, 200, {
      date: dateStr,
      // Today vs Yesterday
      ordersToday: todayOrders.length,
      ordersYesterday: yesOrders.length,
      revenueToday: sumRevenue(todayOrders),
      revenueYesterday: sumRevenue(yesOrders),
      itemsToday: sumItems(todayOrders),
      itemsYesterday: sumItems(yesOrders),
      avgToday: avgOrder(todayOrders),
      avgYesterday: avgOrder(yesOrders),
      newCustomersToday: todayCustomers.length,
      newCustomersYesterday: yesCustomers.length,
      // This week vs Last week
      ordersWeek: weekOrders.length,
      ordersLastWeek: lastWeekOrders.length,
      revenueWeek: sumRevenue(weekOrders),
      revenueLastWeek: sumRevenue(lastWeekOrders),
      itemsWeek: sumItems(weekOrders),
      itemsLastWeek: sumItems(lastWeekOrders),
      avgWeek: avgOrder(weekOrders),
      avgLastWeek: avgOrder(lastWeekOrders),
      // Totals
      totalOrders: data.orders.length,
      totalRevenue: sumRevenue(data.orders),
      totalCustomers: data.customers.length
    });
  }

  if (p === '/api/admin/stats/history' && req.method === 'GET') {
    const data = await readData();
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('en-GB');
      const dayOrders = data.orders.filter(o => o.date && o.date.indexOf(dStr) !== -1);
      const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0) : 0), 0);
      const dayItems = dayOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.qty || 0), 0) : 0), 0);
      const dayCustomers = data.customers.filter(c => c.createdAt && c.createdAt.indexOf(dStr) !== -1);
      result.push({
        date: dStr.split('/')[0] + '/' + dStr.split('/')[1],
        orders: dayOrders.length,
        revenue: dayRevenue,
        items: dayItems,
        customers: dayCustomers.length
      });
    }
    return sendJSON(res, 200, result);
  }

  // ---- STORE ROUTES ----

  if (p === '/api/products' && req.method === 'GET')
    return sendJSON(res, 200, (await readData()).products);

  if (p === '/api/register' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.name) return sendJSON(res, 400, { error: 'Name required' });
    const data = await readData();
    const customer = {
      id: Date.now(),
      name: body.name,
      phone: body.phone || '',
      city: body.city || '',
      address: body.address || '',
      location: body.location || null,
      createdAt: new Date().toLocaleString('en-GB')
    };
    data.customers.push(customer);
    writeData(data);
    return sendJSON(res, 200, { success: true, customer });
  }

  const getCust = p.match(/^\/api\/customer\/(\d+)$/);
  if (getCust && req.method === 'GET') {
    const data = await readData();
    const c = data.customers.find(x => x.id === parseInt(getCust[1]));
    return sendJSON(res, c ? 200 : 404, c || { error: 'Not found' });
  }

  if (getCust && req.method === 'PUT') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = await readData();
    const idx = data.customers.findIndex(x => x.id === parseInt(getCust[1]));
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    data.customers[idx] = { ...data.customers[idx], ...body, id: data.customers[idx].id };
    writeData(data);
    return sendJSON(res, 200, { success: true, customer: data.customers[idx] });
  }

  if (p === '/api/orders/cancel' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.id) return sendJSON(res, 400, { error: 'Order ID required' });
    const data = await readData();
    const idx = data.orders.findIndex(o => o.id === body.id);
    if (idx === -1) {
      // Order not on this instance — still notify admin
      if (body.customerName) {
        if (!data.notifications) data.notifications = [];
        data.notifications.push({
          id: Date.now(),
          type: 'cancel',
          orderId: body.id,
          customerName: body.customerName,
          text: `Order canceled by ${body.customerName}`,
          time: new Date().toLocaleString('en-GB'),
          read: false
        });
        writeData(data);
      }
      return sendJSON(res, 200, { success: true });
    }
    data.orders[idx].canceled = true;
    data.orders[idx].canceledAt = new Date().toLocaleString('en-GB');
    if (!data.notifications) data.notifications = [];
    data.notifications.push({
      id: Date.now(),
      type: 'cancel',
      orderId: body.id,
      customerName: data.orders[idx].name,
      text: `Order #${data.orders.indexOf(data.orders[idx]) + 1} was canceled by ${data.orders[idx].name}`,
      time: new Date().toLocaleString('en-GB'),
      read: false
    });
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (p === '/api/offers' && req.method === 'GET')
    return sendJSON(res, 200, (await readData()).offers || []);

  if (p === '/api/orders' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = await readData();
    body.id = Date.now();
    body.date = new Date().toLocaleString('en-GB');
    data.orders.push(body);
    writeData(data);
    return sendJSON(res, 200, { success: true, id: body.id });
  }

  if (p === '/api/chat' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.customerId) return sendJSON(res, 400, { error: 'customerId required' });
    const data = await readData();
    if (!data.messages) data.messages = [];
    data.messages.push({
      id: Date.now(),
      customerId: body.customerId,
      from: 'customer',
      name: body.name || 'Unknown',
      text: body.text,
      time: new Date().toLocaleString('en-GB')
    });
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (p === '/api/chat' && req.method === 'GET') {
    const data = await readData();
    const customerId = parseInt(u.searchParams.get('customerId'));
    const since = parseInt(u.searchParams.get('since')) || 0;
    let msgs = data.messages || [];
    if (customerId) msgs = msgs.filter(m => m.customerId === customerId);
    msgs = msgs.filter(m => m.id > since);
    return sendJSON(res, 200, msgs);
  }

  // Serve index.html for root
  if (p === '/' || p === '/index.html')
    return serveFile(res, path.join(ROOT, 'index.html'));

  // Debug endpoint
  if (p === '/api/debug') {
    const apkPath = path.join(ROOT, 'downloads', 'VOLT.apk');
    let exists = false, size = 0;
    try { const s = fs.statSync(apkPath); exists = true; size = s.size; } catch {}
    return sendJSON(res, 200, { root: ROOT, apkPath, exists, size, url: req.url, vercel: !!process.env.VERCEL });
  }

  // Serve APK download
  if (p === '/downloads/VOLT.apk') {
    const apkPath = path.join(ROOT, 'downloads', 'VOLT.apk');
    return serveFile(res, apkPath, 'application/vnd.android.package-archive');
  }

  // Serve static files (css, js, images)
  serveStatic(req, res);
}

// Standalone server (skip listen when imported by Vercel)
const server = http.createServer(handleRequest);
if (require.main === module || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Store:  http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
    console.log(`Login: http://localhost:${PORT}/login`);
  });
}

// Export for Vercel
module.exports = handleRequest;
