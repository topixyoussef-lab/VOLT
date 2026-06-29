

// ====== SMART FEATURES ======
// Sound effects using Web Audio API
function playTone(freq, duration, type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

const sounds = {
  add:       () => { playTone(880, 0.15); setTimeout(() => playTone(1100, 0.1), 80); },
  remove:    () => { playTone(400, 0.12); setTimeout(() => playTone(300, 0.1), 60); },
  order:     () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 100); setTimeout(() => playTone(784, 0.15), 200); },
  chat:      () => { playTone(660, 0.1); setTimeout(() => playTone(880, 0.08), 60); },
  cancel:    () => { playTone(300, 0.2); setTimeout(() => playTone(200, 0.2), 100); },
  notify:    () => { playTone(880, 0.08); setTimeout(() => playTone(1100, 0.08), 80); setTimeout(() => playTone(880, 0.08), 160); },
};

// Toast notifications
function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'info');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 3000);
  if (type === 'add') sounds.add();
  else if (type === 'remove') sounds.remove();
  else if (type === 'order') { sounds.order(); }
  else if (type === 'chat') sounds.chat();
  else if (type === 'cancel') sounds.cancel();
  else if (type === 'notify') sounds.notify();
}



// ====== OFFERS ======
let activeOffers = [];

async function loadOffers() {
  try {
    const res = await fetch('/api/offers');
    const offers = await res.json();
    activeOffers = offers.filter(o => o.active);
    renderPromoBanner();
  } catch {}
}

function renderPromoBanner() {
  const banner = document.querySelector('.promo-banner');
  if (!banner) return;
  const active = activeOffers.filter(o => o.active);
  if (active.length === 0) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';
  const container = banner.querySelector('.container');
  container.innerHTML = active.map(o =>
    `<span class="promo-icon">&#127873;</span><span><strong>${o.title}:</strong> ${o.desc}</span>`
  ).join('<span style="margin:0 12px;opacity:0.3">|</span>');
}

// ====== THEME TOGGLE ======
const savedTheme = localStorage.getItem('volt_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('volt_theme', next);
});

// ====== CUSTOMER DATA ======
let customerId = sessionStorage.getItem('volt_customer_id');
let customerData = null;
let customerReady = false;

// Try to restore customerData from sessionStorage cache
try {
  const cached = sessionStorage.getItem('volt_customer_data');
  if (cached) customerData = JSON.parse(cached);
} catch {}

function updateHeaderButtons() {
  const rb = document.getElementById('register-btn');
  const pb = document.getElementById('profile-btn');
  if (!rb || !pb) return;
  if (customerData) {
    rb.classList.add('hidden');
    pb.classList.remove('hidden');
  } else {
    rb.classList.remove('hidden');
    pb.classList.add('hidden');
  }
}

async function loadCustomer() {
  if (!customerId) return false;
  try {
    const res = await fetch('/api/customer/' + customerId);
    if (res.ok) {
      customerData = await res.json();
      sessionStorage.setItem('volt_customer_data', JSON.stringify(customerData));
      customerReady = true;
      updateHeaderButtons();
      return true;
    }
  } catch {}
  // Fallback: use cached data if API fails (different Vercel instance)
  if (customerData) { customerReady = true; updateHeaderButtons(); return true; }
  clearCustomer();
  return false;
}

function clearCustomer() {
  customerId = null;
  customerData = null;
  customerReady = false;
  sessionStorage.removeItem('volt_customer_id');
  sessionStorage.removeItem('volt_customer_data');
  updateHeaderButtons();
  const ro = document.getElementById('reg-overlay');
  if (ro) ro.style.display = 'flex';
}

// Init: try to load existing customer, never auto-show registration
;(async () => {
  updateHeaderButtons();
  if (customerId) await loadCustomer();
})();

// ====== REGISTRATION ======
document.getElementById('reg-close')?.addEventListener('click', () => {
  document.getElementById('reg-overlay').style.display = 'none';
});
document.getElementById('register-btn')?.addEventListener('click', () => openRegister());

function openRegister() {
  document.getElementById('reg-overlay').style.display = 'flex';
}

document.getElementById('reg-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const city = document.getElementById('reg-city').value.trim();
  const address = document.getElementById('reg-address').value.trim();
  if (!name || !phone || !city || !address) return;

  let location = null;
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true })
      );
      location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {}
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, city, address, location })
    });
    const data = await res.json();
    if (!data.success) { showToast('Registration failed', 'error'); return; }
    customerData = data.customer;
    customerId = data.customer.id;
    sessionStorage.setItem('volt_customer_id', customerId);
    sessionStorage.setItem('volt_customer_data', JSON.stringify(customerData));
    updateHeaderButtons();
    document.getElementById('reg-overlay').style.display = 'none';
  } catch {
    showToast('Connection error', 'error');
  }
});

