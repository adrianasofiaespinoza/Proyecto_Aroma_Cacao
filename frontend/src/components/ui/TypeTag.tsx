import { Icon } from './Icon'

export interface TypeTagProps {
  type: 'entrada' | 'salida' | 'ajuste'
}

export const TYPE_META: Record<TypeTagProps['type'], { label: string; icon: string }> = {
  entrada: { label: 'Entrada', icon: 'box-arrow-in-down' },
  salida: { label: 'Salida', icon: 'box-arrow-up' },
  ajuste: { label: 'Ajuste', icon: 'sliders' },
}

export function TypeTag({ type }: TypeTagProps) {
  const meta = TYPE_META[type] ?? { label: type, icon: 'dash-lg' }
  return (
    <span className="bd-type">
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  )
}
