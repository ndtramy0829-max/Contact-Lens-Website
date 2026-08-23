const CART_KEY = 'myeyes-cart';

let productStock = {};

function availableFor(productId) {
  const row = productStock[productId];
  if (!row) return null;
  return row.available;
}

function isSoldOut(productId) {
  const available = availableFor(productId);
  return available !== null && available <= 0;
}

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
  if (isSoldOut(productId)) return;

  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  const nextQty = existing ? existing.quantity + 1 : 1;

  if (Number.isFinite(availableFor(productId)) && nextQty > availableFor(productId)) {
    return;
  }

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

let productImagesPreloaded = false;

function collectProductImageUrls() {
  const urls = new Set();

  PRODUCTS.forEach((product) => {
    if (product.image) urls.add(product.image);
    if (product.images?.length) {
      product.images.forEach((src) => urls.add(src));
    }
  });

  return [...urls];
}

function preloadProductImages() {
  if (productImagesPreloaded) return;
  productImagesPreloaded = true;

  collectProductImageUrls().forEach((path) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = encodeURI(path);
  });
}

function isProductShotImage(src) {
  return src.toLowerCase().includes('no background');
}

const PRODUCT_LENS_BOX_PX = 106;
const PRODUCT_LENS_TARGET_PX = 91;
const PRODUCT_LENS_ALPHA_THRESHOLD = 128;

function getProductLensTargetPx() {
  const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--product-lens-display-size'));
  return Number.isFinite(target) && target > 0 ? target : PRODUCT_LENS_TARGET_PX;
}

function normalizeProductShotImage(img) {
  const run = () => {
    const boxPx = img.getBoundingClientRect().width || PRODUCT_LENS_BOX_PX;
    if (!boxPx) return;

    const sample = 64;
    const canvas = document.createElement('canvas');
    canvas.width = sample;
    canvas.height = sample;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, sample, sample);
    const { data, width, height } = ctx.getImageData(0, 0, sample, sample);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > PRODUCT_LENS_ALPHA_THRESHOLD) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (minX >= maxX || minY >= maxY) return;

    const contentFrac = Math.max(maxX - minX, maxY - minY) / sample;
    const displayedLens = contentFrac * boxPx;
    const targetPx = getProductLensTargetPx();
    const scale = targetPx / displayedLens;

    if (scale > 0.55 && scale < 2.4) {
      img.style.transform = `scale(${scale})`;
      img.style.transformOrigin = 'center center';
    }
  };

  if (img.complete && img.naturalWidth) run();
  else img.addEventListener('load', run, { once: true });
}

function normalizeProductShotImages(root = document) {
  root.querySelectorAll('.product-image--product-shot').forEach(normalizeProductShotImage);
}

function productCardMedia(product) {
  if (product.image) {
    const alt = `${product.brand} ${product.name}`;
    return `<div class="product-image-wrap product-image-wrap--product"><img class="product-image product-image--product-shot" src="${encodeURI(product.image)}" alt="${alt}" loading="eager" decoding="async" /></div>`;
  }
  return `<div class="product-media-slot"><div class="product-lens" style="background: ${lensStyle(product.color)}"></div></div>`;
}

function productThumbMedia(product) {
  if (product.image) {
    const imgClass = isProductShotImage(product.image)
      ? 'cart-item-image cart-item-image--product'
      : 'cart-item-image';
    return `<img class="${imgClass}" src="${encodeURI(product.image)}" alt="${product.name}" />`;
  }
  return `<div class="cart-item-lens" style="background: ${lensStyle(product.color)}"></div>`;
}

function setModalMedia(product) {
  const mediaEl = document.getElementById('modalLens');
  const modal = mediaEl?.closest('.modal');
  if (!mediaEl) return;

  if (product.images?.length) {
    modal?.classList.add('has-media');
    mediaEl.className = 'modal-media';
    mediaEl.style.background = '';
    mediaEl.innerHTML = product.images.map((src, index) => {
      const imageType = index === 0 ? ' modal-image--model' : ' modal-image--product';
      return `<img class="modal-image${imageType}" src="${encodeURI(src)}" alt="${product.name}" />`;
    }).join('');
    return;
  }

  if (product.image) {
    modal?.classList.add('has-media');
    mediaEl.className = 'modal-media';
    mediaEl.style.background = '';
    mediaEl.innerHTML = `<img class="modal-image modal-image--product" src="${encodeURI(product.image)}" alt="${product.name}" />`;
    return;
  }

  modal?.classList.remove('has-media');
  mediaEl.className = 'modal-lens';
  mediaEl.innerHTML = '';
  mediaEl.style.background = lensStyle(product.color);
}

function resetModalAnimation(modal, overlay) {
  if (!modal || !overlay) return;
  modal.classList.remove('is-flipping-in', 'is-from-card');
  modal.style.transition = '';
  modal.style.transform = '';
  modal.style.opacity = '';
  overlay.style.transition = '';
  overlay.style.opacity = '';
}