// ====== PROFILE ======
const profileBtn = document.getElementById('profile-btn');
const profileOverlay = document.getElementById('profile-overlay');
const profileModal = document.getElementById('profile-modal');
const profileClose = document.getElementById('profile-close');
const profileForm = document.getElementById('profile-form');

profileBtn?.addEventListener('click', () => {
  if (!customerData) { showToast('Register first to access profile', 'info'); return; }
  document.getElementById('prof-name').value = customerData.name || '';
  document.getElementById('prof-phone').value = customerData.phone || '';
  document.getElementById('prof-city').value = customerData.city || '';
  document.getElementById('prof-address').value = customerData.address || '';
  profileOverlay.classList.add('open');
  profileModal.classList.add('open');
});

profileClose?.addEventListener('click', () => {
  profileOverlay.classList.remove('open');
  profileModal.classList.remove('open');
});
profileOverlay?.addEventListener('click', () => {
  profileOverlay.classList.remove('open');
  profileModal.classList.remove('open');
});

profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('prof-name').value.trim();
  const phone = document.getElementById('prof-phone').value.trim();
  const city = document.getElementById('prof-city').value.trim();
  const address = document.getElementById('prof-address').value.trim();
  if (!name || !phone || !city || !address || !customerId) return;
  try {
    const res = await fetch('/api/customer/' + customerId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, city, address })
    });
    if (res.status === 404) {
      // Vercel multi-instance: save locally in sessionStorage
      customerData = { ...customerData, name, phone, city, address } || { id: customerId, name, phone, city, address, location: null, createdAt: '' };
      sessionStorage.setItem('volt_customer_data', JSON.stringify(customerData));
      showToast('Profile saved locally', 'success');
      profileOverlay.classList.remove('open');
      profileModal.classList.remove('open');
      return;
    }
    const data = await res.json();
    if (!data.success) { showToast('Save failed', 'error'); return; }
    customerData = data.customer;
    sessionStorage.setItem('volt_customer_data', JSON.stringify(customerData));
    updateHeaderButtons();
    profileOverlay.classList.remove('open');
    profileModal.classList.remove('open');
  } catch {
    showToast('Connection error', 'error');
  }
});

// Hamburger
document.querySelector('.hamburger')?.addEventListener('click', () => {
  document.querySelector('.nav')?.classList.toggle('open');
});

// ====== PRODUCTS ======
let products = [];
let currentProduct = null;
let selectedSize = null;

function showSkeleton() { const s = document.getElementById('skeleton-grid'); if (s) s.style.display = 'grid'; }
function hideSkeleton() { const s = document.getElementById('skeleton-grid'); if (s) s.style.display = 'none'; }

async function loadProducts() {
  showSkeleton();
  try {
    const res = await fetch('/api/products');
    products = await res.json();
    buildSearchTerms();
    renderGrid();
  } catch {
    products = [];
    renderGrid();
  }
  hideSkeleton();
}

const gridSection = document.getElementById('product-grid-section');
const productPage = document.getElementById('product-page');
const grid = document.getElementById('product-grid');
const backBtn = document.getElementById('btn-back');
const galleryMain = document.getElementById('gallery-main');
const galleryThumbs = document.getElementById('gallery-thumbs');
const detailName = document.getElementById('detail-name');
const detailPrice = document.getElementById('detail-price');
const detailOriginal = document.getElementById('detail-original');
const detailMaterial = document.getElementById('detail-material');
const detailColors = document.getElementById('detail-colors');
const detailSizes = document.getElementById('detail-sizes');
const addBtn = document.getElementById('add-to-cart');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartItems = document.getElementById('cart-items');
const cartFooter = document.getElementById('cart-footer');
const cartTotalPrice = document.getElementById('cart-total-price');
const cartCount = document.getElementById('cart-count');
const modalOverlay = document.getElementById('modal-overlay');
const orderModal = document.getElementById('order-modal');
const orderForm = document.getElementById('order-form');

let searchQuery = '';
let searchTerms = [];

