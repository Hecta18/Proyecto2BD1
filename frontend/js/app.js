import { api, renderTable, showAlert, hideAlert } from './api.js';

let session = null;
const alertEl = document.getElementById('alert');
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginError = document.getElementById('login-error');
const mainNav = document.getElementById('main-nav');

const NAV = [
  { id: 'reporte', label: 'Reporte ventas', perm: 'reporte' },
  { id: 'productos', label: 'Productos', perm: 'productos' },
  { id: 'clientes', label: 'Clientes', perm: 'clientes' },
  { id: 'venta', label: 'Nueva venta', perm: 'venta' },
  { id: 'consultas', label: 'Consultas SQL', perm: 'consultas' },
];

const QUERIES = [
  { title: 'JOIN — Resumen facturas', url: '/api/consultas/join-resumen-facturas' },
  { title: 'JOIN — Producto / categoría / proveedor', url: '/api/consultas/join-producto-categoria-proveedor' },
  { title: 'JOIN — Atención y ventas', url: '/api/consultas/join-atencion-ventas' },
  { title: 'Subconsulta NOT IN', url: '/api/consultas/subquery-productos-sin-venta' },
  { title: 'Subconsulta en FROM', url: '/api/consultas/subquery-clientes-desde-from' },
  { title: 'Subconsulta EXISTS', url: '/api/consultas/subquery-empleados-con-ventas' },
  { title: 'GROUP BY / HAVING', url: '/api/consultas/agregados-ventas-por-categoria', paramMin: 'min-total', paramName: 'minTotal' },
  { title: 'CTE (WITH)', url: '/api/consultas/cte-ventas-mensuales' },
];

function perm(key) {
  return session?.permisos?.[key] ?? false;
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.dataset.label = btn.textContent;
  btn.textContent = loading ? 'Cargando…' : btn.dataset.label || btn.textContent;
}

async function withFeedback(fn, btn) {
  hideAlert(alertEl);
  setLoading(btn, true);
  try {
    return await fn();
  } catch (err) {
    if (err.status === 401) {
      showLogin();
      throw err;
    }
    showAlert(alertEl, err.message || 'Error inesperado', 'error');
    throw err;
  } finally {
    setLoading(btn, false);
  }
}

function showLogin() {
  session = null;
  loginScreen.classList.remove('hidden');
  appShell.classList.add('hidden');
}

function showApp() {
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  document.getElementById('user-label').textContent =
    `${session.nombre} (${session.rol_db})`;
  buildNav();
  applyRoleUi();
  const first = NAV.find((n) => perm(n.perm === 'productos' ? 'productos' : n.perm));
  if (first) activateSection(first.id);
  loadInitialData();
}

function buildNav() {
  mainNav.innerHTML = '';
  NAV.forEach((item) => {
    const pKey = item.id === 'productos' ? 'productos' : item.perm;
    if (!perm(pKey)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn';
    btn.dataset.section = item.id;
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      document.getElementById(`section-${item.id}`).classList.add('active');
      hideAlert(alertEl);
    });
    mainNav.appendChild(btn);
  });
}

function activateSection(id) {
  const btn = mainNav.querySelector(`[data-section="${id}"]`);
  if (btn) btn.click();
}

