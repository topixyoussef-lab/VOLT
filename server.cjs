const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const ROOT = __dirname;

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

function readData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
function writeData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf-8'); }

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(500); res.end(); return; }
    res.writeHead(200, { 'Content-Type': contentType || 'text/html; charset=utf-8' });
    res.end(data);
  });
}

function serveStatic(req, res) {
  let fp = path.join(ROOT, req.url);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ============================================================
// SINGLE SERVER (store + admin on one port)
// ============================================================
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const p = u.pathname;

  // ---- ADMIN ROUTES ----

  // Serve login.html
  if (p === '/login' || p === '/login.html') {
    return serveFile(res, path.join(ROOT, 'login.html'));
  }

  // Serve admin.html
  if (p === '/admin' || p === '/admin.html') {
    return serveFile(res, path.join(ROOT, 'admin.html'));
  }

  // Admin API: Products
  if (p === '/api/admin/products' && req.method === 'GET')
    return sendJSON(res, 200, readData().products);

  if (p === '/api/admin/products' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = readData();
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
    const data = readData();
    const idx = data.products.findIndex(x => x.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    data.products[idx] = { ...data.products[idx], ...body, id };
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  const delM = p.match(/^\/api\/admin\/products\/(\d+)$/);
  if (delM && req.method === 'DELETE') {
    const data = readData();
    data.products = data.products.filter(x => x.id !== parseInt(delM[1]));
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  // Admin API: Orders
  if (p === '/api/admin/orders' && req.method === 'GET')
    return sendJSON(res, 200, readData().orders);

  if (p === '/api/admin/orders' && req.method === 'DELETE') {
    const data = readData();
    data.orders = [];
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  // Admin API: Customers
  if (p === '/api/admin/customers' && req.method === 'GET')
    return sendJSON(res, 200, readData().customers);

  // Admin API: Notifications
  if (p === '/api/admin/notifications' && req.method === 'GET')
    return sendJSON(res, 200, (readData().notifications || []).reverse());

  if (p === '/api/admin/notifications/read' && req.method === 'POST') {
    const data = readData();
    (data.notifications || []).forEach(n => n.read = true);
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  // Admin API: Offers CRUD
  if (p === '/api/admin/offers' && req.method === 'GET')
    return sendJSON(res, 200, readData().offers || []);

  if (p === '/api/admin/offers' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = readData();
    body.id = Date.now();
    if (!data.offers) data.offers = [];
    data.offers.push(body);
    writeData(data);
    return sendJSON(res, 200, { success: true, id: body.id });
  }

  const offerDel = p.match(/^\/api\/admin\/offers\/(\d+)$/);
  if (offerDel && req.method === 'DELETE') {
    const data = readData();
    data.offers = (data.offers || []).filter(x => x.id !== parseInt(offerDel[1]));
    writeData(data);
    return sendJSON(res, 200, { success: true });
  }

  if (offerDel && req.method === 'PUT') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = readData();
    const idx = (data.offers || []).findIndex(x => x.id === parseInt(offerDel[1]));
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    data.offers[idx] = { ...data.offers[idx], ...body, id: data.offers[idx].id };
    writeData(data);
    return sendJSON(res, 200, { success: true, offer: data.offers[idx] });
  }

  // Admin API: Chat
  if (p === '/api/admin/chat' && req.method === 'GET') {
    const data = readData();
    const customerId = parseInt(u.searchParams.get('customerId'));
    let msgs = data.messages || [];
    if (customerId) msgs = msgs.filter(m => m.customerId === customerId);
    return sendJSON(res, 200, msgs);
  }

  if (p === '/api/admin/chat' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.customerId) return sendJSON(res, 400, { error: 'customerId required' });
    const data = readData();
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

  // ---- STORE ROUTES ----

  // Products
  if (p === '/api/products' && req.method === 'GET') {
    return sendJSON(res, 200, readData().products);
  }

  // Register
  if (p === '/api/register' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.name) return sendJSON(res, 400, { error: 'Name required' });
    const data = readData();
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

  // Get customer
  const getCust = p.match(/^\/api\/customer\/(\d+)$/);
  if (getCust && req.method === 'GET') {
    const data = readData();
    const c = data.customers.find(x => x.id === parseInt(getCust[1]));
    return sendJSON(res, c ? 200 : 404, c || { error: 'Not found' });
  }

  // Update customer
  if (getCust && req.method === 'PUT') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = readData();
    const idx = data.customers.findIndex(x => x.id === parseInt(getCust[1]));
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    data.customers[idx] = { ...data.customers[idx], ...body, id: data.customers[idx].id };
    writeData(data);
    return sendJSON(res, 200, { success: true, customer: data.customers[idx] });
  }

  // Cancel order
  if (p === '/api/orders/cancel' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.id) return sendJSON(res, 400, { error: 'Order ID required' });
    const data = readData();
    const idx = data.orders.findIndex(o => o.id === body.id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Order not found' });
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

  // Offers (store reads)
  if (p === '/api/offers' && req.method === 'GET') {
    const data = readData();
    return sendJSON(res, 200, data.offers || []);
  }

  // Orders (store places)
  if (p === '/api/orders' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const data = readData();
    body.id = Date.now();
    body.date = new Date().toLocaleString('en-GB');
    data.orders.push(body);
    writeData(data);
    return sendJSON(res, 200, { success: true, id: body.id });
  }

  // Chat (customer)
  if (p === '/api/chat' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.customerId) return sendJSON(res, 400, { error: 'customerId required' });
    const data = readData();
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
    const data = readData();
    const customerId = parseInt(u.searchParams.get('customerId'));
    const since = parseInt(u.searchParams.get('since')) || 0;
    let msgs = data.messages || [];
    if (customerId) msgs = msgs.filter(m => m.customerId === customerId);
    msgs = msgs.filter(m => m.id > since);
    return sendJSON(res, 200, msgs);
  }

  // Serve store (index.html) for root
  if (p === '/' || p === '/index.html') {
    return serveFile(res, path.join(ROOT, 'index.html'));
  }

  // Serve static files (css, js, images)
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Store:  http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  console.log(`Login: http://localhost:${PORT}/login`);
});
