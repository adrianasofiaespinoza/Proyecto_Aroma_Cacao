import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

export interface ConnectionErrorProps {
  onRetry?: () => void
  /** `banner`: banda superior cuando ya hay datos en pantalla. */
  variant?: 'block' | 'banner'
  text?: string
}

export function ConnectionError({ onRetry, variant = 'block', text }: ConnectionErrorProps) {
  if (variant === 'banner') {
    return (
      <div className="bd-offline" role="alert">
        <Icon name="wifi-off" />
        Sin conexión. Los datos pueden estar desactualizados.
        <Button size="sm" variant="secondary" icon="arrow-repeat" onClick={onRetry}>Reintentar</Button>
      </div>
    )
  }
  return (
    <EmptyState
      tone="error"
      icon="wifi-off"
      title="No hay conexión con el servidor"
      text={text ?? 'Revisa la red Wi-Fi de la planta. Lo que escribiste no se perdió: vuelve a intentarlo cuando regrese la señal.'}
      action={<Button variant="primary" size="lg" icon="arrow-repeat" onClick={onRetry}>Reintentar</Button>}
    />
  )
}
