import type { TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('bd-textarea', className)} {...props} />
}
