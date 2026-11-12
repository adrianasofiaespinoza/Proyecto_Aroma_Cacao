import type { ReactNode } from 'react'
import { can, type Action, type Role } from '../../lib/permissions'

export interface RoleGateProps {
  role: Role | undefined
  action: Action
  children?: ReactNode
  fallback?: ReactNode
}

/** Lo que el rol no puede hacer no se muestra (no se deshabilita). El backend vuelve a validar. */
export function RoleGate({ role, action, children, fallback = null }: RoleGateProps) {
  return <>{can(role, action) ? children : fallback}</>
}
