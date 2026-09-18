// ─── Checkout page logic ─────────────────────────────────────────────────────
//
// Facebook Page ID from facebook.com/people/Myelenses/61593976143698
const FB_PAGE_USERNAME = '61593976143698';

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

const IG_SHOP_USERNAME = 'mye.lenses';

function orderConfirmMessage(orderNum) {
  return `Order ${orderNum} is placed`;
}

function renderConfirmation(contactMethod, orderNum) {
  const confirmText = orderConfirmMessage(orderNum);
  const isInstagram = contactMethod === 'instagram';
  const channelLabel = isInstagram ? 'Instagram' : 'Facebook Messenger';
  const channelHandle = isInstagram
    ? `<strong>@${IG_SHOP_USERNAME}</strong>`
    : 'our Facebook page';
  const openUrl = isInstagram
    ? `https://ig.me/m/${IG_SHOP_USERNAME}?ref=ORDER_${orderNum}`
    : `https://m.me/${FB_PAGE_USERNAME}?ref=ORDER_${orderNum}`;
  const openLabel = isInstagram ? 'Open Instagram chat' : 'Open Messenger';
  const openClass = isInstagram
    ? 'confirmation-messenger-btn confirmation-ig-btn'
    : 'confirmation-messenger-btn';

  return `
    <div class="confirmation-heart">♡</div>
    <h2 class="confirmation-title">One more step to<br>confirm your order</h2>
    <div class="confirmation-order-num">${orderNum}</div>
    <p class="confirmation-notice">
      Your order is <strong>not officially placed yet</strong>.
      Please copy and send this message to ${channelHandle} from your ${channelLabel} account
      so we can proceed with payment and confirm your order.
    </p>
    <div class="confirmation-message-box">
      <p class="confirmation-message-label">Message to send</p>
      <p class="confirmation-message-text" id="confirmMessageText">${confirmText}</p>
      <button type="button" class="btn btn-outline confirmation-copy-btn" id="copyConfirmMessage">
        Copy message
      </button>
    </div>
    <a href="${openUrl}" target="_blank" rel="noopener" class="${openClass}">
      ${openLabel}
    </a>
    <p class="confirmation-hint">Paste the message in the chat, then tap Send.</p>
    <a href="index.html" class="btn btn-outline confirmation-continue">Continue Shopping</a>
  `;
}

function wireConfirmationActions() {
  const copyBtn = document.getElementById('copyConfirmMessage');
  const textEl = document.getElementById('confirmMessageText');
  if (!copyBtn || !textEl) return;

  copyBtn.addEventListener('click', async () => {
    const text = textEl.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy message';
      }, 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      copyBtn.textContent = 'Select & copy';
    }
  });
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
    document.getElementById('instagramNote')?.classList.toggle('hidden', contact !== 'instagram');
    document.getElementById('messengerNote')?.classList.toggle('hidden', contact !== 'messenger');
    contactOptions?.classList.toggle('instagram-selected', contact === 'instagram');
    contactOptions?.classList.toggle('messenger-selected', contact === 'messenger');
  }

  refreshContactFields();

  document.querySelectorAll('input[name="contact"]').forEach((radio) => {
    radio.addEventListener('change', refreshContactFields);
  });

  document.getElementById('submitOrderBtn').addEventListener('click', async () => {
    const contact = currentContact();
    const submitBtn = document.getElementById('submitOrderBtn');
    const submitErr = document.getElementById('submitOrderError');
    submitErr?.classList.add('hidden');

    const delivery = currentDelivery();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing order...';

    try {
      const result = await callShopFunction('place-order', {
        delivery,
        contactMethod: contact,
        instagram: null,
        shipping: delivery === 'shipping' ? getShippingAddress() : null,
        items: cartItems.map((item) => ({ id: item.product.id, quantity: item.quantity })),
      });

      orderNum = result.orderNumber;
      document.getElementById('confirmationScreen').innerHTML =
        renderConfirmation(contact, orderNum);
      wireConfirmationActions();

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
