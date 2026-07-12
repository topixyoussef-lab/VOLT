document.getElementById('admin-view')?.setAttribute('data-theme', localStorage.getItem('volt_theme') || 'light');

document.getElementById('admin-theme-toggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('admin-view')?.setAttribute('data-theme', next);
  localStorage.setItem('volt_theme', next);
  if (chartAnalytics) { chartAnalytics.destroy(); }
  initCharts();
  loadCharts();
});

// Sound effects
function playSidebarSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.15);
  } catch {}
}

function playSelectSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(800, ctx.currentTime);
    o.frequency.setValueAtTime(1000, ctx.currentTime + 0.05);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.1);
  } catch {}
}

// playClickSound is defined in main.js (loaded first)

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.tagName === 'BUTTON' || t.tagName === 'A' || t.closest('button') || t.closest('a') || t.closest('[onclick]') || t.classList.contains('tab-btn') || t.classList.contains('btn')) {
    playClickSound();
  }
});

const toggleSidebar = () => {
  document.getElementById('admin-sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
  document.getElementById('mobile-menu-btn')?.classList.toggle('hidden');
};

document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
document.getElementById('mobile-menu-btn')?.addEventListener('click', toggleSidebar);

document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
  document.getElementById('admin-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
  document.getElementById('mobile-menu-btn')?.classList.remove('hidden');
});

// Desktop: hover near left edge to reveal sidebar
const adminSidebar = document.getElementById('admin-sidebar');
let sidebarTimer = null;

document.addEventListener('mousemove', (e) => {
  if (window.innerWidth <= 768) return;
  if (e.clientX < 10 && adminSidebar && !adminSidebar.classList.contains('open')) {
    adminSidebar.classList.add('open');
    playSidebarSound();
  }
});

adminSidebar?.addEventListener('mouseleave', () => {
  if (window.innerWidth <= 768) return;
  sidebarTimer = setTimeout(() => {
    adminSidebar?.classList.remove('open');
  }, 300);
});

adminSidebar?.addEventListener('mouseenter', () => {
  if (sidebarTimer) clearTimeout(sidebarTimer);
});

// Mobile: swipe left to close sidebar
let swipeStartX = 0;
adminSidebar?.addEventListener('touchstart', (e) => {
  swipeStartX = e.touches[0].clientX;
}, { passive: true });

adminSidebar?.addEventListener('touchmove', (e) => {
  if (!adminSidebar?.classList.contains('open')) return;
  const dx = e.touches[0].clientX - swipeStartX;
  if (dx < 0) {
    adminSidebar.style.transform = `translateX(${Math.max(dx, -200)}px)`;
  }
}, { passive: true });

adminSidebar?.addEventListener('touchend', () => {
  if (!adminSidebar?.classList.contains('open')) return;
  adminSidebar.style.transform = '';
  const rect = adminSidebar.getBoundingClientRect();
  if (rect.right < window.innerWidth - 50) {
    adminSidebar.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
    document.getElementById('mobile-menu-btn')?.classList.remove('hidden');
  }
}, { passive: true });

document.getElementById('logout-btn')?.addEventListener('click', () => {
  sessionStorage.removeItem('volt_admin');
  window.location.href = '/';
});

// Tabs
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    playSelectSound();
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tab = document.getElementById('tab-' + btn.dataset.tab);
    if (tab) tab.classList.add('active');
    if (btn.dataset.tab === 'chat') { loadCustomerList(); }
    document.getElementById('admin-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
    document.getElementById('mobile-menu-btn')?.classList.remove('hidden');
  });
});

const API = '/api/admin';

function syncStore() {
  if (typeof window.loadProducts === 'function') window.loadProducts();
  if (typeof window.loadOffers === 'function') window.loadOffers();
}

