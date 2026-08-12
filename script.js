const CART_KEY = 'myeyes-cart';

const COLOR_STYLES = {
  gray: 'radial-gradient(circle at 35% 35%, #b8c4c8, #7a8589)',
  hazel: 'radial-gradient(circle at 35% 35%, #c4a882, #8b6f4a)',
  brown: 'radial-gradient(circle at 35% 35%, #a67c52, #6b4a2e)',
  blue: 'radial-gradient(circle at 35% 35%, #7eb8d4, #3a7a9e)',
  pink: 'radial-gradient(circle at 35% 35%, #e8a8b8, #c46b82)',
};

const BRANDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const DIAS = [14, 14.2, 14.5];
const COLORS = ['gray', 'hazel', 'brown', 'blue', 'pink'];

const PRODUCTS = generateProducts();

function generateProducts() {
  const products = [];
  let id = 1;

  BRANDS.forEach((brand) => {
    COLORS.forEach((color, colorIndex) => {
      const dia = DIAS[colorIndex % DIAS.length];
      products.push({
        id: id++,
        brand,
        name: `Brand ${brand} ${capitalize(color)}`,
        dia,
        color,
        price: 19.99 + colorIndex * 2,
        description: `1-day wear contact lenses with a 0.00 prescription. Soft, breathable design in a natural ${color} tone.`,
      });
    });
  });

  return products;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (!el) return;
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  el.textContent = count;
  el.style.display = count > 0 ? 'flex' : 'none';
}

function addToCart(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: product.id, quantity: 1 });
  }

  saveCart(cart);
  updateCartCount();
}

function removeFromCart(productId) {
  const cart = getCart().filter((item) => item.id !== productId);
  saveCart(cart);
  updateCartCount();
}

function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

function lensStyle(color) {
  return COLOR_STYLES[color] || COLOR_STYLES.gray;
}

function initShopPage() {
  updateCartCount();

  const filters = { brand: 'all', dia: 'all', color: 'all' };
  const grid = document.getElementById('productGrid');
  const resultsCount = document.getElementById('resultsCount');
  const noResults = document.getElementById('noResults');
  const overlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  let activeProduct = null;

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.filter;
      const value = btn.dataset.value;

      document.querySelectorAll(`[data-filter="${group}"]`).forEach((b) => {
        b.classList.toggle('active', b === btn);
      });

      filters[group] = value;
      renderProducts();
    });
  });

  function getFilteredProducts() {
    return PRODUCTS.filter((p) => {
      if (filters.brand !== 'all' && p.brand !== filters.brand) return false;
      if (filters.dia !== 'all' && p.dia !== parseFloat(filters.dia)) return false;
      if (filters.color !== 'all' && p.color !== filters.color) return false;
      return true;
    });
  }

  function renderProducts() {
    const filtered = getFilteredProducts();
    resultsCount.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
    noResults.classList.toggle('hidden', filtered.length > 0);

    grid.innerHTML = filtered.map((p) => `
      <article class="product-card" data-id="${p.id}">
        <div class="product-lens" style="background: ${lensStyle(p.color)}"></div>
        <h3>${p.name}</h3>
        <p class="product-meta">DIA ${p.dia} · ${capitalize(p.color)}</p>
        <p class="product-price">${formatPrice(p.price)}</p>
      </article>
    `).join('');

    grid.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => {
        const product = PRODUCTS.find((p) => p.id === parseInt(card.dataset.id, 10));
        if (product) openModal(product);
      });
    });
  }

  function openModal(product) {
    activeProduct = product;
    document.getElementById('modalLens').style.background = lensStyle(product.color);
    document.getElementById('modalBrand').textContent = `Brand ${product.brand}`;
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalSpecs').innerHTML = `
      <li>1-Day Wear</li>
      <li>0.00 Rx</li>
      <li>DIA ${product.dia}</li>
      <li>${capitalize(product.color)}</li>
    `;
    document.getElementById('modalDesc').textContent = product.description;
    document.getElementById('modalPrice').textContent = formatPrice(product.price);
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    activeProduct = null;
  }

  modalClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.getElementById('modalAddToCart').addEventListener('click', () => {
    if (activeProduct) {
      addToCart(activeProduct.id);
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closeModal();
    }
  });

  renderProducts();
}

function initCartPage() {
  updateCartCount();

  const cartEmpty = document.getElementById('cartEmpty');
  const cartContent = document.getElementById('cartContent');
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  function renderCart() {
    const cart = getCart();

    if (cart.length === 0) {
      cartEmpty.classList.remove('hidden');
      cartContent.classList.add('hidden');
      return;
    }

    cartEmpty.classList.add('hidden');
    cartContent.classList.remove('hidden');

    let total = 0;

    cartItems.innerHTML = cart.map((item) => {
      const product = PRODUCTS.find((p) => p.id === item.id);
      if (!product) return '';
      const lineTotal = product.price * item.quantity;
      total += lineTotal;

      return `
        <li class="cart-item">
          <div class="cart-item-lens" style="background: ${lensStyle(product.color)}"></div>
          <div class="cart-item-info">
            <h3>${product.name}</h3>
            <p>Brand ${product.brand} · DIA ${product.dia} · Qty ${item.quantity}</p>
          </div>
          <span class="cart-item-price">${formatPrice(lineTotal)}</span>
          <button class="cart-item-remove" data-id="${product.id}" aria-label="Remove">&times;</button>
        </li>
      `;
    }).join('');

    cartTotal.textContent = formatPrice(total);

    cartItems.querySelectorAll('.cart-item-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeFromCart(parseInt(btn.dataset.id, 10));
        renderCart();
      });
    });
  }

  document.getElementById('checkoutBtn').addEventListener('click', () => {
    alert('Checkout coming soon!');
  });

  renderCart();
}
