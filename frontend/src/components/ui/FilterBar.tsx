import type { ReactNode } from 'react'

export function FilterBar({ children }: { children?: ReactNode }) {
  return <div className="bd-filters" role="search">{children}</div>
}
