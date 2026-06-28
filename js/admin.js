const savedTheme = localStorage.getItem('volt_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

document.getElementById('admin-theme-toggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('volt_theme', next);
});

if (sessionStorage.getItem('volt_admin') !== 'true') {
  window.location.href = 'login.html';
}

document.getElementById('logout-btn')?.addEventListener('click', () => {
  sessionStorage.removeItem('volt_admin');
  window.location.href = 'login.html';
});

// Tabs
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tab = document.getElementById('tab-' + btn.dataset.tab);
    if (tab) tab.classList.add('active');
    if (btn.dataset.tab === 'chat') { loadCustomerList(); }
  });
});

const API = '/api/admin';

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

async function loadUserCount() {
  const statUsers = document.getElementById('stat-users');
  try {
    const customers = await apiGet('/customers');
    statUsers.textContent = customers.length;
  } catch { statUsers.textContent = '—'; }
}

function initApp() {
  loadUserCount();
  renderProducts();
  renderOrders();
  renderOffers();
  loadNotifications();
  loadCustomerList();
}

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
  await apiPut('/products/' + id, { available: p.available === false });
  renderProducts();
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
}

document.getElementById('product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('edit-id').value;
  const name = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const originalPrice = parseFloat(document.getElementById('p-original').value) || null;
  const material = document.getElementById('p-material').value.trim();
  const colors = document.getElementById('p-colors').value.trim();
  const sizes = document.getElementById('p-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
  const images = document.getElementById('p-images').value.split('\n').map(s => s.trim()).filter(Boolean);
  const available = document.getElementById('p-available').value === 'true';
  if (!name || !price || !sizes.length || !images.length) return;
  const payload = { name, price, originalPrice, material, colors, sizes, images, available };
  if (editId) await apiPut('/products/' + editId, payload);
  else await apiPost('/products', payload);
  renderProducts();
  document.getElementById('product-modal-overlay').classList.remove('open');
  document.getElementById('product-modal').classList.remove('open');
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
        <span class="offer-meta">${o.product || 'All'} &middot; Buy ${o.buy} get ${o.free} free &middot; ${o.active ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="offer-actions">
        <button class="btn btn-outline btn-sm" onclick="toggleOffer(${o.id})">${o.active ? 'Deactivate' : 'Activate'}</button>
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
}

async function deleteOffer(id) {
  if (!confirm('Delete this offer?')) return;
  await apiDelete('/offers/' + id);
  renderOffers();
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
  const product = document.getElementById('offer-product').value.trim();
  const buy = parseInt(document.getElementById('offer-buy').value) || 4;
  const free = parseInt(document.getElementById('offer-free').value) || 1;
  const active = document.getElementById('offer-active').value === 'true';
  if (!title || !desc) return;
  const payload = { title, desc, product, buy, free, active };
  if (editId) await apiPut('/offers/' + editId, payload);
  else await apiPost('/offers', payload);
  renderOffers();
  document.getElementById('offer-modal-overlay').classList.remove('open');
  document.getElementById('offer-modal').classList.remove('open');
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
  const notifs = await apiGet('/notifications');
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

setInterval(loadNotifications, 5000);

document.getElementById('notif-tab-btn')?.addEventListener('click', async () => {
  await apiPost('/notifications/read');
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
  chatPollInterval = setInterval(loadMessages, 3000);
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

// ====== CUSTOMERS ======
async function showCustomers() {
  const customers = await apiGet('/customers');
  const list = document.getElementById('customers-list');
  if (customers.length === 0) { list.innerHTML = '<p class="empty-msg">No registered users.</p>'; return; }
  list.innerHTML = customers.map(c => `
    <div class="customer-card-admin">
      <div class="customer-info-admin">
        <strong>${c.name}</strong>
        <span>${c.phone} &middot; ${c.city}</span>
        <small>${c.address}${c.location ? ' &middot; 📍' : ''} &middot; ${c.createdAt || ''}</small>
      </div>
      <div class="customer-actions-admin">
        <button class="btn btn-outline btn-sm" onclick="showCustomerDetail(${c.id})">View</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id})">Delete</button>
      </div>
    </div>
  `).join('');
  document.getElementById('customers-modal-overlay').classList.add('open');
  document.getElementById('customers-modal').classList.add('open');
}

async function showCustomerDetail(id) {
  const customers = await apiGet('/customers');
  const orders = await apiGet('/orders');
  const messages = await apiGet('/chat');
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const custOrders = orders.filter(o => o.customerId === id);
  const custMessages = messages.filter(m => m.customerId === id);
  const locUrl = c.location
    ? `https://www.google.com/maps?q=${c.location.lat},${c.location.lng}`
    : (c.address ? `https://www.google.com/maps?q=${encodeURIComponent(c.city + ', ' + c.address)}` : null);
  document.getElementById('customer-detail-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${c.name}</span></div>
      <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${c.phone}</span></div>
      <div class="detail-row"><span class="detail-label">City</span><span class="detail-value">${c.city}</span></div>
      <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${c.address}</span></div>
      <div class="detail-row"><span class="detail-label">Registered</span><span class="detail-value">${c.createdAt || 'N/A'}</span></div>
      <div class="detail-row"><span class="detail-label">Customer ID</span><span class="detail-value">${c.id}</span></div>
      ${locUrl ? `<div class="detail-row"><span class="detail-label">Location</span><span class="detail-value"><a href="${locUrl}" target="_blank">View on Maps</a></span></div>` : ''}
    </div>
    <div class="detail-section">
      <h4 style="margin:0 0 8px;font-size:14px;color:var(--text);">Orders (${custOrders.length})</h4>
      ${custOrders.length === 0 ? '<p class="empty-msg" style="margin:0;">No orders.</p>' : custOrders.map((o, i) => `
        <div class="detail-order-row${o.canceled ? ' canceled' : ''}">
          <span>#${i + 1} — ${o.items.map(item => item.name + ' x' + item.qty).join(', ')}</span>
          <span>${o.total} EGP ${o.canceled ? '🚫' : ''}</span>
        </div>
      `).join('')}
    </div>
    <div class="detail-section">
      <h4 style="margin:0 0 8px;font-size:14px;color:var(--text);">Messages (${custMessages.length})</h4>
      ${custMessages.length === 0 ? '<p class="empty-msg" style="margin:0;">No messages.</p>' : custMessages.map(m => `
        <div class="detail-msg-row">
          <span class="msg-from">${m.from === 'admin' ? 'Admin' : (m.name || 'Customer')}</span>
          <span class="msg-text">${m.text}</span>
          <span class="msg-time">${m.time}</span>
        </div>
      `).join('')}
    </div>
    <button class="btn btn-danger" style="width:100%;margin-top:12px;" onclick="deleteCustomerDetail(${c.id})">Delete Account &amp; Force Logout</button>
  `;
  document.getElementById('customer-detail-overlay').classList.add('open');
  document.getElementById('customer-detail-modal').classList.add('open');
}

async function deleteCustomerDetail(id) {
  if (!confirm('Delete this customer and all their data? The customer will be logged out immediately.')) return;
  await apiDelete('/customers/' + id);
  document.getElementById('customer-detail-overlay').classList.remove('open');
  document.getElementById('customer-detail-modal').classList.remove('open');
  showCustomers();
  loadUserCount();
  loadCustomerList();
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer and all their messages?')) return;
  await apiDelete('/customers/' + id);
  showCustomers();
  loadUserCount();
  loadCustomerList();
}

document.getElementById('users-stat-card')?.addEventListener('click', showCustomers);
document.getElementById('customers-modal-close')?.addEventListener('click', () => {
  document.getElementById('customers-modal-overlay').classList.remove('open');
  document.getElementById('customers-modal').classList.remove('open');
});
document.getElementById('customers-modal-overlay')?.addEventListener('click', () => {
  document.getElementById('customers-modal-overlay').classList.remove('open');
  document.getElementById('customers-modal').classList.remove('open');
});

document.getElementById('customer-detail-close')?.addEventListener('click', () => {
  document.getElementById('customer-detail-overlay').classList.remove('open');
  document.getElementById('customer-detail-modal').classList.remove('open');
});
document.getElementById('customer-detail-overlay')?.addEventListener('click', () => {
  document.getElementById('customer-detail-overlay').classList.remove('open');
  document.getElementById('customer-detail-modal').classList.remove('open');
});

if (sessionStorage.getItem('volt_admin') === 'true') {
  initApp();
}
