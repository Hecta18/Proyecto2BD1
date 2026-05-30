import { api, renderTable, showAlert, hideAlert } from './api.js';

const alertEl = document.getElementById('alert');
const apiStatus = document.getElementById('api-status');

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
    showAlert(alertEl, err.message || 'Error inesperado', 'error');
    throw err;
  } finally {
    setLoading(btn, false);
  }
}

// Navegación
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
    hideAlert(alertEl);
  });
});

// Health
async function checkHealth() {
  try {
    await api.get('/health');
    apiStatus.textContent = 'API conectada';
    apiStatus.style.color = 'var(--success)';
  } catch {
    apiStatus.textContent = 'No se pudo conectar con la API';
    apiStatus.style.color = 'var(--danger)';
  }
}

// Reporte (VIEW)
const reporteTable = document.getElementById('reporte-table');
const reporteMeta = document.getElementById('reporte-meta');
const btnCargarReporte = document.getElementById('btn-cargar-reporte');

async function cargarReporte(btn) {
  await withFeedback(async () => {
    const res = await api.get('/api/reportes/vista-ventas');
    reporteMeta.textContent = `${res.consulta} — ${res.data.length} fila(s)`;
    renderTable(reporteTable, res.data, 'No hay ventas registradas');
  }, btn);
}

btnCargarReporte.addEventListener('click', () => cargarReporte(btnCargarReporte));

// Productos CRUD
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

function showFormProducto(show) {
  formProducto.classList.toggle('hidden', !show);
}

document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
  resetFormProducto();
  showFormProducto(true);
});

document.getElementById('btn-cancelar-producto').addEventListener('click', () => {
  showFormProducto(false);
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
  table.innerHTML = `
    <thead><tr>
      <th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Activo</th><th>Acciones</th>
    </tr></thead>
  `;
  const tbody = document.createElement('tbody');
  res.data.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id_producto}</td>
      <td>${p.nombre}</td>
      <td>${p.precio_venta}</td>
      <td>${p.stock}</td>
      <td>${p.activo ? 'Sí' : 'No'}</td>
      <td class="actions-cell"></td>
    `;
    const actions = tr.querySelector('.actions-cell');
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
      document.getElementById('form-producto-titulo').textContent = `Editar producto #${p.id_producto}`;
      showFormProducto(true);
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = 'Desactivar';
    del.addEventListener('click', async () => {
      if (!confirm(`¿Desactivar "${p.nombre}"?`)) return;
      await withFeedback(async () => {
        await api.delete(`/api/productos/${p.id_producto}`);
        showAlert(alertEl, 'Producto desactivado', 'success');
        await cargarProductos();
      });
    });
    actions.append(edit, del);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  productosTable.appendChild(table);
}

formProducto.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('producto-id').value;
  const nombre = document.getElementById('producto-nombre').value.trim();
  const precio = Number(document.getElementById('producto-precio').value);
  const stock = Number(document.getElementById('producto-stock').value);
  const activo = document.getElementById('producto-activo').checked;

  if (!nombre) {
    showAlert(alertEl, 'El nombre del producto es obligatorio', 'error');
    return;
  }
  if (!Number.isFinite(precio) || precio < 0) {
    showAlert(alertEl, 'Precio no válido', 'error');
    return;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    showAlert(alertEl, 'Stock debe ser un entero ≥ 0', 'error');
    return;
  }

  const body = { nombre, precio_venta: precio, stock, activo };
  await withFeedback(async () => {
    if (id) {
      await api.put(`/api/productos/${id}`, body);
      showAlert(alertEl, 'Producto actualizado', 'success');
    } else {
      await api.post('/api/productos', body);
      showAlert(alertEl, 'Producto creado', 'success');
    }
    showFormProducto(false);
    resetFormProducto();
    await cargarProductos();
  });
});

// Clientes CRUD
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

function showFormCliente(show) {
  formCliente.classList.toggle('hidden', !show);
}

document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
  resetFormCliente();
  showFormCliente(true);
});