function animateModalFromCard(modal, overlay, sourceEl) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.style.opacity = '1';
    return;
  }

  const cardRect = sourceEl.getBoundingClientRect();
  const modalRect = modal.getBoundingClientRect();

  const cardCx = cardRect.left + cardRect.width / 2;
  const cardCy = cardRect.top + cardRect.height / 2;
  const modalCx = modalRect.left + modalRect.width / 2;
  const modalCy = modalRect.top + modalRect.height / 2;

  const dx = cardCx - modalCx;
  const dy = cardCy - modalCy;
  const scale = cardRect.width / modalRect.width;

  modal.classList.add('is-from-card');
  modal.style.transition = 'none';
  modal.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale}) rotateY(-78deg)`;
  modal.style.opacity = '0.4';
  overlay.style.opacity = '0';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity 0.42s ease';
      overlay.style.opacity = '1';
      modal.style.transition =
        'transform 0.64s cubic-bezier(0.34, 1.12, 0.64, 1), opacity 0.48s ease';
      modal.style.transform = 'translate3d(0, 0, 0) scale(1) rotateY(0deg)';
      modal.style.opacity = '1';
    });
  });

  const onEnd = (event) => {
    if (event.propertyName !== 'transform') return;
    modal.removeEventListener('transitionend', onEnd);
    resetModalAnimation(modal, overlay);
  };

  modal.addEventListener('transitionend', onEnd);
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
  preloadProductImages();
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

  function productCardMeta(product) {
    const sizingLine = `DIA ${product.dia} · GDIA ${product.gdia}`;
    const detailParts = [capitalize(product.color)];
    if (product.axisLock) detailParts.push('Axis-Lock');
    const detailLine = detailParts.join(' · ');

    return `
      <span class="product-meta-line">${sizingLine}</span>
      <span class="product-meta-line">${detailLine}</span>
    `;
  }

  function renderProducts() {
    const filtered = getFilteredProducts();
    resultsCount.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
    noResults.classList.toggle('hidden', filtered.length > 0);

    grid.innerHTML = filtered.map((p) => `
      <article class="product-card" data-id="${p.id}">
        ${productCardMedia(p)}
        <p class="product-brand">${p.brand}</p>
        <h3>${p.name}</h3>
        <div class="product-meta">${productCardMeta(p)}</div>
        <p class="product-price">${formatPrice(p.price)}</p>
        ${isSoldOut(p.id) ? '<p class="product-sold-out">Sold out</p>' : ''}
      </article>
    `).join('');

    grid.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => {
        const product = PRODUCTS.find((p) => p.id === parseInt(card.dataset.id, 10));
        if (product) openModal(product, card);
      });
    });

    normalizeProductShotImages(grid);
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

  function openModal(product, cardEl) {
    activeProduct = product;
    setModalMedia(product);
    document.getElementById('modalBrand').textContent = product.brand;
    document.getElementById('modalTitle').textContent = product.name;
    const specRows = [
      ['1-Day Wear', '0.00 Rx'],
      [`DIA ${formatSpecValue(product.dia)}`, `GDIA ${formatSpecValue(product.gdia)}`, capitalize(product.color)],
    ];
    if (product.axisLock) specRows.push(['Axis-Lock']);

    document.getElementById('modalSpecs').innerHTML = specRows
      .map((pills) => `
        <li class="modal-specs-row">
          ${pills.map((pill) => `<span class="modal-spec-pill">${pill}</span>`).join('')}
        </li>
      `)
      .join('');
    document.getElementById('modalPrice').textContent = formatPrice(product.price);

    const soldOut = isSoldOut(product.id);
    const addBtn = document.getElementById('modalAddToCart');
    const waitlistForm = document.getElementById('waitlistForm');
    addBtn.textContent = soldOut ? 'Sold out' : 'Add to Cart';
    addBtn.disabled = soldOut;
    addBtn.classList.toggle('hidden', soldOut);
    waitlistForm?.classList.toggle('hidden', !soldOut);
    document.getElementById('waitlistError')?.classList.add('hidden');
    document.getElementById('waitlistSuccess')?.classList.add('hidden');
    const igInput = document.getElementById('waitlistInstagram');
    const phoneInput = document.getElementById('waitlistPhone');
    if (igInput) igInput.value = '';
    if (phoneInput) phoneInput.value = '';

    const modal = overlay.querySelector('.modal');
    resetModalAnimation(modal, overlay);

    overlay.classList.remove('hidden');
    overlay.classList.remove('is-opening');
    document.body.style.overflow = 'hidden';

    const sourceEl = cardEl?.querySelector('.product-image-wrap, .product-media-slot, .product-lens');

    if (modal && sourceEl) {
      animateModalFromCard(modal, overlay, sourceEl);
    } else if (modal) {
      overlay.classList.add('is-opening');
      modal.classList.remove('is-flipping-in');
      void modal.offsetWidth;
      modal.classList.add('is-flipping-in');
      overlay.style.opacity = '1';
    }
  }

  function closeModal() {
    const modal = overlay.querySelector('.modal');
    resetModalAnimation(modal, overlay);
    overlay.classList.add('hidden');
    overlay.classList.remove('is-opening');
    document.body.style.overflow = '';
    modal?.classList.remove('has-media');
    activeProduct = null;
  }

  modalClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.getElementById('modalAddToCart').addEventListener('click', () => {
    if (activeProduct && !isSoldOut(activeProduct.id)) {
      addToCart(activeProduct.id);
      closeModal();
    }
  });

  document.getElementById('waitlistSubmit')?.addEventListener('click', async () => {
    if (!activeProduct) return;
    const errorEl = document.getElementById('waitlistError');
    const successEl = document.getElementById('waitlistSuccess');
    const instagram = document.getElementById('waitlistInstagram').value.trim();
    const phone = document.getElementById('waitlistPhone').value.trim();
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    if (!instagram && !phone) {
      errorEl.textContent = 'Enter an Instagram username or a phone number.';
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      await callShopFunction('join-waitlist', {
        productId: activeProduct.id,
        instagram,
        phone,
      });
      successEl.classList.remove('hidden');
    } catch (err) {
      errorEl.textContent = err.message || 'Could not join waitlist.';
      errorEl.classList.remove('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closeModal();
    }
  });

  loadProductStockMap().then((map) => {
    productStock = map;
    renderProducts();
  });
  renderProducts();
}

function initCartPage() {
  preloadProductImages();
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
          ${productThumbMedia(product)}
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
    window.location.href = 'checkout.html';
  });

  renderCart();
}