async function apiGet(path) { const r = await fetch(API + path); return r.json(); }
async function apiPost(path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
async function apiPut(path, body) {
  const r = await fetch(API + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
async function apiDelete(path) { const r = await fetch(API + path, { method: 'DELETE' }); return r.json(); }

function trendStr(today, yesterday) {
  if (yesterday === 0 && today === 0) return '';
  if (yesterday === 0) return '<span class="trend-up">▲ New</span>';
  const pct = ((today - yesterday) / yesterday * 100).toFixed(1);
  if (pct > 0) return `<span class="trend-up">▲ +${pct}%</span>`;
  if (pct < 0) return `<span class="trend-down">▼ ${pct}%</span>`;
  return '<span class="trend-eq">► 0%</span>';
}

function trendStrRev(today, yesterday) {
  // For metrics where lower is better (none currently, but keep for avg cost etc)
  return trendStr(today, yesterday);
}

async function loadOnlineCount() {
  const el = document.getElementById('stat-online');
  try {
    const r = await fetch('/api/admin/online');
    const d = await r.json();
    el.textContent = d.count;
  } catch { el.textContent = '—'; }
}

// Chart
let chartAnalytics;

function initCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tickColor = isDark ? '#aaa' : '#888';

  chartAnalytics = new Chart(document.getElementById('chart-analytics'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Orders', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: false, tension: 0.3, pointRadius: 3 },
        { label: 'Revenue', data: [], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: false, tension: 0.3, pointRadius: 3 },
        { label: 'New Customers', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: false, tension: 0.3, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, color: tickColor, padding: 16, usePointStyle: true } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: tickColor } },
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { size: 11 }, color: tickColor } }
      }
    }
  });
}

async function loadCharts() {
  try {
    const r = await fetch('/api/admin/stats/history');
    const data = await r.json();
    chartAnalytics.data.labels = data.map(d => d.date);
    chartAnalytics.data.datasets[0].data = data.map(d => d.orders);
    chartAnalytics.data.datasets[1].data = data.map(d => d.revenue);
    chartAnalytics.data.datasets[2].data = data.map(d => d.customers);
    chartAnalytics.update();
  } catch {}
}

async function loadDailyStats() {
  try {
    const r = await fetch('/api/admin/stats/daily');
    const d = await r.json();
    // Top summary cards
    document.getElementById('stat-total-orders').textContent = d.totalOrders;
    document.getElementById('stat-total-revenue').textContent = d.totalRevenue + ' EGP';
    document.getElementById('stat-total-customers').textContent = d.totalCustomers;

    // Analysis table
    document.getElementById('a-orders-today').textContent = d.ordersToday;
    document.getElementById('a-orders-yesterday').textContent = d.ordersYesterday;
    document.getElementById('a-trend-orders-day').innerHTML = trendStr(d.ordersToday, d.ordersYesterday);
    document.getElementById('a-orders-week').textContent = d.ordersWeek;
    document.getElementById('a-orders-lastweek').textContent = d.ordersLastWeek;
    document.getElementById('a-trend-orders-week').innerHTML = trendStr(d.ordersWeek, d.ordersLastWeek);

    document.getElementById('a-revenue-today').textContent = d.revenueToday + ' EGP';
    document.getElementById('a-revenue-yesterday').textContent = d.revenueYesterday + ' EGP';
    document.getElementById('a-trend-revenue-day').innerHTML = trendStr(d.revenueToday, d.revenueYesterday);
    document.getElementById('a-revenue-week').textContent = d.revenueWeek + ' EGP';
    document.getElementById('a-revenue-lastweek').textContent = d.revenueLastWeek + ' EGP';
    document.getElementById('a-trend-revenue-week').innerHTML = trendStr(d.revenueWeek, d.revenueLastWeek);

    document.getElementById('a-items-today').textContent = d.itemsToday;
    document.getElementById('a-items-yesterday').textContent = d.itemsYesterday;
    document.getElementById('a-trend-items-day').innerHTML = trendStr(d.itemsToday, d.itemsYesterday);
    document.getElementById('a-items-week').textContent = d.itemsWeek;
    document.getElementById('a-items-lastweek').textContent = d.itemsLastWeek;
    document.getElementById('a-trend-items-week').innerHTML = trendStr(d.itemsWeek, d.itemsLastWeek);

    document.getElementById('a-avg-today').textContent = d.avgToday + ' EGP';
    document.getElementById('a-avg-yesterday').textContent = d.avgYesterday + ' EGP';
    document.getElementById('a-trend-avg-day').innerHTML = trendStr(d.avgToday, d.avgYesterday);
    document.getElementById('a-avg-week').textContent = d.avgWeek + ' EGP';
    document.getElementById('a-avg-lastweek').textContent = d.avgLastWeek + ' EGP';
    document.getElementById('a-trend-avg-week').innerHTML = trendStr(d.avgWeek, d.avgLastWeek);

    document.getElementById('a-newcust-today').textContent = d.newCustomersToday;
    document.getElementById('a-newcust-yesterday').textContent = d.newCustomersYesterday;
    document.getElementById('a-trend-newcust-day').innerHTML = trendStr(d.newCustomersToday, d.newCustomersYesterday);
  } catch {}
}

