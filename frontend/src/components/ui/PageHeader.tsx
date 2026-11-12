import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from './Icon'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Texto del enlace «‹ Volver». */
  back?: string
  /** Ruta del enlace de volver; sin ella, vuelve a la página anterior. */
  backTo?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, back, backTo, actions }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className="bd-pagehead">
      <div>
        {back && (
          <a
            className="bd-back"
            href={backTo ?? '#'}
            onClick={(e) => {
              e.preventDefault()
              if (backTo) navigate(backTo)
              else navigate(-1)
            }}
          >
            <Icon name="chevron-left" />{back}
          </a>
        )}
        <h1>{title}</h1>
        {subtitle && <div className="bd-pagehead-sub">{subtitle}</div>}
      </div>
      {actions && <div className="bd-pagehead-actions">{actions}</div>}
    </div>
  )
}
