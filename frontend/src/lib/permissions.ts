/** soporte = el equipo de desarrollo: la empresa cliente no lo ve ni lo asigna. */
export type Role = 'coordinador' | 'operador' | 'lectura' | 'soporte';
/** configurar = marca, moneda y módulos (solo soporte); reglas = autoaprobación (coordinador y soporte). */
export type Action = 'ver' | 'solicitar' | 'autorizar' | 'prestar' | 'administrar' | 'usuarios' | 'configurar' | 'reglas';

export const ROLES: Record<Role, { label: string; icon: 'shield-lock' | 'wrench-adjustable' | 'eye' | 'person-badge' }> = {
  coordinador: { label: 'Coordinador', icon: 'shield-lock' },
  operador: { label: 'Operador', icon: 'wrench-adjustable' },
  lectura: { label: 'Solo lectura', icon: 'eye' },
  soporte: { label: 'Soporte', icon: 'person-badge' },
};

const PERMS: Record<Role, readonly Action[]> = {
  coordinador: ['ver', 'solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios', 'reglas'],
  operador: ['ver', 'solicitar', 'prestar'],
  lectura: ['ver'],
  soporte: ['ver', 'configurar', 'reglas'],
};

/** La interfaz oculta (no deshabilita) lo que el rol no puede hacer. El backend vuelve a validar. */
export function can(role: Role | undefined, action: Action): boolean {
  return !!role && PERMS[role].includes(action);
}