function applyRoleUi() {
  document.getElementById('btn-nuevo-producto').classList.toggle('hidden', !perm('productosWrite'));
  document.getElementById('btn-nuevo-cliente').classList.toggle('hidden', !perm('clientesWrite'));
  document.getElementById('totales-periodo-panel').classList.toggle('hidden', !perm('totalesPeriodo'));
  document.getElementById('anular-panel').classList.toggle('hidden', !perm('anularFactura'));
  document.getElementById('ajustar-stock-panel').classList.toggle('hidden', !perm('ajustarStock'));
  document.getElementById('section-venta').classList.toggle('hidden', !perm('venta'));

  const grid = document.getElementById('query-grid');
  grid.innerHTML = '';
  if (!perm('consultas')) return;
  QUERIES.forEach((q) => {
    const card = document.createElement('div');
    card.className = 'query-card';
    card.innerHTML = `<h3>${q.title}</h3>`;
    if (q.paramMin) {
      card.innerHTML += `<label>Total mínimo<input type="number" id="min-total" value="15" min="0" step="0.01" /></label>`;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn primary query-btn';
    btn.textContent = 'Ejecutar';
    btn.addEventListener('click', () => runQuery(q, btn));
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

async function runQuery(q, btn) {
  let url = q.url;
  if (q.paramMin && q.paramName) {
    const val = document.getElementById(q.paramMin)?.value ?? 15;
    url += `?${q.paramName}=${encodeURIComponent(val)}`;
  }
  await withFeedback(async () => {
    const res = await api.get(url);
    document.getElementById('consulta-titulo').textContent =
      `${res.consulta || q.title} — ${res.data.length} fila(s)`;
    renderTable(document.getElementById('consulta-table'), res.data);
  }, btn);
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(loginError);
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  try {
    const res = await api.post('/api/auth/login', { username, password });
    session = res.data;
    showApp();
  } catch (err) {
    showAlert(loginError, err.message, 'error');
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  try {
    await api.post('/api/auth/logout');
  } catch {
    /* ignore */
  }
  showLogin();
});

async function tryRestoreSession() {
  try {
    const res = await api.get('/api/auth/me');
    session = res.data;
    showApp();
  } catch {
    showLogin();
  }
}

async function loadInitialData() {
  if (perm('reporte')) cargarReporte().catch(() => {});
  if (perm('productos')) cargarProductos().catch(() => {});
  if (perm('clientes')) cargarClientes().catch(() => {});
}

document.getElementById('btn-cargar-reporte')?.addEventListener('click', (e) =>
  cargarReporte(e.target)
);

async function cargarReporte(btn) {
  await withFeedback(async () => {
    const res = await api.get('/api/reportes/vista-ventas');
    document.getElementById('reporte-meta').textContent = `${res.consulta} — ${res.data.length} fila(s)`;
    renderTable(document.getElementById('reporte-table'), res.data, 'No hay ventas');
  }, btn);
}

document.getElementById('btn-totales-periodo')?.addEventListener('click', async (e) => {
  const inicio = document.getElementById('totales-inicio').value;
  const fin = document.getElementById('totales-fin').value;
  await withFeedback(async () => {
    const res = await api.get(
      `/api/reportes/totales-periodo?inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`
    );
    document.getElementById('totales-result').textContent = JSON.stringify(res.data, null, 2);
  }, e.target);
});

document.getElementById('btn-anular-factura')?.addEventListener('click', async (e) => {
  const id = Number(document.getElementById('anular-factura-id').value);
  if (!id) {
    showAlert(alertEl, 'Indique ID de factura', 'error');
    return;
  }
  if (!confirm(`¿Anular factura #${id}?`)) return;
  await withFeedback(async () => {
    const res = await api.post(`/api/facturas/${id}/anular`);
    showAlert(alertEl, res.mensaje, 'success');
  }, e.target);
});

document.getElementById('btn-ajustar-stock')?.addEventListener('click', async (e) => {
  const id = Number(document.getElementById('ajuste-producto-id').value);
  const delta = Number(document.getElementById('ajuste-delta').value);
  const motivo = document.getElementById('ajuste-motivo').value;
  if (!id || !delta) {
    showAlert(alertEl, 'Producto y delta son obligatorios', 'error');
    return;
  }
  await withFeedback(async () => {
    await api.post(`/api/productos/${id}/ajustar-stock`, { delta, motivo });
    showAlert(alertEl, 'Stock ajustado (sp_ajustar_stock)', 'success');
    await cargarProductos();
  }, e.target);
});

const formProducto = document.getElementById('form-producto');
const productosTable = document.getElementById('productos-table');

function resetFormProducto() {
  document.getElementById('producto-id').value = '';
  document.getElementById('producto-nombre').value = '';
  document.getElementById('producto-precio').value = '';
  document.getElementById('producto-stock').value = '0';
  document.getElementById('producto-activo').checked = true;
  document.getElementById('form-producto-titulo').textContent = 'Nuevo producto';
}

document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => {
  resetFormProducto();
  formProducto.classList.remove('hidden');
});

document.getElementById('btn-cancelar-producto')?.addEventListener('click', () => {
  formProducto.classList.add('hidden');
  resetFormProducto();
});

async function cargarProductos() {
  const res = await api.get('/api/productos');
  productosTable.innerHTML = '';
  if (!res.data.length) {
    productosTable.innerHTML = '<p class="empty-msg">No hay productos</p>';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Activo</th><th>Acciones</th></tr></thead>';
  const tbody = document.createElement('tbody');
  res.data.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.id_producto}</td><td>${p.nombre}</td><td>${p.precio_venta}</td><td>${p.stock}</td><td>${p.activo ? 'Sí' : 'No'}</td><td class="actions-cell"></td>`;
    const actions = tr.querySelector('.actions-cell');
    if (perm('productosWrite')) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn small';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => {
        document.getElementById('producto-id').value = p.id_producto;
        document.getElementById('producto-nombre').value = p.nombre;
        document.getElementById('producto-precio').value = p.precio_venta;
        document.getElementById('producto-stock').value = p.stock;
        document.getElementById('producto-activo').checked = p.activo;
        document.getElementById('form-producto-titulo').textContent = `Editar #${p.id_producto}`;
        formProducto.classList.remove('hidden');
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn small danger';
      del.textContent = 'Desactivar';
      del.addEventListener('click', async () => {
        if (!confirm(`¿Desactivar "${p.nombre}"?`)) return;
        await withFeedback(async () => {
          await api.delete(`/api/productos/${p.id_producto}`);
          showAlert(alertEl, 'Producto desactivado (SP)', 'success');
          await cargarProductos();
        });
      });
      actions.append(edit, del);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  productosTable.appendChild(table);
}

formProducto?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('producto-id').value;
  const body = {
    nombre: document.getElementById('producto-nombre').value.trim(),
    precio_venta: Number(document.getElementById('producto-precio').value),
    stock: Number(document.getElementById('producto-stock').value),
    activo: document.getElementById('producto-activo').checked,
  };
  await withFeedback(async () => {
    if (id) await api.put(`/api/productos/${id}`, body);
    else await api.post('/api/productos', body);
    showAlert(alertEl, id ? 'Producto actualizado (ORM)' : 'Producto creado (ORM)', 'success');
    formProducto.classList.add('hidden');
    resetFormProducto();
    await cargarProductos();
  });
});

const formCliente = document.getElementById('form-cliente');
const clientesTable = document.getElementById('clientes-table');

function resetFormCliente() {
  document.getElementById('cliente-id').value = '';
  document.getElementById('cliente-nombre').value = '';
  document.getElementById('cliente-email').value = '';
  document.getElementById('cliente-telefono').value = '';
  document.getElementById('cliente-empleado').value = '1';
  document.getElementById('form-cliente-titulo').textContent = 'Nuevo cliente';
}

document.getElementById('btn-nuevo-cliente')?.addEventListener('click', () => {
  resetFormCliente();
  formCliente.classList.remove('hidden');
});

document.getElementById('btn-cancelar-cliente')?.addEventListener('click', () => {
  formCliente.classList.add('hidden');
  resetFormCliente();
});

async function cargarClientes() {
  const res = await api.get('/api/clientes');
  clientesTable.innerHTML = '';
  if (!res.data.length) {
    clientesTable.innerHTML = '<p class="empty-msg">No hay clientes</p>';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Empleado</th><th>Acciones</th></tr></thead>';
  const tbody = document.createElement('tbody');
  res.data.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.id_cliente}</td><td>${c.nombre}</td><td>${c.email ?? ''}</td><td>${c.telefono ?? ''}</td><td>${c.empleado_nombre ?? c.id_empleado}</td><td class="actions-cell"></td>`;
    if (perm('clientesWrite')) {
      const actions = tr.querySelector('.actions-cell');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn small';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => {
        document.getElementById('cliente-id').value = c.id_cliente;
        document.getElementById('cliente-nombre').value = c.nombre;
        document.getElementById('cliente-email').value = c.email ?? '';
        document.getElementById('cliente-telefono').value = c.telefono ?? '';
        document.getElementById('cliente-empleado').value = c.id_empleado;
        document.getElementById('form-cliente-titulo').textContent = `Editar #${c.id_cliente}`;
        formCliente.classList.remove('hidden');
      });
      actions.appendChild(edit);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  clientesTable.appendChild(table);
}

