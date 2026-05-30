# Proyecto2BD1
Webapp de tienda simple — inventario y ventas (PostgreSQL, Node.js, HTML/JS, Docker).

## Requisitos

- [Docker](https://docs.docker.com/get-docker/) y Docker Compose v2

## Levantar desde cero (recomendado)

```bash
git clone <url-del-repositorio>
cd Proyecto2BD1
copy .env.example .env          # Windows
# cp .env.example .env          # Linux / macOS
docker compose up --build
```

Abrir en el navegador: **http://localhost:3000**

- **Base de datos:** PostgreSQL 16 (`db`), usuario `proy2`, contraseña `secret`, base `tienda`.
- **API + frontend:** servicio `api` en el puerto `3000` (configurable con `PORT` en `.env`).
- Al **primer arranque**, PostgreSQL ejecuta automáticamente `db/schema.sql` y `db/seed.sql` (DDL, vista, índices y datos de prueba).

Comprobar API: `curl http://localhost:3000/health` → `{"ok":true}`

Detener: `Ctrl+C` y, si quieres borrar datos persistentes, `docker compose down -v`.

## Variables de entorno

Copiar [`.env.example`](.env.example) a `.env`. Credenciales fijas para calificación:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://proy2:secret@db:5432/tienda` | Conexión usada por la API (host `db` dentro de Compose) |
| `PORT` | `3000` | Puerto publicado de la aplicación |
| `HOST` | `0.0.0.0` | Interfaz de escucha del servidor |

## Documentación de diseño (BD)

- [ER, modelo relacional y normalización 3FN](docs/disenio-base-datos.md)
- DDL, vista `vista_reporte_ventas` e índices: [`db/schema.sql`](db/schema.sql)
- Datos de prueba (≥25 filas por tabla): [`db/seed.sql`](db/seed.sql)

## Interfaz web

Secciones en `http://localhost:3000/`:

| Sección | Funcionalidad |
|---------|----------------|
| **Reporte ventas** | Vista SQL `vista_reporte_ventas` |
| **Productos** | CRUD completo |
| **Clientes** | CRUD completo |
| **Nueva venta** | Transacción con descuento de stock |
| **Consultas SQL** | JOINs, subconsultas, agregados, CTE |

## Desarrollo local (sin Docker)

Con PostgreSQL local y credenciales `proy2` / `secret`:

```bash
psql -U proy2 -d tienda -f db/schema.sql -f db/seed.sql
copy .env.example .env
# Editar DATABASE_URL=postgresql://proy2:secret@localhost:5432/tienda
cd backend
npm install
npm run dev
```

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| GET | `/api/reportes/vista-ventas` | Reporte desde vista SQL |
| GET | `/api/consultas/join-resumen-facturas` | JOIN multi-tabla |
| GET | `/api/consultas/join-producto-categoria-proveedor` | JOIN multi-tabla |
| GET | `/api/consultas/join-atencion-ventas` | JOIN multi-tabla |
| GET | `/api/consultas/subquery-productos-sin-venta` | Subconsulta `NOT IN` |
| GET | `/api/consultas/subquery-clientes-desde-from` | Subconsulta en `FROM` |
| GET | `/api/consultas/subquery-empleados-con-ventas` | Subconsulta `EXISTS` |
| GET | `/api/consultas/agregados-ventas-por-categoria?minTotal=15` | `GROUP BY` / `HAVING` |
| GET | `/api/consultas/cte-ventas-mensuales` | CTE (`WITH`) |
| POST | `/api/ventas` | Venta transaccional (`BEGIN`/`COMMIT`/`ROLLBACK`) |
| CRUD | `/api/productos`, `/api/clientes` | JSON |

**Ejemplo `POST /api/ventas`:**

```json
{
  "id_cliente": 1,
  "id_empleado": 1,
  "fecha": "2025-05-01",
  "lineas": [{ "id_producto": 4, "cantidad": 2 }]
}
```

## Estructura del proyecto

```
Proyecto2BD1/
├── docker-compose.yml    # db + api
├── backend/              # API Fastify + pg (SQL explícito)
├── frontend/             # UI estática
├── db/                   # schema.sql, seed.sql
└── docs/                 # diseño de BD
```
