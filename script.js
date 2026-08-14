const CART_KEY = 'myeyes-cart';

const COLOR_STYLES = {
  gray: 'radial-gradient(circle at 35% 35%, #b8c4c8, #7a8589)',
  hazel: 'radial-gradient(circle at 35% 35%, #c4a882, #8b6f4a)',
  brown: 'radial-gradient(circle at 35% 35%, #a67c52, #6b4a2e)',
  blue: 'radial-gradient(circle at 35% 35%, #7eb8d4, #3a7a9e)',
  pink: 'radial-gradient(circle at 35% 35%, #e8a8b8, #c46b82)',
};

const FILTER_LABELS = {
  brand: 'Brand',
  dia: 'DIA',
  gdia: 'GDIA',
  color: 'Color',
  special: 'Special',
};

const GDIA_RANGES = [
  { value: '12.5-13', label: '12.5 – 13', min: 12.5, max: 13 },
  { value: '13-13.5', label: '13 – 13.5', min: 13, max: 13.5 },
  { value: '13.5-14', label: '13.5 – 14', min: 13.5, max: 14 },
  { value: '14-15', label: '14 – 15', min: 14, max: 15 },
];

const FILTER_LAYOUT = {
  dia: 'pairs',
  gdia: 'pairs',
  color: 'pairs',
  special: 'stack',
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatFilterLabel(value) {
  if (value === 'axis-lock') return 'Axis-Lock';
  return capitalize(value);
}

function formatSpecValue(value) {
  return typeof value === 'number' ? String(value) : value;
}

function productDescription(product) {
  const axisNote = product.axisLock
    ? 'Axis-Lock technology helps keep lenses stable and comfortable all day.'
    : 'Soft, breathable 1-day design.';
  return `1-day wear contact lenses with a 0.00 prescription. ${axisNote}`;
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

function matchesGdiaRange(gdia, rangeValue) {
  const range = GDIA_RANGES.find((r) => r.value === rangeValue);
  if (!range) return true;
  return gdia >= range.min && gdia < range.max;
}

function buildBrandDropdownMarkup() {
  const brandOptions = FILTER_OPTIONS.brand.map((brand) => `
    <button type="button" class="brand-dropdown-option" role="option" data-value="${brand}">${brand}</button>
  `).join('');

  return `
    <div class="filter-group" data-filter-group="brand">
      <h3>${FILTER_LABELS.brand}</h3>
      <div class="brand-dropdown" id="brandDropdown">
        <button
          type="button"
          class="brand-dropdown-trigger"
          id="brandDropdownTrigger"
          aria-expanded="false"
          aria-haspopup="listbox"
          aria-controls="brandDropdownMenu"
        >
          <span class="brand-dropdown-label">All brands</span>
          <span class="brand-dropdown-chevron" aria-hidden="true"></span>
        </button>
        <div class="brand-dropdown-menu" id="brandDropdownMenu" role="listbox" aria-label="Brand">
          <button
            type="button"
            class="brand-dropdown-option is-selected"
            role="option"
            data-value="all"
          >All brands</button>
          ${brandOptions}
        </div>
      </div>
    </div>
  `;
}

function scrollToProducts() {
  const productsArea = document.querySelector('.products-area');
  if (!productsArea) return;

  const header = document.querySelector('.header');
  const offset = (header?.offsetHeight ?? 0) + 16;
  const top = productsArea.getBoundingClientRect().top + window.scrollY - offset;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

function initBrandDropdown(filters, onChange) {
  const dropdown = document.getElementById('brandDropdown');
  const trigger = document.getElementById('brandDropdownTrigger');
  const menu = document.getElementById('brandDropdownMenu');
  const label = trigger?.querySelector('.brand-dropdown-label');
  if (!dropdown || !trigger || !menu || !label) return null;

  const options = menu.querySelectorAll('.brand-dropdown-option');

  function setOpen(open) {
    dropdown.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  }

  function updateSelection(value) {
    options.forEach((option) => {
      const isSelected = option.dataset.value === value;
      option.classList.toggle('is-selected', isSelected);
      option.setAttribute('aria-selected', String(isSelected));
    });

    label.textContent = value === 'all' ? 'All brands' : value;
    trigger.classList.toggle('has-selection', value !== 'all');
  }

  trigger.addEventListener('click', () => {
    setOpen(!dropdown.classList.contains('is-open'));
  });

  options.forEach((option) => {
    option.addEventListener('click', () => {
      const value = option.dataset.value;
      filters.brand = value;
      updateSelection(value);
      setOpen(false);
      onChange();
      if (value !== 'all') {
        scrollToProducts();
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target)) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dropdown.classList.contains('is-open')) {
      setOpen(false);
      trigger.focus();
    }
  });

  updateSelection(filters.brand);

  return {
    reset: () => {
      filters.brand = 'all';
      updateSelection('all');
      setOpen(false);
    },
  };
}

function buildFilterGroups() {
  const container = document.getElementById('filterGroups');
  if (!container) return;

  const groups = [
    { key: 'dia', options: FILTER_OPTIONS.dia },
    { key: 'gdia', options: GDIA_RANGES, isGdia: true },
    { key: 'color', options: FILTER_OPTIONS.color },
    { key: 'special', options: [{ value: 'axis-lock', label: 'Axis-Lock' }], special: true },
  ];

  const otherGroups = groups.map((group) => {
    const layout = FILTER_LAYOUT[group.key] || 'stack';
    const buttons = group.options.map((option) => {
      if (group.isGdia) {
        return `<button class="filter-btn" data-filter="${group.key}" data-value="${option.value}">${option.label}</button>`;
      }

      const value = group.special ? option.value : String(option);
      const label = group.special ? option.label : formatFilterLabel(value);
      return `<button class="filter-btn" data-filter="${group.key}" data-value="${value}">${label}</button>`;
    }).join('');

    const specialClass = group.special ? ' filter-group-special' : '';
    return `
      <div class="filter-group${specialClass}" data-filter-group="${group.key}">
        <h3>${FILTER_LABELS[group.key]}</h3>
        <div class="filter-options filter-options--${layout}">
          <button class="filter-btn filter-btn--all active" data-filter="${group.key}" data-value="all">All</button>
          ${buttons}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = buildBrandDropdownMarkup() + otherGroups;
}

const WAVE_LETTER_STAGGER = 0.14;
const WAVE_LETTER_DURATION = 0.75;

let welcomeWaveTimer = null;

function initWelcomeLetterSplit() {
  let letterIndex = 0;

  document.querySelectorAll('.welcome-highlight').forEach((phrase) => {
    const text = phrase.textContent;
    phrase.textContent = '';
    phrase.setAttribute('aria-label', text);

    [...text].forEach((char) => {
      const letter = document.createElement('span');
      letter.className = 'welcome-letter';
      letter.textContent = char === ' ' ? '\u00A0' : char;
      letter.style.setProperty('--wave-delay', `${letterIndex * WAVE_LETTER_STAGGER}s`);
      letterIndex += 1;
      phrase.appendChild(letter);
    });
  });
}

function playWelcomeWave() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const note = document.querySelector('.welcome-note');
  if (!note) return;

  note.classList.remove('is-wave');
  void note.offsetWidth;
  note.classList.add('is-wave');

  const letters = note.querySelectorAll('.welcome-letter');
  let maxDelay = 0;
  letters.forEach((letter) => {
    const delay = parseFloat(letter.style.getPropertyValue('--wave-delay')) || 0;
    if (delay > maxDelay) maxDelay = delay;
  });

  clearTimeout(welcomeWaveTimer);
  welcomeWaveTimer = setTimeout(() => {
    note.classList.remove('is-wave');
  }, (maxDelay + WAVE_LETTER_DURATION) * 1000 + 80);
}

function initWelcomeWaveObserver() {
  const note = document.querySelector('.welcome-note');
  if (!note) return;

  let wasVisible = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !wasVisible) {
        playWelcomeWave();
      }
      wasVisible = entry.isIntersecting;
    });
  }, { threshold: 0.45 });

  observer.observe(note);
}

function initShopPage() {
  updateCartCount();
  initWelcomeLetterSplit();
  initWelcomeWaveObserver();

  const filters = {
    brand: 'all',
    dia: 'all',
    gdia: 'all',
    color: 'all',
    special: 'all',
  };
  const grid = document.getElementById('productGrid');
  const resultsCount = document.getElementById('resultsCount');
  const noResults = document.getElementById('noResults');
  const overlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  let activeProduct = null;

  function getFilteredProducts() {
    return PRODUCTS.filter((p) => {
      if (filters.brand !== 'all' && p.brand !== filters.brand) return false;
      if (filters.dia !== 'all' && p.dia !== parseFloat(filters.dia)) return false;
      if (filters.gdia !== 'all' && !matchesGdiaRange(p.gdia, filters.gdia)) return false;
      if (filters.color !== 'all' && p.color !== filters.color) return false;
      if (filters.special === 'axis-lock' && !p.axisLock) return false;
      return true;
    });
  }

  function productMeta(product) {
    const parts = [
      `DIA ${product.dia}`,
      `GDIA ${product.gdia}`,
      capitalize(product.color),
    ];
    if (product.axisLock) parts.push('Axis-Lock');
    return parts.join(' · ');
  }

  function renderProducts() {
    const filtered = getFilteredProducts();
    resultsCount.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
    noResults.classList.toggle('hidden', filtered.length > 0);

    grid.innerHTML = filtered.map((p) => `
      <article class="product-card" data-id="${p.id}">
        <div class="product-lens" style="background: ${lensStyle(p.color)}"></div>
        <p class="product-brand">${p.brand}</p>
        <h3>${p.name}</h3>
        <p class="product-meta">${productMeta(p)}</p>
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

  buildFilterGroups();
  const brandDropdown = initBrandDropdown(filters, () => {
    renderProducts();
    playWelcomeWave();
  });

  document.getElementById('resetFilters')?.addEventListener('click', () => {
    filters.brand = 'all';
    filters.dia = 'all';
    filters.gdia = 'all';
    filters.color = 'all';
    filters.special = 'all';

    brandDropdown?.reset();

    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === 'all');
    });

    renderProducts();
    playWelcomeWave();
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.filter;
      const value = btn.dataset.value;

      document.querySelectorAll(`[data-filter="${group}"]`).forEach((b) => {
        b.classList.toggle('active', b === btn);
      });

      filters[group] = value;
      renderProducts();
      playWelcomeWave();
    });
  });

  function openModal(product) {
    activeProduct = product;
    document.getElementById('modalLens').style.background = lensStyle(product.color);
    document.getElementById('modalBrand').textContent = product.brand;
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalSpecs').innerHTML = `
      <li>1-Day Wear</li>
      <li>0.00 Rx</li>
      <li>DIA ${formatSpecValue(product.dia)}</li>
      <li>GDIA ${formatSpecValue(product.gdia)}</li>
      <li>${capitalize(product.color)}</li>
      ${product.axisLock ? '<li>Axis-Lock</li>' : ''}
    `;
    document.getElementById('modalDesc').textContent = productDescription(product);
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
            <p>${product.brand} · DIA ${product.dia} · GDIA ${product.gdia}${product.axisLock ? ' · Axis-Lock' : ''} · Qty ${item.quantity}</p>
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