formCliente?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('cliente-id').value;
  const body = {
    nombre: document.getElementById('cliente-nombre').value.trim(),
    email: document.getElementById('cliente-email').value.trim() || null,
    telefono: document.getElementById('cliente-telefono').value.trim() || null,
    id_empleado: Number(document.getElementById('cliente-empleado').value),
  };
  await withFeedback(async () => {
    if (id) await api.put(`/api/clientes/${id}`, body);
    else await api.post('/api/clientes', body);
    showAlert(alertEl, id ? 'Cliente actualizado (ORM)' : 'Cliente creado (ORM)', 'success');
    formCliente.classList.add('hidden');
    resetFormCliente();
    await cargarClientes();
  });
});

const ventaLineas = document.getElementById('venta-lineas');
const ventaFecha = document.getElementById('venta-fecha');
if (ventaFecha) ventaFecha.value = new Date().toISOString().slice(0, 10);

function addLineaRow(idProducto = '', cantidad = 1) {
  const row = document.createElement('div');
  row.className = 'linea-row';
  row.innerHTML = `
    <label>Producto (ID)<input type="number" class="linea-producto" min="1" value="${idProducto}" required /></label>
    <label>Cantidad<input type="number" class="linea-cantidad" min="1" value="${cantidad}" required /></label>
    <button type="button" class="btn small danger btn-quitar-linea">Quitar</button>`;
  row.querySelector('.btn-quitar-linea').addEventListener('click', () => {
    if (ventaLineas.children.length > 1) row.remove();
    else showAlert(alertEl, 'Debe haber al menos una línea', 'error');
  });
  ventaLineas.appendChild(row);
}

document.getElementById('btn-add-linea')?.addEventListener('click', () => addLineaRow());
if (ventaLineas) {
  ventaLineas.innerHTML = '';
  addLineaRow(1, 1);
}

document.getElementById('form-venta')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const lineas = [];
  for (const row of ventaLineas.querySelectorAll('.linea-row')) {
    lineas.push({
      id_producto: Number(row.querySelector('.linea-producto').value),
      cantidad: Number(row.querySelector('.linea-cantidad').value),
    });
  }
  await withFeedback(async () => {
    const res = await api.post('/api/ventas', {
      id_cliente: Number(document.getElementById('venta-cliente').value),
      id_empleado: Number(document.getElementById('venta-empleado').value),
      fecha: ventaFecha.value,
      lineas,
    });
    showAlert(alertEl, `${res.data.mensaje} — factura #${res.data.id_factura}`, 'success');
  });
});

tryRestoreSession();
api.get('/health').then(() => {
  document.getElementById('api-status').textContent = 'API conectada';
}).catch(() => {
  document.getElementById('api-status').textContent = 'API no disponible';
});
