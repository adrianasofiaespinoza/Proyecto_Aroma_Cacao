import type { ReactNode } from 'react'

export function CodeTag({ children }: { children?: ReactNode }) {
  return <code className="bd-code">{children}</code>
}
