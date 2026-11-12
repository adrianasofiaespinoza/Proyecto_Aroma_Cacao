import { cx } from './cx'

export interface Brand {
  name: string
  shortName?: string
  product?: string
  logoSrc?: string
}

export interface BrandMarkProps {
  brand: Brand
  layout?: 'stack' | 'row'
}

export function BrandMark({ brand, layout = 'stack' }: BrandMarkProps) {
  const { name, shortName, product = 'Mantenimiento', logoSrc } = brand
  return (
    <div className={cx('bd-brand', layout === 'row' && 'bd-brand-row')}>
      {logoSrc ? <img src={logoSrc} alt={name} /> : <span className="bd-brand-name">{shortName || name}</span>}
      <span className="bd-brand-product">{product}</span>
    </div>
  )
}
