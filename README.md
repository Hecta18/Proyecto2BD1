# Proyecto2BD1
Webapp de tienda simple.

## Documentación de diseño (BD)

- [ER, modelo relacional y normalización 3FN](docs/disenio-base-datos.md)
- DDL, vista `vista_reporte_ventas` e índices: [`db/schema.sql`](db/schema.sql)
- Datos de prueba (≥25 filas por tabla): [`db/seed.sql`](db/seed.sql) — ejecutar después de `schema.sql` (`psql -f db/schema.sql -f db/seed.sql` o equivalente).

## API (backend)

Ubicación: [`backend/`](backend/). Variables: copiar [`.env.example`](.env.example) a `.env` y ajustar `DATABASE_URL` (usuario `proy2`, contraseña `secret`).

```bash
cp .env.example .env   # Windows: copy .env.example .env
cd backend
npm install
npm run dev
```

Servicio por defecto: `http://localhost:3000`. Comprobación: `GET /health`. Abrir **`http://localhost:3000/`** en el navegador para la interfaz web (mismo origen que la API).

## Interfaz web (`frontend/`)

HTML, CSS y JavaScript sin framework. El backend sirve los estáticos desde [`frontend/`](frontend/).

| Sección | Funcionalidad |
|---------|----------------|
| **Reporte ventas** | Tabla desde la vista `vista_reporte_ventas` |
| **Productos** | CRUD completo con validaciones |
| **Clientes** | CRUD completo con validaciones |
| **Nueva venta** | Registro transaccional con líneas de producto |
| **Consultas SQL** | JOINs, subconsultas, `GROUP BY`/`HAVING`, CTE |

Los errores de validación y de la API se muestran en un banner bajo la cabecera.

| Método | Ruta | Descripción |
|--------|------|----------------|
| GET | `/api/consultas/join-resumen-facturas` | JOIN: factura, compra, cliente, empleado |
| GET | `/api/consultas/join-producto-categoria-proveedor` | JOIN: producto, categorías y proveedores |
| GET | `/api/consultas/join-atencion-ventas` | JOIN: empleado, compra, cliente, factura |
| GET | `/api/consultas/subquery-productos-sin-venta` | Subconsulta `NOT IN` |
| GET | `/api/consultas/subquery-clientes-desde-from` | Subconsulta en `FROM` |
| GET | `/api/consultas/subquery-empleados-con-ventas` | Subconsulta `EXISTS` |
| GET | `/api/consultas/agregados-ventas-por-categoria?minTotal=15` | `GROUP BY` / `HAVING` |
| GET | `/api/consultas/cte-ventas-mensuales` | Consulta con `WITH` (CTE) |
| GET | `/api/reportes/vista-ventas` | Datos desde la vista `vista_reporte_ventas` |
| POST | `/api/ventas` | Transacción: compra + factura + detalle + stock (`BEGIN`/`COMMIT`/`ROLLBACK`) |
| — | `/api/productos`, `/api/clientes` | CRUD JSON (cuerpo `application/json`) |

**Ejemplo `POST /api/ventas`:**

```json
{
  "id_cliente": 1,
  "id_empleado": 1,
  "fecha": "2025-05-01",
  "lineas": [{ "id_producto": 4, "cantidad": 2 }]
}
```