function initApp() {
  initCharts();
  loadOnlineCount();
  loadDailyStats();
  loadCharts();
  renderProducts();
  renderOrders();
  renderOffers();
  loadNotifications();
  loadCustomerList();
}

setInterval(loadOnlineCount, 10000);
setInterval(loadDailyStats, 15000);
setInterval(loadCharts, 60000);

// ====== PRODUCTS ======
async function renderProducts() {
  const products = await apiGet('/products');
  const list = document.getElementById('product-list');
  if (products.length === 0) { list.innerHTML = '<p class="empty-msg">No products yet.</p>'; return; }
  list.innerHTML = products.map(p => `
    <div class="admin-product-card${p.available === false ? ' unavailable' : ''}">
      <div class="admin-product-img" style="background-image: url('${p.images[0] || ''}');"></div>
      <div class="admin-product-info">
        <h4>${p.name}</h4>
        <p>${p.price} EGP${p.originalPrice ? ' <s>' + p.originalPrice + ' EGP</s>' : ''} &middot; ${p.sizes.length} sizes &middot; ${p.images.length} images</p>
        <span class="status-badge ${p.available === false ? 'badge-unavail' : 'badge-avail'}">${p.available === false ? 'Unavailable' : 'Available'}</span>
      </div>
      <div class="admin-product-actions">
        <button class="btn btn-outline btn-sm" onclick="toggleAvailable(${p.id})">${p.available === false ? 'Set Available' : 'Set Unavailable'}</button>
        <button class="btn btn-outline btn-sm" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('add-product-btn')?.addEventListener('click', () => {
  document.getElementById('product-modal-title').textContent = 'Add Product';
  document.getElementById('edit-id').value = '';
  document.getElementById('product-form').reset();
  document.getElementById('product-modal-overlay').classList.add('open');
  document.getElementById('product-modal').classList.add('open');
});

async function toggleAvailable(id) {
  const products = await apiGet('/products');
  const p = products.find(x => x.id === id);
  if (!p) return;
  const newAvail = p.available === false;
  await apiPut('/products/' + id, { available: newAvail });
  renderProducts();
  syncStore();
}

async function editProduct(id) {
  const products = await apiGet('/products');
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('edit-id').value = id;
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-original').value = p.originalPrice || '';
  const typeEl = document.getElementById('p-type');
  if (typeEl) typeEl.value = p.type || '';
  document.getElementById('p-material').value = p.material || '';
  document.getElementById('p-colors').value = p.colors || '';
  document.getElementById('p-sizes').value = p.sizes.join(', ');
  document.getElementById('p-images').value = p.images.join('\n');
  document.getElementById('p-available').value = p.available === false ? 'false' : 'true';
  document.getElementById('product-modal-overlay').classList.add('open');
  document.getElementById('product-modal').classList.add('open');
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  await apiDelete('/products/' + id);
  renderProducts();
  syncStore();
}

document.getElementById('product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('edit-id').value;
  const name = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const originalPrice = parseFloat(document.getElementById('p-original').value) || null;
  const type = document.getElementById('p-type').value.trim();
  const material = document.getElementById('p-material').value.trim();
  const colors = document.getElementById('p-colors').value.trim();
  const sizes = document.getElementById('p-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
  const images = document.getElementById('p-images').value.split('\n').map(s => s.trim()).filter(Boolean);
  const available = document.getElementById('p-available').value === 'true';
  if (!name || !type || !price || !material || !colors || !sizes.length || !images.length) {
    alert('Please fill all required fields.');
    return;
  }
  try {
    const payload = { name, type, price, originalPrice, material, colors, sizes, images, available };
    let res;
    if (editId) res = await apiPut('/products/' + editId, payload);
    else res = await apiPost('/products', payload);
    if (res && res.error) { alert('Error: ' + res.error); return; }
    renderProducts();
    syncStore();
    document.getElementById('product-modal-overlay').classList.remove('open');
    document.getElementById('product-modal').classList.remove('open');
  } catch (err) {
    alert('Failed to save product. ' + err.message);
  }
});

document.getElementById('product-modal-close')?.addEventListener('click', () => {
  document.getElementById('product-modal-overlay').classList.remove('open');
  document.getElementById('product-modal').classList.remove('open');
});
document.getElementById('product-modal-overlay')?.addEventListener('click', () => {
  document.getElementById('product-modal-overlay').classList.remove('open');
  document.getElementById('product-modal').classList.remove('open');
});

// ====== ORDERS ======
async function renderOrders() {
  const orders = await apiGet('/orders');
  const list = document.getElementById('orders-list');
  const statOrders = document.getElementById('stat-orders');
  const statRevenue = document.getElementById('stat-revenue');
  const statItems = document.getElementById('stat-items');
  if (orders.length === 0) {
    list.innerHTML = '<p class="empty-msg">No orders yet.</p>';
    statOrders.textContent = '0'; statRevenue.textContent = '0 EGP'; statItems.textContent = '0';
    return;
  }
  let totalRevenue = 0, totalItems = 0;
  list.innerHTML = orders.slice().reverse().map((order, idx) => {
    const realIdx = orders.length - idx;
    let itemsHtml = '', orderTotal = 0;
    order.items.forEach(item => {
      const lt = item.price * item.qty;
      orderTotal += lt; totalRevenue += lt; totalItems += item.qty;
      itemsHtml += `<div class="order-item-line">${item.name} (Size: ${item.size}) x ${item.qty} = ${lt} EGP</div>`;
    });
    const locUrl = order.location
      ? `https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`
      : `https://www.google.com/maps?q=${encodeURIComponent(order.city + ', ' + order.address)}`;
    const canceled = order.canceled ? '<span class="order-canceled-badge">Canceled</span>' : '';
    return `
      <div class="order-card${canceled ? ' order-canceled' : ''}">
        <div class="order-header">
          <span class="order-id">Order #${realIdx}</span>
          <span class="order-date">${order.date} ${canceled}</span>
        </div>
        <div class="order-body">
          <div class="order-info-row"><span class="label">Name</span><span class="value">${order.name}</span></div>
          <div class="order-info-row"><span class="label">Phone</span><span class="value">${order.phone}</span></div>
          <div class="order-info-row"><span class="label">City</span><span class="value">${order.city}</span></div>
          <div class="order-info-row"><span class="label">Address</span><span class="value">${order.address}</span></div>
        </div>
        <div class="order-items"><h4>Items</h4>${itemsHtml}<div class="order-total-line">Total: ${orderTotal} EGP</div></div>
        <div class="order-location"><a href="${locUrl}" target="_blank">View Location on Maps</a></div>
      </div>`;
  }).join('');
  statOrders.textContent = orders.length;
  statRevenue.textContent = totalRevenue + ' EGP';
  statItems.textContent = totalItems;
}