function buildSearchTerms() {
  const set = new Set();
  products.forEach(p => {
    set.add(p.name);
    if (p.colors) p.colors.split('/').forEach(c => set.add(c.trim()));
    if (p.material) set.add(p.material);
  });
  Object.entries(searchDict).forEach(([ar, en]) => { set.add(ar); set.add(en); });
  set.add('classic Solid'); set.add('Premium Soft Summer Milton');
  searchTerms = Array.from(set);
}

const searchDict = {
  'اسود': 'black', 'ابيض': 'white', 'فضي': 'silver', 'ذهبي': 'gold',
  'احمر': 'red', 'ازرق': 'blue', 'اخضر': 'green', 'اصفر': 'yellow',
  'بنفسجي': 'purple', 'برتقالي': 'orange', 'بني': 'brown', 'بيج': 'beige',
  'رمادي': 'gray', 'grey': 'gray', 'وردي': 'pink', 'سيلفر': 'silver',
  'بنطلون': 'pants', 'تيشرت': 'shirt', 'تي شيرت': 'shirt', 'tshirt': 'shirt',
  'جاكيت': 'jacket', 'كوتشي': 'shoes', 'شراب': 'socks', 'قبعة': 'hat',
  'كاب': 'cap', 'فساتين': 'dress', 'over': 'wide leg',
  'narrow': 'wide leg', 'baggy': 'wide leg', 'loose': 'wide leg',
  'mint': 'mint green', 'sage': 'sage green', 'nude': 'beige',
  'مارسيليا': 'marseilia', 'ليكرا': 'lycra', 'قطن': 'cotton',
  'ميلتون': 'milton', 'صيفي': 'summer', 'شتوي': 'winter',
};

function smartMatch(text, query) {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  const translated = searchDict[q];
  if (translated && t.includes(translated)) return true;
  for (const [ar, en] of Object.entries(searchDict)) {
    if (q.includes(ar) && t.includes(en)) return true;
    if (q.includes(en) && t.includes(ar)) return true;
  }
  return false;
}

const searchInput = document.getElementById('search-input');
let suggestionsEl = null;

function posSuggestions() {
  if (!suggestionsEl || !searchInput) return;
  const rect = searchInput.getBoundingClientRect();
  suggestionsEl.style.position = 'fixed';
  suggestionsEl.style.top = (rect.bottom + 4) + 'px';
  suggestionsEl.style.left = rect.left + 'px';
  suggestionsEl.style.width = rect.width + 'px';
}

function suggestionMatch(p, query) {
  const q = query.toLowerCase();
  if (smartMatch(p.name, q) || smartMatch(p.colors || '', q) || smartMatch(p.material || '', q))
    return true;
  for (const [ar, en] of Object.entries(searchDict)) {
    if (ar.includes(q) && (p.name.toLowerCase().includes(en) || (p.colors && p.colors.toLowerCase().includes(en))))
      return true;
  }
  return false;
}

function showSuggestions(query) {
  if (!suggestionsEl) {
    suggestionsEl = document.createElement('div');
    suggestionsEl.className = 'search-suggestions';
    document.body.appendChild(suggestionsEl);
  }
  if (!query) { suggestionsEl.innerHTML = ''; suggestionsEl.style.display = 'none'; return; }
  const q = query.toLowerCase();
  const matches = products.filter(p => {
    if (p.available === false) return false;
    return suggestionMatch(p, q);
  }).slice(0, 5);
  if (matches.length === 0) { suggestionsEl.style.display = 'none'; return; }
  suggestionsEl.style.display = 'block';
  posSuggestions();
  suggestionsEl.innerHTML = matches.map(p =>
    `<div class="suggestion-product" onclick="selectSuggestion(${p.id})">
      <div class="suggestion-img" style="background-image: url('${p.images[0] || ''}');"></div>
      <div class="suggestion-info">
        <div class="suggestion-name">${highlightMatch(p.name + ' - ' + p.colors, query)}</div>
        <div class="suggestion-price">${p.price} EGP${p.originalPrice ? ' <s>' + p.originalPrice + '</s>' : ''}</div>
      </div>
    </div>`
  ).join('');
}

function selectSuggestion(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  suggestionsEl.style.display = 'none';
  searchInput.value = searchInput.value.trim();
  searchQuery = searchInput.value.trim();
  renderGrid();
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) + '<strong>' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
}

searchInput?.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  showSuggestions(searchQuery);
  renderGrid();
});

searchInput?.addEventListener('blur', () => {
  setTimeout(() => { if (suggestionsEl) suggestionsEl.style.display = 'none'; }, 200);
});