document.getElementById('btn-cancelar-cliente').addEventListener('click', () => {
  showFormCliente(false);
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
  table.innerHTML = `
    <thead><tr>
      <th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Empleado</th><th>Acciones</th>
    </tr></thead>
  `;
  const tbody = document.createElement('tbody');
  res.data.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.id_cliente}</td>
      <td>${c.nombre}</td>
      <td>${c.email ?? ''}</td>
      <td>${c.telefono ?? ''}</td>
      <td>${c.empleado_nombre ?? c.id_empleado}</td>
      <td class="actions-cell"></td>
    `;
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
      document.getElementById('form-cliente-titulo').textContent = `Editar cliente #${c.id_cliente}`;
      showFormCliente(true);
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn small danger';
    del.textContent = 'Eliminar';
    del.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar a "${c.nombre}"?`)) return;
      await withFeedback(async () => {
        await api.delete(`/api/clientes/${c.id_cliente}`);
        showAlert(alertEl, 'Cliente eliminado', 'success');
        await cargarClientes();
      });
    });
    actions.append(edit, del);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  clientesTable.appendChild(table);
}

formCliente.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('cliente-id').value;
  const nombre = document.getElementById('cliente-nombre').value.trim();
  const email = document.getElementById('cliente-email').value.trim();
  const telefono = document.getElementById('cliente-telefono').value.trim();
  const id_empleado = Number(document.getElementById('cliente-empleado').value);

  if (!nombre) {
    showAlert(alertEl, 'El nombre del cliente es obligatorio', 'error');
    return;
  }
  if (!Number.isInteger(id_empleado) || id_empleado < 1) {
    showAlert(alertEl, 'ID de empleado no válido', 'error');
    return;
  }

  const body = {
    nombre,
    email: email || null,
    telefono: telefono || null,
    id_empleado,
  };

  await withFeedback(async () => {
    if (id) {
      await api.put(`/api/clientes/${id}`, body);
      showAlert(alertEl, 'Cliente actualizado', 'success');
    } else {
      await api.post('/api/clientes', body);
      showAlert(alertEl, 'Cliente creado', 'success');
    }
    showFormCliente(false);
    resetFormCliente();
    await cargarClientes();
  });
});

// Venta
const ventaLineas = document.getElementById('venta-lineas');
const ventaFecha = document.getElementById('venta-fecha');
ventaFecha.value = new Date().toISOString().slice(0, 10);

function addLineaRow(idProducto = '', cantidad = 1) {
  const row = document.createElement('div');
  row.className = 'linea-row';
  row.innerHTML = `
    <label>Producto (ID)
      <input type="number" class="linea-producto" min="1" value="${idProducto}" required />
    </label>
    <label>Cantidad
      <input type="number" class="linea-cantidad" min="1" value="${cantidad}" required />
    </label>
    <button type="button" class="btn small danger btn-quitar-linea">Quitar</button>
  `;
  row.querySelector('.btn-quitar-linea').addEventListener('click', () => {
    if (ventaLineas.children.length > 1) row.remove();
    else showAlert(alertEl, 'Debe haber al menos una línea', 'error');
  });
  ventaLineas.appendChild(row);
}

document.getElementById('btn-add-linea').addEventListener('click', () => addLineaRow());
addLineaRow(1, 1);

document.getElementById('form-venta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id_cliente = Number(document.getElementById('venta-cliente').value);
  const id_empleado = Number(document.getElementById('venta-empleado').value);
  const fecha = ventaFecha.value;

  if (!Number.isInteger(id_cliente) || id_cliente < 1) {
    showAlert(alertEl, 'Cliente no válido', 'error');
    return;
  }
  if (!Number.isInteger(id_empleado) || id_empleado < 1) {
    showAlert(alertEl, 'Empleado no válido', 'error');
    return;
  }

  const lineas = [];
  for (const row of ventaLineas.querySelectorAll('.linea-row')) {
    const id_producto = Number(row.querySelector('.linea-producto').value);
    const cantidad = Number(row.querySelector('.linea-cantidad').value);
    if (!Number.isInteger(id_producto) || id_producto < 1) {
      showAlert(alertEl, 'Cada línea necesita un ID de producto válido', 'error');
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      showAlert(alertEl, 'Cada línea necesita cantidad entera positiva', 'error');
      return;
    }
    lineas.push({ id_producto, cantidad });
  }

  await withFeedback(async () => {
    const res = await api.post('/api/ventas', { id_cliente, id_empleado, fecha, lineas });
    const msg = res.data?.mensaje || 'Venta registrada';
    showAlert(alertEl, `${msg} (factura #${res.data.id_factura})`, 'success');
    ventaLineas.innerHTML = '';
    addLineaRow(1, 1);
  });
});

// Consultas SQL
const consultaTable = document.getElementById('consulta-table');
const consultaTitulo = document.getElementById('consulta-titulo');

document.querySelectorAll('.query-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    let url = btn.dataset.url;
    const paramId = btn.dataset.paramMin;
    const paramName = btn.dataset.paramName;
    if (paramId && paramName) {
      const val = document.getElementById(paramId).value;
      url += `?${paramName}=${encodeURIComponent(val)}`;
    }
    await withFeedback(async () => {
      const res = await api.get(url);
      consultaTitulo.textContent = res.consulta
        ? `${res.consulta} — ${res.data.length} fila(s)`
        : `${res.data.length} fila(s)`;
      renderTable(consultaTable, res.data);
    }, btn);
  });
});

// Inicio
checkHealth();
cargarReporte().catch(() => {});
cargarProductos().catch(() => {});
cargarClientes().catch(() => {});
