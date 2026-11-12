import { Icon } from './Icon'

export interface MovementFlowProps {
  status?: 'pendiente' | 'autorizado' | 'rechazado'
  requested?: { by?: string; at?: string }
  reviewed?: { by?: string; at?: string; reason?: string }
}

export function MovementFlow({ status = 'pendiente', requested = {}, reviewed = {} }: MovementFlowProps) {
  const final =
    status === 'autorizado'
      ? { cls: 'bd-flow-ok', icon: 'check-lg', name: 'Autorizado · stock actualizado' }
      : status === 'rechazado'
        ? { cls: 'bd-flow-danger', icon: 'x-lg', name: 'Rechazado · stock sin cambios' }
        : { cls: 'bd-flow-todo', icon: 'box-seam', name: 'Aplicar al stock' }
  return (
    <div className="bd-flowwrap">
      <ol className="bd-flow" aria-label="Estado de la solicitud">
        <li className="bd-flow-done">
          <span className="bd-flow-dot"><Icon name="file-earmark-text" /></span>
          <span className="bd-flow-name">Solicitado</span>
          <span className="bd-flow-meta">{[requested.by, requested.at].filter(Boolean).join(' · ')}</span>
        </li>
        <li className={status === 'pendiente' ? 'bd-flow-current' : 'bd-flow-done'}>
          <span className="bd-flow-dot"><Icon name={status === 'pendiente' ? 'hourglass-split' : 'clipboard-check'} /></span>
          <span className="bd-flow-name">{status === 'pendiente' ? 'Esperando revisión' : 'Revisado'}</span>
          <span className="bd-flow-meta">{status === 'pendiente' ? 'Coordinador de mantenimiento' : [reviewed.by, reviewed.at].filter(Boolean).join(' · ')}</span>
        </li>
        <li className={final.cls}>
          <span className="bd-flow-dot"><Icon name={final.icon} /></span>
          <span className="bd-flow-name">{final.name}</span>
          <span className="bd-flow-meta">
            {status === 'pendiente' ? 'Ocurre solo al autorizar' : status === 'autorizado' ? 'Movimiento aplicado' : reviewed.reason ?? 'Sin movimiento de stock'}
          </span>
        </li>
      </ol>
    </div>
  )
}
