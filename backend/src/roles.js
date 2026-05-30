export const DB_ROLES = [
  'rol_administrador',
  'rol_gerente_tienda',
  'rol_vendedor',
  'rol_almacenista',
  'rol_auditor',
];

/** Permisos de la UI/API por rol de negocio */
export const PERMISSIONS = {
  reporte: ['rol_administrador', 'rol_gerente_tienda', 'rol_vendedor', 'rol_auditor'],
  productos_read: ['rol_administrador', 'rol_gerente_tienda', 'rol_vendedor', 'rol_almacenista', 'rol_auditor'],
  productos_write: ['rol_administrador', 'rol_almacenista'],
  clientes_read: ['rol_administrador', 'rol_gerente_tienda', 'rol_vendedor', 'rol_auditor'],
  clientes_write: ['rol_administrador', 'rol_gerente_tienda', 'rol_vendedor'],
  venta: ['rol_administrador', 'rol_gerente_tienda', 'rol_vendedor'],
  consultas: ['rol_administrador', 'rol_gerente_tienda', 'rol_vendedor', 'rol_almacenista', 'rol_auditor'],
  totales_periodo: ['rol_administrador', 'rol_gerente_tienda', 'rol_auditor'],
  anular_factura: ['rol_administrador', 'rol_gerente_tienda'],
  ajustar_stock: ['rol_administrador', 'rol_almacenista'],
};

export function canAccess(rol, permission) {
  return PERMISSIONS[permission]?.includes(rol) ?? false;
}

export function assertRole(rol) {
  if (!DB_ROLES.includes(rol)) {
    throw Object.assign(new Error('Rol de base de datos no válido'), { statusCode: 400 });
  }
}