searchInput?.addEventListener('focus', () => {
  if (searchInput.value.trim()) showSuggestions(searchInput.value.trim());
});

window.addEventListener('scroll', () => { if (suggestionsEl?.style.display === 'block') posSuggestions(); });
window.addEventListener('resize', () => { if (suggestionsEl?.style.display === 'block') posSuggestions(); });

function renderGrid() {
  const filtered = products.filter(p => {
    if (!searchQuery) return true;
    return smartMatch(p.name, searchQuery)
      || smartMatch(p.colors || '', searchQuery)
      || smartMatch(p.material || '', searchQuery);
  });
  grid.innerHTML = filtered.map(p => {
    const unavail = p.available === false;
    const offer = activeOffers.find(o => o.active && (!o.product || o.product === p.name));
    const badge = unavail ? '<span class="offer-badge badge-unavail">Unavailable</span>' : (offer ? `<span class="offer-badge">${offer.title}</span>` : '');
    return `<div class="grid-card${unavail ? ' card-unavail' : ''}" onclick="${unavail ? '' : 'showProduct(' + p.id + ')'}">
      <div class="grid-card-img" style="background-image: url('${p.images[0] || ''}');">${badge}</div>
      <div class="grid-card-info">
        <h3>${p.name}</h3>
        <span class="grid-price">${p.price} EGP</span>
        ${p.originalPrice ? `<span class="grid-original">${p.originalPrice} EGP</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function showProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  currentProduct = p;
  selectedSize = null;
  gridSection.style.display = 'none';
  productPage.style.display = 'block';
  detailName.textContent = p.name;
  detailPrice.textContent = `${p.price} EGP`;
  detailOriginal.textContent = p.originalPrice ? `${p.originalPrice} EGP` : '';
  detailOriginal.style.display = p.originalPrice ? '' : 'none';
  detailMaterial.textContent = p.material || '—';
  detailColors.textContent = p.colors || '—';
  renderSimilar(p);
  detailSizes.innerHTML = p.sizes.map(s =>
    `<span class="size-box" data-size="${s}">${s}</span>`
  ).join('');
  document.querySelectorAll('.size-box').forEach(box => {
    box.addEventListener('click', () => {
      document.querySelectorAll('.size-box').forEach(b => b.classList.remove('selected'));
      box.classList.add('selected');
      selectedSize = box.dataset.size;
    });
  });
  galleryMain.style.backgroundImage = `url('${p.images[0] || ''}')`;
  galleryMain.classList.remove('zoom');
  galleryMain.style.backgroundPosition = 'center';
  galleryThumbs.innerHTML = p.images.map((img, i) =>
    `<div class="thumb ${i === 0 ? 'active' : ''}" style="background-image: url('${img}');" data-img="${img}"></div>`
  ).join('');
  document.querySelectorAll('.thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      galleryMain.style.backgroundImage = `url('${thumb.dataset.img}')`;
      galleryMain.classList.remove('zoom');
      galleryMain.style.backgroundPosition = 'center';
    });
  });
}

backBtn?.addEventListener('click', () => {
  productPage.style.display = 'none';
  gridSection.style.display = 'block';
  currentProduct = null;
  selectedSize = null;
  loadProducts();
});

document.getElementById('nav-home')?.addEventListener('click', (e) => {
  e.preventDefault();
  productPage.style.display = 'none';
  gridSection.style.display = 'block';
});

function renderSimilar(current) {
  const similar = products.filter(p => p.id !== current.id && p.name === current.name && p.available !== false);
  const el = document.getElementById('similar-grid');
  if (similar.length === 0) { el.closest('.similar-section').style.display = 'none'; return; }
  el.closest('.similar-section').style.display = 'block';
  el.innerHTML = similar.map(p => `
    <div class="grid-card" onclick="showProduct(${p.id})">
      <div class="grid-card-img" style="background-image: url('${p.images[0] || ''}');"></div>
      <div class="grid-card-info">
        <h3>${p.colors}</h3>
        <span class="grid-price">${p.price} EGP</span>
        ${p.originalPrice ? `<span class="grid-original">${p.originalPrice} EGP</span>` : ''}
      </div>
    </div>
  `).join('');
}

// Zoom
galleryMain?.addEventListener('mouseenter', () => galleryMain.classList.add('zoom'));
galleryMain?.addEventListener('mouseleave', () => {
  galleryMain.classList.remove('zoom');
  galleryMain.style.backgroundPosition = 'center';
});
galleryMain?.addEventListener('mousemove', (e) => {
  const rect = galleryMain.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  galleryMain.style.backgroundPosition = `${x}% ${y}%`;
});

