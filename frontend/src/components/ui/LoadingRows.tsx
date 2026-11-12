import { Icon } from './Icon'

export interface LoadingRowsProps {
  rows?: number
  label?: string
}

export function LoadingRows({ rows = 5, label = 'Cargando…' }: LoadingRowsProps) {
  return (
    <div className="bd-loading" aria-busy="true" aria-live="polite">
      <div className="bd-loading-msg"><Icon name="arrow-repeat" />{label}</div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bd-loading-row">
          <div className="bd-skel" style={{ width: 60 + ((i * 17) % 35) + '%' }} />
          <div className="bd-skel" style={{ width: '70%' }} />
          <div className="bd-skel" style={{ width: '50%' }} />
          <div className="bd-skel" style={{ width: '40%' }} />
        </div>
      ))}
    </div>
  )
}
