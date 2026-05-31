# Proyecto 3 — Tienda (seguridad, roles, SP y ORM)

Extensión del Proyecto 2: **PostgreSQL** con roles en el DBMS, **stored procedures**, **Prisma ORM** para CRUD, autenticación por sesión y UI protegida por rol.

## Requisitos

- Docker y Docker Compose v2

## Levantar desde cero

```bash
git clone <url-del-repositorio>
cd Proyecto2BD1
git checkout proyecto-3
copy .env.example .env          # Windows
# cp .env.example .env          # Linux / macOS
docker compose up --build
```

Abrir **http://localhost:3000** e iniciar sesión con uno de los usuarios demo (contraseña **`secret`**):

| Usuario | Rol | Acceso principal |
|---------|-----|------------------|
| `admin` | `rol_administrador` | Todo |
| `gerente` | `rol_gerente_tienda` | Ventas, clientes, reportes, anular facturas |
| `vendedor` | `rol_vendedor` | Ventas y clientes (lectura productos) |
| `almacen` | `rol_almacenista` | Productos e inventario (SP stock) |
| `auditor` | `rol_auditor` | Solo lectura y reportes |

**Credenciales DB (calificación):** usuario `proy3`, contraseña `secret`, base `tienda`.

Detener: `Ctrl+C`. Borrar datos: `docker compose down -v`.

## Arquitectura

| Componente | Tecnología |
|------------|------------|
| Base de datos | PostgreSQL 16 |
| ORM (CRUD) | Prisma |
| SQL avanzado / SP | `pg` + SQL explícito |
| API | Fastify + sesión (`@fastify/session`) |
| Frontend | HTML / CSS / JS |
| Contenedores | `docker-compose.yml` (`db` + `api`) |

Scripts SQL al primer arranque (orden en `docker-entrypoint-initdb.d`):

1. `db/schema.sql` — tablas, vista, índices
2. `db/roles.sql` — 5 roles `CREATE ROLE`, `GRANT`, `REVOKE`
3. `db/procedures.sql` — stored procedures
4. `db/seed.sql` — datos de prueba + usuarios de aplicación

## Seguridad y roles

Documentación detallada: [`docs/esquema-roles.md`](docs/esquema-roles.md)

- Cinco roles en PostgreSQL: `rol_administrador`, `rol_gerente_tienda`, `rol_vendedor`, `rol_almacenista`, `rol_auditor`
- La API conecta como `proy3` y ejecuta `SET ROLE` al rol del usuario autenticado
- Login/logout: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`

## Stored procedures (invocados desde la API)

| Procedimiento | Uso |
|---------------|-----|
| `sp_registrar_venta` | Venta con transacción y `ROLLBACK` ante error |
| `sp_ajustar_stock` | Ajuste de inventario |
| `sp_desactivar_producto` | Baja lógica de producto |
| `sp_obtener_totales_periodo` | IN/OUT, excepciones — reporte por fechas |
| `sp_anular_factura` | Anulación de factura emitida |

## ORM (Prisma) — operaciones CRUD

- **Producto:** listar, crear, actualizar (`/api/productos`)
- **Cliente:** listar, crear, actualizar, eliminar admin (`/api/clientes`)

Consultas avanzadas del Proyecto 2 (JOIN, subconsultas, CTE, vista) se mantienen con SQL explícito bajo control de rol.

## Variables de entorno (`.env.example`)

```
DATABASE_URL=postgresql://proy3:secret@db:5432/tienda
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=...
```

## Desarrollo local (sin Docker)

```bash
# PostgreSQL con usuario proy3 / secret
psql -U proy3 -d tienda -f db/schema.sql -f db/roles.sql -f db/procedures.sql -f db/seed.sql
copy .env.example .env
# DATABASE_URL=postgresql://proy3:secret@localhost:5432/tienda
cd backend
npm install
npm run dev
```

## Diseño de BD (Proyecto 2)

- [ER y normalización](docs/disenio-base-datos.md)

## Estructura

```
Proyecto2BD1/
├── docker-compose.yml
├── db/           schema, roles, procedures, seed
├── backend/      Fastify + Prisma + rutas
├── frontend/     UI con login y permisos por rol
└── docs/         esquema de roles
```
