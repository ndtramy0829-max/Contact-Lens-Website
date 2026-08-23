// ─── Checkout page logic ─────────────────────────────────────────────────────
//
// Facebook Page username — replace MY_FACEBOOK_PAGE_USERNAME below with your
// actual Facebook Business Page username (the part after facebook.com/ in your
// page URL). Example: if your page is facebook.com/myelensesshop, use
// 'myelensesshop'.
//
const FB_PAGE_USERNAME = 'MY_FACEBOOK_PAGE_USERNAME';

const SHIPPING_FEE = 5.0;

// ─── Order number ─────────────────────────────────────────────────────────────
// Generated once when the customer moves from Step 1 → Step 2.
// Pickup orders start with M, shipping orders start with Y.

function generateOrderNumber(deliveryType) {
  const prefix = deliveryType === 'shipping' ? 'Y' : 'M';
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return prefix + digits;
}

// ─── Cart helpers ─────────────────────────────────────────────────────────────

function getCartWithProducts() {
  return getCart()
    .map((item) => {
      const product = PRODUCTS.find((p) => p.id === item.id);
      return product ? { ...item, product } : null;
    })
    .filter(Boolean);
}

function calcSubtotal(cartItems) {
  return cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

function renderStep1Summary(subtotal, delivery) {
  const shippingCost = delivery === 'shipping' ? SHIPPING_FEE : 0;
  const total = subtotal + shippingCost;

  return `
    <div class="order-summary-title">Order Summary</div>
    <div class="order-summary-row">
      <span>Subtotal</span>
      <span>${formatPrice(subtotal)}</span>
    </div>
    <div class="order-summary-row is-shipping">
      <span>Shipping</span>
      <span>${shippingCost > 0 ? formatPrice(shippingCost) : 'Free'}</span>
    </div>
    <div class="order-summary-divider"></div>
    <div class="order-summary-row is-total">
      <span>Total</span>
      <span>${formatPrice(total)}</span>
    </div>
  `;
}

function renderReceiptCard(cartItems, delivery, address, orderNum) {
  const subtotal = calcSubtotal(cartItems);
  const shippingCost = delivery === 'shipping' ? SHIPPING_FEE : 0;
  const total = subtotal + shippingCost;

  const deliveryBadge = delivery === 'shipping'
    ? 'Shipping'
    : 'Pickup — OC / SD';

  const itemsHtml = cartItems.map((item) => `
    <li class="receipt-item">
      <div>
        <div class="receipt-item-name">${item.product.name}</div>
        <div class="receipt-item-qty">${item.product.brand} · Qty ${item.quantity}</div>
      </div>
      <div class="receipt-item-price">${formatPrice(item.product.price * item.quantity)}</div>
    </li>
  `).join('');

  const addressHtml = delivery === 'shipping' && address ? `
    <div class="receipt-address">
      <div class="receipt-address-label">Ship to</div>
      ${address.name}<br>
      ${address.line1}${address.line2 ? ', ' + address.line2 : ''}<br>
      ${address.city}, ${address.state} ${address.zip}
    </div>
  ` : '';

  return `
    <div class="receipt-header">
      <div>
        <div class="receipt-order-label">Order Number</div>
        <div class="receipt-order-num">${orderNum}</div>
      </div>
      <div class="receipt-delivery-badge">${deliveryBadge}</div>
    </div>

    <ul class="receipt-items">${itemsHtml}</ul>

    <div class="receipt-totals">
      <div class="receipt-total-row">
        <span>Subtotal</span>
        <span>${formatPrice(subtotal)}</span>
      </div>
      <div class="receipt-total-row">
        <span>Shipping</span>
        <span>${shippingCost > 0 ? formatPrice(shippingCost) : 'Free'}</span>
      </div>
      <div class="receipt-total-row is-grand">
        <span>Total</span>
        <span>${formatPrice(total)}</span>
      </div>
    </div>

    ${addressHtml}
  `;
}

function renderConfirmation(contactMethod, orderNum, instagramHandle) {
  if (contactMethod === 'instagram') {
    return `
      <div class="confirmation-heart">♡</div>
      <h2 class="confirmation-title">Thank you for placing<br>an order with us!</h2>
      <p class="confirmation-subtitle">
        Message <strong>@mye.lenses.shop</strong> from your Instagram account<br>
        so we can send your order confirmation (${orderNum}).
      </p>
      <a href="index.html" class="btn btn-outline">Continue Shopping</a>
    `;
  }

  // Facebook Messenger
  // To add the order number to the ref param later, change the URL to:
  // `https://m.me/${FB_PAGE_USERNAME}?ref=ORDER_${orderNum}`
  const messengerUrl = `https://m.me/${FB_PAGE_USERNAME}`;

  return `
    <div class="confirmation-heart">♡</div>
    <h2 class="confirmation-title">Thank you for placing<br>an order with us!</h2>
    <div class="confirmation-order-num">${orderNum}</div>
    <p class="confirmation-subtitle">
      Message us on Facebook Messenger to confirm<br>your order details.
    </p>
    <a href="${messengerUrl}" target="_blank" rel="noopener" class="confirmation-messenger-btn">
      Message us here
    </a>
    <br>
    <a href="index.html" class="btn btn-outline" style="margin-top:8px;">Continue Shopping</a>
  `;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateShippingForm() {
  const fields = [
    { id: 'shipName',  errId: 'errShipName' },
    { id: 'shipAddr1', errId: 'errShipAddr1' },
    { id: 'shipCity',  errId: 'errShipCity' },
    { id: 'shipState', errId: 'errShipState' },
    { id: 'shipZip',   errId: 'errShipZip' },
  ];

  let valid = true;

  fields.forEach(({ id, errId }) => {
    const input = document.getElementById(id);
    const err   = document.getElementById(errId);
    const empty = !input.value.trim();
    input.classList.toggle('is-invalid', empty);
    err.classList.toggle('hidden', !empty);
    if (empty) valid = false;
  });

  return valid;
}

function getShippingAddress() {
  return {
    name:  document.getElementById('shipName').value.trim(),
    line1: document.getElementById('shipAddr1').value.trim(),
    line2: document.getElementById('shipAddr2').value.trim(),
    city:  document.getElementById('shipCity').value.trim(),
    state: document.getElementById('shipState').value.trim().toUpperCase(),
    zip:   document.getElementById('shipZip').value.trim(),
  };
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function setStep(step) {
  [1, 2, 3].forEach((n) => {
    const el = document.getElementById(`stepIndicator${n}`);
    el.classList.remove('is-active', 'is-done');
    if (n < step)       el.classList.add('is-done');
    else if (n === step) el.classList.add('is-active');

    document.getElementById(`step${n}`).classList.toggle('hidden', n !== step);
  });
}

// ─── Main init ────────────────────────────────────────────────────────────────

function initCheckoutPage() {
  updateCartCount();

  // Redirect to cart if cart is empty
  const cartItems = getCartWithProducts();
  if (cartItems.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  const subtotal = calcSubtotal(cartItems);
  let orderNum = null; // generated once on Step 1 → 2 transition

  // ── Step 1 setup ────────────────────────────────────────

  function currentDelivery() {
    return document.querySelector('input[name="delivery"]:checked')?.value ?? 'pickup';
  }

  function refreshSummary() {
    document.getElementById('step1Summary').innerHTML =
      renderStep1Summary(subtotal, currentDelivery());
  }

  refreshSummary();

  document.querySelectorAll('input[name="delivery"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isShipping = radio.value === 'shipping';
      document.getElementById('shippingForm').classList.toggle('hidden', !isShipping);
      refreshSummary();
    });
  });

  document.getElementById('nextStepBtn').addEventListener('click', () => {
    const delivery = currentDelivery();

    if (delivery === 'shipping') {
      if (!validateShippingForm()) return;
    }

    // Generate order number exactly once
    if (!orderNum) {
      orderNum = generateOrderNumber(delivery);
    }

    const address = delivery === 'shipping' ? getShippingAddress() : null;

    document.getElementById('receiptCard').innerHTML =
      renderReceiptCard(cartItems, delivery, address, orderNum);

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Step 2 setup ────────────────────────────────────────

  document.getElementById('backToStep1').addEventListener('click', () => {
    // Reset order number so a fresh one is generated if delivery type changes
    orderNum = null;
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function currentContact() {
    return document.querySelector('input[name="contact"]:checked')?.value ?? 'instagram';
  }

  function refreshContactFields() {
    const contact = currentContact();
    const contactOptions = document.getElementById('contactOptions');
    document.getElementById('instagramField').classList.toggle('hidden', contact !== 'instagram');
    document.getElementById('messengerNote').classList.toggle('hidden', contact !== 'messenger');
    contactOptions?.classList.toggle('instagram-selected', contact === 'instagram');
    contactOptions?.classList.toggle('messenger-selected', contact === 'messenger');
  }

  refreshContactFields();

  document.querySelectorAll('input[name="contact"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      refreshContactFields();
      moveInstagramFieldForMobile();
    });
  });

  // On mobile, move the Instagram username field directly under the
  // Instagram option card (instead of after both option cards).
  const instagramField = document.getElementById('instagramField');
  const instagramDefaultParent = instagramField?.parentNode;
  const instagramDefaultNextSibling = instagramField?.nextSibling;

  function isMobileLayout() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function moveInstagramFieldForMobile() {
    if (!instagramField || !instagramDefaultParent) return;

    const mobile = isMobileLayout();
    if (mobile) {
      const instagramOptionInput = document.getElementById('contactInstagram');
      const instagramOptionLabel = instagramOptionInput?.closest('label.contact-option');
      if (instagramOptionLabel) instagramOptionLabel.insertAdjacentElement('afterend', instagramField);
      return;
    }

    // Restore the original position for desktop.
    if (instagramDefaultNextSibling && instagramDefaultNextSibling.parentNode === instagramDefaultParent) {
      instagramDefaultParent.insertBefore(instagramField, instagramDefaultNextSibling);
    } else {
      instagramDefaultParent.appendChild(instagramField);
    }
  }

  moveInstagramFieldForMobile();
  window.addEventListener('resize', moveInstagramFieldForMobile);

  document.getElementById('submitOrderBtn').addEventListener('click', async () => {
    const contact = currentContact();
    const submitBtn = document.getElementById('submitOrderBtn');
    const submitErr = document.getElementById('submitOrderError');
    submitErr?.classList.add('hidden');

    if (contact === 'instagram') {
      const handle = document.getElementById('instagramHandle').value.trim();
      const errEl  = document.getElementById('errInstagram');
      const input  = document.getElementById('instagramHandle');

      if (!handle) {
        input.classList.add('is-invalid');
        errEl.classList.remove('hidden');
        input.focus();
        return;
      }

      input.classList.remove('is-invalid');
      errEl.classList.add('hidden');
    }

    const delivery = currentDelivery();
    const instagramHandle = document.getElementById('instagramHandle').value.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing order...';

    try {
      const result = await callShopFunction('place-order', {
        delivery,
        contactMethod: contact,
        instagram: contact === 'instagram' ? instagramHandle : null,
        shipping: delivery === 'shipping' ? getShippingAddress() : null,
        items: cartItems.map((item) => ({ id: item.product.id, quantity: item.quantity })),
      });

      orderNum = result.orderNumber;
      document.getElementById('confirmationScreen').innerHTML =
        renderConfirmation(contact, orderNum, instagramHandle);

      saveCart([]);
      updateCartCount();
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      submitErr.textContent = err.message || 'Could not place order.';
      submitErr.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Order';
    }
  });
}
