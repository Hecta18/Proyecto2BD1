# Esquema de roles — Proyecto 3

Los cinco roles existen en PostgreSQL con `CREATE ROLE` (sin login). La aplicación se conecta como **`proy3`** y ejecuta `SET ROLE` al rol del usuario autenticado. Los permisos se aplican con `GRANT` / `REVOKE` en [`db/roles.sql`](../db/roles.sql).

## Usuarios de prueba (aplicación)

Contraseña común: **`secret`**

| Usuario | Rol DBMS | Perfil de negocio |
|---------|----------|-------------------|
| `admin` | `rol_administrador` | Acceso total |
| `gerente` | `rol_gerente_tienda` | Gestión comercial y reportes |
| `vendedor` | `rol_vendedor` | Ventas y clientes |
| `almacen` | `rol_almacenista` | Inventario y catálogo |
| `auditor` | `rol_auditor` | Solo lectura y reportes |

## Matriz de permisos por tabla

| Tabla / objeto | rol_administrador | rol_gerente_tienda | rol_vendedor | rol_almacenista | rol_auditor |
|----------------|-------------------|--------------------|--------------|-----------------|-------------|
| empleado, categoria, proveedor | CRUD | SELECT | SELECT | SELECT | SELECT |
| producto | CRUD | SELECT, UPDATE(stock) | SELECT, UPDATE(stock) | SELECT, INSERT, UPDATE | SELECT |
| producto_categoria, producto_proveedor | CRUD | SELECT | SELECT | CRUD | SELECT |
| cliente | CRUD | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | SELECT | SELECT |
| compra, factura, detalle | CRUD | SELECT, INSERT, UPDATE | SELECT, INSERT | SELECT | SELECT |
| factura.estado | UPDATE | UPDATE | — | — | — |
| vista_reporte_ventas | SELECT | SELECT | SELECT | — | SELECT |
| usuario_app | CRUD | SELECT | SELECT | SELECT | SELECT |

**Procedimientos almacenados (EXECUTE):**

| Procedimiento | Roles autorizados |
|---------------|-------------------|
| `sp_registrar_venta` | administrador, gerente, vendedor |
| `sp_ajustar_stock` | administrador, almacenista |
| `sp_desactivar_producto` | administrador, almacenista |
| `sp_obtener_totales_periodo` | administrador, gerente, auditor |
| `sp_anular_factura` | administrador, gerente |

## ORM (Prisma)

Operaciones CRUD vía ORM con `SET LOCAL ROLE` en transacción:

- `producto`: listar, crear, actualizar
- `cliente`: listar, crear, actualizar, eliminar (solo administrador)

Operaciones críticas vía **stored procedures** (SQL explícito): ventas, ajuste de stock, desactivar producto, totales por periodo, anular factura.

Consultas avanzadas (JOIN, subconsultas, CTE, vista): SQL explícito desde el backend.
