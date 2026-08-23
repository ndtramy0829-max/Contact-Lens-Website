const ADMIN_TOKEN_KEY = 'mye-admin-token';

function adminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

async function adminRequest(action, payload = {}) {
  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-admin-token': adminToken(),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Admin request failed');
  return data;
}

function showError(message) {
  const el = document.getElementById('adminError');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('hidden', !message);
}

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

function renderInventory(products) {
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Available</th>
            <th>Sold</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${products.map((p) => `
            <tr>
              <td>${p.brand} ${p.name}</td>
              <td><input class="admin-qty" data-available="${p.id}" type="number" min="0" value="${p.available_pairs}"></td>
              <td>${p.sold_pairs}</td>
              <td class="admin-actions">
                <button class="btn btn-primary" data-save-stock="${p.id}">Save</button>
                <button class="btn btn-outline" data-notify="${p.id}">Notify waitlist</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderOrders(orders) {
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td>
                <strong>${o.order_number}</strong><br>
                ${o.delivery_type} · ${o.contact_method}
                ${o.instagram_username ? `<br>@${o.instagram_username}` : ''}
              </td>
              <td>${(o.items || []).map((i) => `${i.name} x${i.quantity}`).join('<br>')}</td>
              <td>${money(o.total)}</td>
              <td><span class="admin-status ${o.status}">${o.status}</span></td>
              <td class="admin-actions">
                ${o.status === 'waiting' ? `
                  <button class="btn btn-primary" data-complete="${o.id}">Mark complete</button>
                  <button class="btn btn-outline" data-cancel="${o.id}">Cancel</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderWaitlist(entries) {
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((w) => `
            <tr>
              <td>${w.product_name}</td>
              <td>${w.instagram_username ? `@${w.instagram_username}` : w.phone || ''}</td>
              <td>${w.status}</td>
              <td>${new Date(w.created_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadTab(tab) {
  showError('');
  const panel = document.getElementById('adminPanel');
  panel.innerHTML = '<p>Loading...</p>';
  try {
    if (tab === 'inventory') {
      const { products } = await adminRequest('list-inventory');
      panel.innerHTML = renderInventory(products);
    } else if (tab === 'orders') {
      const { orders } = await adminRequest('list-orders');
      panel.innerHTML = renderOrders(orders);
    } else {
      const { waitlist } = await adminRequest('list-waitlist');
      panel.innerHTML = renderWaitlist(waitlist);
    }
  } catch (err) {
    panel.innerHTML = '';
    showError(err.message);
  }
}

async function showApp() {
  document.getElementById('adminLogin').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  await loadTab('inventory');
}

document.getElementById('adminLoginBtn').addEventListener('click', async () => {
  const password = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('adminLoginError');
  errorEl.classList.add('hidden');
  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: 'login', password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Login failed');
    sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    await showApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

document.querySelectorAll('.admin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((el) => el.classList.toggle('is-active', el === tab));
    loadTab(tab.dataset.tab);
  });
});

document.getElementById('adminPanel').addEventListener('click', async (event) => {
  const saveId = event.target.dataset.saveStock;
  const notifyId = event.target.dataset.notify;
  const completeId = event.target.dataset.complete;
  const cancelId = event.target.dataset.cancel;
  try {
    if (saveId) {
      const input = document.querySelector(`[data-available="${saveId}"]`);
      await adminRequest('update-stock', {
        productId: Number(saveId),
        availablePairs: Number(input.value),
      });
      await loadTab('inventory');
    }
    if (notifyId) {
      await adminRequest('notify-waitlist', { productId: Number(notifyId) });
      await loadTab('inventory');
    }
    if (completeId) {
      await adminRequest('complete-order', { orderId: Number(completeId) });
      await loadTab('orders');
    }
    if (cancelId) {
      await adminRequest('cancel-order', { orderId: Number(cancelId) });
      await loadTab('orders');
    }
  } catch (err) {
    showError(err.message);
  }
});

if (adminToken()) {
  showApp().catch(() => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  });
}
