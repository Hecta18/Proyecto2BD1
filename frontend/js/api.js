const API_BASE = '';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }
  if (!res.ok) {
    const msg = payload?.error || `Error HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};

export function renderTable(container, rows, emptyMessage = 'Sin datos') {
  container.innerHTML = '';
  if (!rows || rows.length === 0) {
    container.innerHTML = `<p class="empty-msg">${emptyMessage}</p>`;
    return;
  }
  const keys = Object.keys(rows[0]);
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  keys.forEach((k) => {
    const th = document.createElement('th');
    th.textContent = k;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    keys.forEach((k) => {
      const td = document.createElement('td');
      const v = row[k];
      td.textContent = v === null || v === undefined ? '' : String(v);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

export function showAlert(el, message, type = 'error') {
  el.textContent = message;
  el.className = `alert ${type}`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function hideAlert(el) {
  el.className = 'alert hidden';
  el.textContent = '';
}