document.getElementById('clear-btn')?.addEventListener('click', async () => {
  if (confirm('Clear all orders?')) { await apiDelete('/orders'); renderOrders(); }
});

// ====== OFFERS ======
async function renderOffers() {
  const offers = await apiGet('/offers');
  const list = document.getElementById('offers-list');
  if (offers.length === 0) { list.innerHTML = '<p class="empty-msg">No offers yet.</p>'; return; }
  list.innerHTML = offers.map(o => `
    <div class="offer-card">
      <div class="offer-info">
        <h4>${o.title}</h4>
        <p>${o.desc}</p>
        <span class="offer-meta">${o.productType || 'All'} &middot; Buy ${o.buy} get ${o.free} free &middot; ${o.active ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="offer-actions">
        <button class="btn btn-outline btn-sm" onclick="toggleOffer(${o.id})">${o.active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-sm" style="background:#333;color:#fff" onclick="editOffer(${o.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteOffer(${o.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function toggleOffer(id) {
  const offers = await apiGet('/offers');
  const o = offers.find(x => x.id === id);
  if (!o) return;
  await apiPut('/offers/' + id, { active: !o.active });
  renderOffers();
  syncStore();
}

async function deleteOffer(id) {
  if (!confirm('Delete this offer?')) return;
  await apiDelete('/offers/' + id);
  renderOffers();
  syncStore();
}

async function editOffer(id) {
  const offers = await apiGet('/offers');
  const o = offers.find(x => x.id === id);
  if (!o) return;
  document.getElementById('offer-modal-title').textContent = 'Edit Offer';
  document.getElementById('offer-edit-id').value = o.id;
  document.getElementById('offer-title').value = o.title || '';
  document.getElementById('offer-desc').value = o.desc || '';
  const optEl = document.getElementById('offer-product-type');
  if (optEl) optEl.value = o.productType || '';
  document.getElementById('offer-buy').value = o.buy || 4;
  document.getElementById('offer-free').value = o.free || 1;
  document.getElementById('offer-active').value = o.active ? 'true' : 'false';
  document.getElementById('offer-modal-overlay').classList.add('open');
  document.getElementById('offer-modal').classList.add('open');
}

document.getElementById('add-offer-btn')?.addEventListener('click', () => {
  document.getElementById('offer-modal-title').textContent = 'Add Offer';
  document.getElementById('offer-edit-id').value = '';
  document.getElementById('offer-form').reset();
  document.getElementById('offer-modal-overlay').classList.add('open');
  document.getElementById('offer-modal').classList.add('open');
});

document.getElementById('offer-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('offer-edit-id').value;
  const title = document.getElementById('offer-title').value.trim();
  const desc = document.getElementById('offer-desc').value.trim();
  const productType = document.getElementById('offer-product-type').value.trim();
  const buy = parseInt(document.getElementById('offer-buy').value) || 4;
  const free = parseInt(document.getElementById('offer-free').value) || 1;
  const active = document.getElementById('offer-active').value === 'true';
  if (!title || !desc) { alert('Please fill title and description.'); return; }
  try {
    const payload = { title, desc, productType, buy, free, active };
    let res;
    if (editId) res = await apiPut('/offers/' + editId, payload);
    else res = await apiPost('/offers', payload);
    if (res && res.error) { alert('Error: ' + res.error); return; }
    renderOffers();
    syncStore();
    document.getElementById('offer-modal-overlay').classList.remove('open');
    document.getElementById('offer-modal').classList.remove('open');
  } catch (err) {
    alert('Failed to save offer. ' + err.message);
  }
});

document.getElementById('offer-modal-close')?.addEventListener('click', () => {
  document.getElementById('offer-modal-overlay').classList.remove('open');
  document.getElementById('offer-modal').classList.remove('open');
});
document.getElementById('offer-modal-overlay')?.addEventListener('click', () => {
  document.getElementById('offer-modal-overlay').classList.remove('open');
  document.getElementById('offer-modal').classList.remove('open');
});

// ====== NOTIFICATIONS ======
async function loadNotifications() {
  let notifs = await apiGet('/notifications');
  // Merge localStorage notifications from store cancels (Vercel multi-instance)
  try {
    const local = JSON.parse(localStorage.getItem('volt_notifications') || '[]');
    // Merge local into server list, dedup by id
    const serverIds = new Set(notifs.map(n => n.id));
    local.forEach(n => { if (!serverIds.has(n.id)) { notifs.push(n); serverIds.add(n.id); } });
  } catch {}
  notifs.sort((a, b) => b.id - a.id); // newest first
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');
  if (notifs.length === 0) { list.innerHTML = '<p class="empty-msg">No notifications.</p>'; badge.classList.remove('has-unread'); return; }
  const unread = notifs.filter(n => !n.read).length;
  if (unread > 0) { badge.textContent = unread; badge.classList.add('has-unread'); } else { badge.classList.remove('has-unread'); }
  list.innerHTML = notifs.map(n => `
    <div class="notif-item${n.read ? '' : ' unread'}">
      <div><div class="notif-text">${n.text}</div><div class="notif-time">${n.time}</div></div>
    </div>
  `).join('');
}

setInterval(loadNotifications, 2000);

document.getElementById('notif-tab-btn')?.addEventListener('click', async () => {
  await apiPost('/notifications/read');
  // Mark local notifications as read too
  try {
    const local = JSON.parse(localStorage.getItem('volt_notifications') || '[]');
    local.forEach(n => n.read = true);
    localStorage.setItem('volt_notifications', JSON.stringify(local));
  } catch {}
  loadNotifications();
});

// ====== CHAT ======
let selectedCustomerId = null;
let chatPollInterval = null;

async function loadCustomerList() {
  const customers = await apiGet('/customers');
  const messages = await apiGet('/chat');
  const list = document.getElementById('chat-customer-list');
  if (customers.length === 0) {
    list.innerHTML = '<p class="empty-msg">No customers yet.</p>';
    return;
  }
  list.innerHTML = customers.map(c => {
    const lastMsg = messages.filter(m => m.customerId === c.id).pop();
    const lastText = lastMsg ? lastMsg.text.substring(0, 40) + (lastMsg.text.length > 40 ? '...' : '') : 'No messages';
    return `<div class="customer-thread ${selectedCustomerId === c.id ? 'active' : ''}" onclick="selectCustomer(${c.id})">
      <div class="thread-name">${c.name}</div>
      <div class="thread-phone">${c.phone}</div>
      <div class="thread-preview">${lastText}</div>
    </div>`;
  }).join('');
}

async function selectCustomer(id) {
  selectedCustomerId = id;
  document.querySelectorAll('.customer-thread').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.customer-thread[onclick*="${id}"]`);
  if (el) el.classList.add('active');
  document.getElementById('chat-conv-header').textContent = `Chat with ${getCustomerName(id)}`;
  await loadMessages();
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(loadMessages, 1500);
}

function getCustomerName(id) {
  const el = document.querySelector(`.customer-thread[onclick*="${id}"] .thread-name`);
  return el ? el.textContent : 'Customer';
}

async function loadMessages() {
  if (!selectedCustomerId) return;
  const msgs = await apiGet(`/chat?customerId=${selectedCustomerId}`);
  const el = document.getElementById('admin-chat-messages');
  if (msgs.length === 0) {
    el.innerHTML = '<p class="empty-msg">No messages yet.</p>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const nameTag = m.from === 'customer' && m.name ? `<strong>${m.name}</strong><br>` : '';
    return `<div class="chat-msg ${m.from}">${nameTag}${m.text}<span class="msg-time">${m.time}</span></div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('admin-chat-input');
  const text = input.value.trim();
  if (!text || !selectedCustomerId) return;
  await apiPost('/chat', { text, customerId: selectedCustomerId });
  input.value = '';
  loadMessages();
  loadCustomerList();
}

document.getElementById('admin-chat-send')?.addEventListener('click', sendMessage);
document.getElementById('admin-chat-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

window.adminInitApp = initApp;
