/** Une clases y descarta los valores falsos. */
export const cx = (...parts: unknown[]): string => parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
