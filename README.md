# Proyecto2BD1
Webapp de tienda simple.

## Documentación de diseño (BD)

- [ER, modelo relacional y normalización 3FN](docs/disenio-base-datos.md)
- DDL, vista `vista_reporte_ventas` e índices: [`db/schema.sql`](db/schema.sql)
- Datos de prueba (≥25 filas por tabla): [`db/seed.sql`](db/seed.sql) — ejecutar después de `schema.sql` (`psql -f db/schema.sql -f db/seed.sql` o equivalente).