// ====== CART ======
let cart = JSON.parse(localStorage.getItem('volt_cart') || '[]');
let myOrders = JSON.parse(localStorage.getItem('volt_orders') || '[]');
renderCart();

addBtn?.addEventListener('click', () => {
  if (!currentProduct) return;
  if (!selectedSize) { showToast('Please select a size first.', 'info'); return; }
  const existing = cart.find(item => item.id === currentProduct.id && item.size === selectedSize);
  if (existing) existing.qty++;
  else cart.push({ id: currentProduct.id, name: currentProduct.name, price: currentProduct.price, size: selectedSize, image: currentProduct.images[0], qty: 1 });
  selectedSize = null;
  showToast('Added to cart!', 'add');
  document.querySelectorAll('.size-box').forEach(b => b.classList.remove('selected'));
  saveCart();
  renderCart();
  openCart();
});

function saveCart() { localStorage.setItem('volt_cart', JSON.stringify(cart)); }

function renderCart() {
  let html = '', total = 0, totalQty = 0;

  // Active orders (on the way)
  if (myOrders.length > 0) {
    html += '<div class="cart-section-title">Orders on the way</div>';
    myOrders.forEach((order, i) => {
      if (order.canceled) return;
      html += `
        <div class="cart-order-track">
          <div class="order-track-header">
            <span class="order-track-id">Order #${order.id}</span>
            <span class="order-track-status">On the way</span>
          </div>
          <div class="order-track-items">${order.items.map(item => item.name + ' x' + item.qty).join(', ')}</div>
          <div class="order-track-total">${order.total} EGP</div>
          <button class="btn btn-outline btn-sm" onclick="cancelOrder(${order.id})">Cancel Order</button>
        </div>`;
    });
  }

  // Cart items
  if (cart.length === 0 && myOrders.filter(o => !o.canceled).length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    cartFooter.style.display = 'none';
    cartCount.textContent = '0';
    return;
  }

  if (cart.length > 0) {
    html += '<div class="cart-section-title">Cart</div>';
    const productQtys = {};
    const productPrices = {};
    cart.forEach((item, i) => {
      total += item.price * item.qty;
      totalQty += item.qty;
      const key = item.name;
      productQtys[key] = (productQtys[key] || 0) + item.qty;
      if (!productPrices[key]) productPrices[key] = [];
      for (let j = 0; j < item.qty; j++) productPrices[key].push(item.price);
      html += `
        <div class="cart-item">
          <button class="cart-item-del" onclick="removeItem(${i})">&times;</button>
          <div class="cart-item-img" style="background-image: url('${item.image}');"></div>
          <div class="cart-item-info">
            <h4>${item.name}</h4>
            <p>Size: ${item.size}</p>
            <p class="item-price">${item.price} EGP</p>
            <div class="cart-item-qty">
              <button onclick="changeQty(${i}, -1)">-</button>
              <span>${item.qty}</span>
              <button onclick="changeQty(${i}, 1)">+</button>
            </div>
          </div>
        </div>`;
    });
    let discount = 0;
    let discountLabel = '';
    activeOffers.forEach(offer => {
      const pName = offer.product;
      const qty = pName ? (productQtys[pName] || 0) : totalQty;
      if (qty >= offer.buy) {
        const prices = pName ? (productPrices[pName] || []) : Object.values(productPrices).flat();
        prices.sort((a, b) => a - b);
        const freeCount = Math.floor(qty / offer.buy) * offer.free;
        for (let k = 0; k < freeCount && k < prices.length; k++) discount += prices[k];
        discountLabel = offer.title;
      }
    });
    const finalTotal = total - discount;
    html += discount > 0
      ? `<div class="promo-discount"><span>&#127873; ${discountLabel}</span><span>-${discount} EGP</span></div>`
      : '';
    cartFooter.style.display = 'block';
    cartTotalPrice.textContent = `${finalTotal} EGP`;
    cartCount.textContent = totalQty;
  }
  cartItems.innerHTML = html;
}

function changeQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  saveCart();
  renderCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
  showToast('Item removed', 'remove');
}

async function cancelOrder(orderId) {
  if (!confirm('Cancel this order?')) return;
  try {
    const res = await fetch('/api/orders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId })
    });
    const result = await res.json();
    if (!result.success) { showToast('Cancel failed', 'error'); return; }
  } catch { showToast('Connection error', 'error'); return; }
  const order = myOrders.find(o => o.id === orderId);
  if (order) order.canceled = true;
  localStorage.setItem('volt_orders', JSON.stringify(myOrders));
  renderCart();
  showToast('Order canceled.', 'cancel');
}

