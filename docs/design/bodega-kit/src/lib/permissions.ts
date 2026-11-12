export type Role = 'coordinador' | 'operador' | 'lectura';
export type Action = 'ver' | 'solicitar' | 'autorizar' | 'prestar' | 'administrar' | 'usuarios';

export const ROLES: Record<Role, { label: string; icon: 'shield-lock' | 'wrench-adjustable' | 'eye' }> = {
  coordinador: { label: 'Coordinador', icon: 'shield-lock' },
  operador: { label: 'Operador', icon: 'wrench-adjustable' },
  lectura: { label: 'Solo lectura', icon: 'eye' },
};

const PERMS: Record<Role, readonly Action[]> = {
  coordinador: ['ver', 'solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios'],
  operador: ['ver', 'solicitar', 'prestar'],
  lectura: ['ver'],
};

/** La interfaz oculta (no deshabilita) lo que el rol no puede hacer. El backend vuelve a validar. */
export function can(role: Role | undefined, action: Action): boolean {
  return !!role && PERMS[role].includes(action);
}
