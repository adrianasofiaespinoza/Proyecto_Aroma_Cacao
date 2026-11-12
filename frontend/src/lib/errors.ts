/**
 * Un solo lugar para convertir los errores del backend en mensajes de bodega.
 * El backend responde en inglés con `detail`; aquí se traduce a lo que diría el jefe de bodega,
 * con el código técnico aparte para soporte.
 */

export type ErrorCode =
  | 'STOCK_INSUFICIENTE'
  | 'LOTE_INSUFICIENTE'
  | 'LOTE_VENCIDO'
  | 'PRODUCTO_INACTIVO'
  | 'YA_REVISADO'
  | 'CREDENCIALES'
  | 'SESION_EXPIRADA'
  | 'SIN_PERMISO'
  | 'NO_ENCONTRADO'
  | 'DUPLICADO'
  | 'DATOS_INVALIDOS'
  | 'SIN_CONEXION'
  | 'ERROR_SERVIDOR'

export interface StockInfo {
  product: string
  current: number
  loaned: number
  available: number
  requested: number
}

export class ApiError extends Error {
  status: number
  detail: string
  code: ErrorCode
  title: string
  /** `${code} · ${status}` listo para mostrar en Notice.code */
  codeLabel: string
  stock?: StockInfo

  constructor(status: number, detail: string, mapped: { code: ErrorCode; title: string; message: string; stock?: StockInfo }) {
    super(mapped.message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.code = mapped.code
    this.title = mapped.title
    this.codeLabel = status ? `${mapped.code} · ${status}` : mapped.code
    this.stock = mapped.stock
  }
}

const num = (s: string | undefined) => Number(s ?? 0)

function translate(status: number, detail: string): { code: ErrorCode; title: string; message: string; stock?: StockInfo } {
  let m = detail.match(/Insufficient stock for product '(.+)'\. Current: (\S+), Loaned: (\S+), Available: (\S+), Requested: (\S+)/)
  if (m) {
    const stock: StockInfo = { product: m[1] ?? '', current: num(m[2]), loaned: num(m[3]), available: num(m[4]), requested: num(m[5]) }
    const loaned = stock.loaned > 0 ? ` (${stock.current} en stock, ${stock.loaned} prestadas)` : ''
    return {
      code: 'STOCK_INSUFICIENTE',
      title: 'La salida supera lo disponible',
      message: `Se pidieron ${stock.requested} de ${stock.product} y hay ${stock.available} disponibles${loaned}. El stock no cambió.`,
      stock,
    }
  }
  m = detail.match(/Insufficient quantity in lot (\S+)\. Remaining: (\S+), Requested: (\S+)/)
  if (m) {
    return {
      code: 'LOTE_INSUFICIENTE',
      title: 'El lote no tiene esa cantidad',
      message: `Al lote ${m[1]} le quedan ${num(m[2])} y se pidieron ${num(m[3])}. El stock no cambió.`,
    }
  }
  if (/expired/i.test(detail)) {
    return { code: 'LOTE_VENCIDO', title: 'El lote está vencido', message: 'Un lote vencido no puede entrar ni salir de bodega. Registra un ajuste si hay que darlo de baja.' }
  }
  if (/is inactive/i.test(detail)) {
    return { code: 'PRODUCTO_INACTIVO', title: 'El producto está inactivo', message: 'Reactívalo en Productos antes de mover su stock.' }
  }
  m = detail.match(/Movement is already (\w+)/)
  if (m) {
    const estado = m[1] === 'authorized' ? 'autorizada' : m[1] === 'rejected' ? 'rechazada' : m[1] ?? ''
    return { code: 'YA_REVISADO', title: 'Esta solicitud ya fue revisada', message: `Ya está ${estado}. Recarga la lista para ver su estado actual.` }
  }
  if (/requires a lot/i.test(detail)) {
    return { code: 'DATOS_INVALIDOS', title: 'Falta el lote', message: 'Este producto lleva trazabilidad por lote: elige uno.' }
  }
  if (/not tracked by lots/i.test(detail)) {
    return { code: 'DATOS_INVALIDOS', title: 'Este producto no usa lotes', message: 'Quita el lote de la solicitud.' }
  }
  if (/Quantity must be greater than zero/i.test(detail)) {
    return { code: 'DATOS_INVALIDOS', title: 'La cantidad debe ser mayor que cero', message: 'Solo un ajuste puede registrar 0.' }
  }
  if (/already exists|already registered|duplicate|ya existe/i.test(detail) || status === 409) {
    return { code: 'DUPLICADO', title: 'Ya existe un registro con esos datos', message: detail || 'Revisa el código, el correo o el número de lote: debe ser único.' }
  }
  if (status === 401) {
    if (/credentials|password|email/i.test(detail)) {
      return { code: 'CREDENCIALES', title: 'Correo o contraseña incorrectos', message: 'Revisa los datos e inténtalo de nuevo.' }
    }
    return { code: 'SESION_EXPIRADA', title: 'La sesión terminó', message: 'Vuelve a iniciar sesión para continuar.' }
  }
  if (status === 403) {
    return { code: 'SIN_PERMISO', title: 'Tu rol no puede hacer esto', message: 'Pídele al coordinador de mantenimiento que lo haga o que cambie tu rol.' }
  }
  if (status === 404) {
    return { code: 'NO_ENCONTRADO', title: 'No se encontró el registro', message: 'Puede que otra persona lo haya cambiado. Recarga la lista.' }
  }
  if (status === 422 || status === 400) {
    return { code: 'DATOS_INVALIDOS', title: 'Revisa los datos del formulario', message: detail || 'Hay un campo con un valor que el sistema no acepta.' }
  }
  if (status >= 500) {
    return { code: 'ERROR_SERVIDOR', title: 'El servidor tuvo un problema', message: 'No se guardó nada. Inténtalo de nuevo en un momento; si sigue, avisa a soporte.' }
  }
  return { code: 'ERROR_SERVIDOR', title: 'Algo salió mal', message: detail || 'Inténtalo de nuevo.' }
}

/** Extrae `detail` de una respuesta de FastAPI (texto o lista de errores 422). */
export async function errorFromResponse(res: Response): Promise<ApiError> {
  let detail = ''
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') detail = body.detail
    else if (Array.isArray(body.detail)) {
      detail = (body.detail as { loc?: unknown[]; msg?: string }[])
        .map((d) => {
          const field = Array.isArray(d.loc) ? d.loc.filter((l) => l !== 'body').join('.') : ''
          const msg = (d.msg ?? '').replace(/^Value error, /, '')
          return field ? `${field}: ${msg}` : msg
        })
        .join(' · ')
    }
  } catch {
    /* sin cuerpo JSON */
  }
  return new ApiError(res.status, detail, translate(res.status, detail))
}

export function networkError(): ApiError {
  return new ApiError(0, '', {
    code: 'SIN_CONEXION',
    title: 'No hay conexión con el servidor',
    message: 'Revisa la red Wi-Fi de la planta. Lo que escribiste no se perdió: vuelve a intentarlo cuando regrese la señal.',
  })
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

export function isConnectionError(e: unknown): boolean {
  return isApiError(e) && e.code === 'SIN_CONEXION'
}

/** Mensaje corto para un Toast o un alert de respaldo. */
export function describeError(e: unknown): { title: string; message: string; code?: string } {
  if (isApiError(e)) return { title: e.title, message: e.message, code: e.codeLabel }
  if (e instanceof Error) return { title: 'Algo salió mal', message: e.message }
  return { title: 'Algo salió mal', message: 'Inténtalo de nuevo.' }
}