function openCart() { cartOverlay.classList.add('open'); cartSidebar.classList.add('open'); }
function closeCart() { cartOverlay.classList.remove('open'); cartSidebar.classList.remove('open'); }

document.querySelector('.cart-btn')?.addEventListener('click', openCart);
document.getElementById('cart-close')?.addEventListener('click', closeCart);
cartOverlay?.addEventListener('click', closeCart);

// Checkout
document.getElementById('checkout-btn')?.addEventListener('click', () => {
  if (cart.length === 0) return;
  if (!customerData) { showToast('Please create a profile first.', 'info'); openRegister(); return; }
  document.getElementById('cust-name').value = customerData.name || '';
  document.getElementById('cust-city').value = customerData.city || '';
  document.getElementById('cust-address').value = customerData.address || '';
  document.getElementById('cust-phone').value = customerData.phone || '';
  modalOverlay.classList.add('open');
  orderModal.classList.add('open');
});

function closeModal() { modalOverlay.classList.remove('open'); orderModal.classList.remove('open'); }
document.getElementById('modal-close')?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', closeModal);

function getLocation(callback) {
  if (!navigator.geolocation) { callback(null); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => callback({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => callback(null),
    { timeout: 5000, enableHighAccuracy: true }
  );
}

orderForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!customerId) {
    showToast('Please register first to place an order', 'error');
    openRegister();
    return;
  }
  const name = document.getElementById('cust-name').value.trim();
  const city = document.getElementById('cust-city').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  if (!name || !city || !address || !phone) return;
  getLocation(async (loc) => {
    const order = {
      name, city, address, phone,
      customerId: customerId,
      location: loc || null,
      items: cart.map(item => ({ name: item.name, size: item.size, price: item.price, qty: item.qty })),
      total: cart.reduce((sum, item) => sum + item.price * item.qty, 0)
    };
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      const result = await res.json();
      if (!result.success) { showToast('Order failed', 'error'); return; }
      const orderData = { ...order, id: result.id, date: new Date().toLocaleString('en-GB'), canceled: false };
      myOrders.unshift(orderData);
      localStorage.setItem('volt_orders', JSON.stringify(myOrders));
    } catch { showToast('Connection error', 'error'); return; }
    cart = [];
    saveCart();
    renderCart();
    closeModal();
    closeCart();
    orderForm.reset();
    showToast('Order placed! Your items are on the way. You can cancel anytime.', 'order');
  });
});

// ====== CHAT WIDGET ======
const chatToggle = document.getElementById('chat-toggle');
const chatWidget = document.getElementById('chat-widget');
const chatClose = document.getElementById('chat-close-btn');
const chatInput = document.getElementById('chat-widget-input');
const chatSend = document.getElementById('chat-widget-send');
const chatMessages = document.getElementById('chat-widget-messages');

let chatLastId = 0;

chatToggle?.addEventListener('click', () => {
  chatWidget.classList.toggle('open');
  if (chatWidget.classList.contains('open')) loadChat();
});
chatClose?.addEventListener('click', () => chatWidget.classList.remove('open'));

async function loadChat() {
  if (!customerId) return;
  try {
    const res = await fetch(`/api/chat?customerId=${customerId}&since=${chatLastId}`);
    const msgs = await res.json();
    if (msgs.length === 0) return;
    msgs.forEach(m => {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + m.from;
      div.innerHTML = `${m.text}<span class="msg-time">${m.time}</span>`;
      chatMessages.appendChild(div);
      chatLastId = m.id;
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch {}
}

async function sendChatMsg() {
  if (!customerId || !customerData) { showToast('Please create your profile first.', 'info'); return; }
  const text = chatInput.value.trim();
  if (!text) return;
  try {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, name: customerData.name, text })
    });
    const div = document.createElement('div');
    div.className = 'chat-msg customer';
    div.innerHTML = `${text}<span class="msg-time">Just now</span>`;
    chatMessages.appendChild(div);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    showToast('Message sent!', 'chat');
  } catch {}
}

chatSend?.addEventListener('click', sendChatMsg);
chatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMsg(); });

setInterval(() => {
  if (chatWidget.classList.contains('open')) loadChat();
}, 3000);

// ====== INIT ======
loadProducts();
loadOffers();
