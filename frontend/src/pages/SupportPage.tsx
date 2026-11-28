import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { useSessionUser } from '../app/AuthProvider'
import { Button, ConnectionError, Icon, KpiStrip, LoadingRows, Notice, PageHeader, Panel, useGo } from '../components/ui'
import { APP_NAME, APP_VERSION } from '../config/tenant'
import { describeError, isConnectionError } from '../lib/errors'
import { fmtDateTime } from '../lib/format'

const ROLE_LABELS: Record<string, string> = { Coordinator: 'Coordinador', Operator: 'Operador', 'Read-only': 'Solo lectura' }
const MODULE_LABELS = { loans: 'Préstamos', machines: 'Máquinas', suppliers: 'Proveedores' } as const

/**
 * Inicio de soporte: panel técnico (decisión de la usuaria, 2026-11-27). Estado de la instalación,
 * usuarios y totales. Solo cifras: soporte no ve los datos de la bodega.
 */
export function SupportPage() {
  const user = useSessionUser()
  const go = useGo()
  const status = useQuery({ queryKey: ['system-status'], queryFn: api.getSystemStatus, refetchInterval: 60_000 })
  const s = status.data

  const header = <PageHeader title="Panel técnico" subtitle={`${user.name} · Soporte`} actions={<Button variant="secondary" icon="arrow-repeat" loading={status.isFetching} onClick={() => void status.refetch()}>Actualizar</Button>} />

  if (status.isLoading) return <>{header}<LoadingRows rows={4} label="Consultando el estado del sistema…" /></>
  if (status.isError || !s) {
    return (
      <>
        {header}
        {isConnectionError(status.error)
          ? <ConnectionError onRetry={() => void status.refetch()} />
          : <Notice tone="danger" title="No se pudo consultar el estado">{describeError(status.error).message}</Notice>}
      </>
    )
  }

  const roles = Object.entries(s.users.by_role)
  const activeCoordinators = s.users.by_role.Coordinator?.active ?? 0

  return (
    <>
      {header}

      {!s.database.up_to_date && (
        <Notice tone="danger" title="Faltan migraciones en la base de datos">
          La base de datos está en la migración {s.database.migration ?? 'desconocida'} y el código espera la {s.database.migration_expected ?? '?'}.
          Ejecuta <code>alembic upgrade head</code> (con una copia de la BD antes).
        </Notice>
      )}
      {activeCoordinators === 0 && (
        <Notice tone="danger" title="No hay ningún coordinador activo">
          Nadie puede autorizar solicitudes ni administrar la bodega. Crea uno en <a href="/usuarios" onClick={go('/usuarios')}>Usuarios</a>.
        </Notice>
      )}

      <KpiStrip
        items={[
          { label: 'Base de datos', value: s.database.ok ? 'Conectada' : 'Sin conexión', icon: 'layers', tone: s.database.ok ? undefined : 'danger', hint: `Migración ${s.database.migration ?? '—'}` },
          { label: 'Usuarios activos', value: roles.reduce((n, [, c]) => n + c.active, 0), icon: 'people', href: '/usuarios' },
          { label: 'Correos bloqueados', value: s.users.locked_emails.length, icon: 'lock', tone: s.users.locked_emails.length ? 'pending' : undefined, hint: 'Por intentos fallidos' },
          { label: 'Solicitudes pendientes', value: s.totals.movements_pending, icon: 'hourglass-split', tone: s.totals.movements_pending ? 'pending' : undefined },
        ]}
      />

      <div className="sp-grid">
        <Panel title="Instalación" icon="building">
          <dl className="sp-list">
            <dt>Empresa</dt><dd>{s.company.name}</dd>
            <dt>Aplicación</dt><dd>{APP_NAME} {APP_VERSION}</dd>
            <dt>Versión del servidor</dt><dd className="bd-mono">{s.version ?? 'Sin dato (local)'}</dd>
            <dt>Migración</dt><dd>{s.database.migration ?? '—'} {s.database.up_to_date ? <span className="sp-ok"><Icon name="check-circle-fill" /> al día</span> : <span className="sp-bad">espera {s.database.migration_expected}</span>}</dd>
            <dt>Hora del servidor</dt><dd>{fmtDateTime(s.server_time)}</dd>
            <dt>Módulos</dt>
            <dd>{(Object.keys(MODULE_LABELS) as (keyof typeof MODULE_LABELS)[]).map((m) => `${MODULE_LABELS[m]}: ${s.company.modules[m] ? 'activo' : 'desactivado'}`).join(' · ')}</dd>
            <dt>Autoaprobación del coordinador</dt><dd>{s.company.coordinator_auto_approve ? 'Activada' : 'Desactivada'}</dd>
          </dl>
          <Button variant="secondary" icon="sliders" href="/configuracion" onClick={go('/configuracion')}>Ir a Configuración</Button>
        </Panel>

        <Panel title="Usuarios" icon="people">
          <dl className="sp-list">
            {roles.map(([role, c]) => (
              <span key={role} className="sp-pair"><dt>{ROLE_LABELS[role] ?? role}</dt><dd>{c.active} {c.active === 1 ? 'activo' : 'activos'}{c.inactive ? ` · ${c.inactive} ${c.inactive === 1 ? 'inactivo' : 'inactivos'}` : ''}</dd></span>
            ))}
            <dt>Deben elegir su contraseña</dt><dd>{s.users.pending_password_change}</dd>
            <dt>Sin código de recuperación</dt><dd>{s.users.without_recovery_code}</dd>
          </dl>
          {s.users.locked_emails.length > 0 && (
            <Notice tone="pending" title="Bloqueados ahora por intentos fallidos">
              {s.users.locked_emails.join(', ')}. Se desbloquean solos a los 15 minutos, o al resetear su contraseña en Usuarios.
            </Notice>
          )}
          <Button variant="secondary" icon="people" href="/usuarios" onClick={go('/usuarios')}>Ir a Usuarios</Button>
        </Panel>

        <Panel title="Datos (solo totales)" icon="box-seam">
          <dl className="sp-list">
            <dt>Productos</dt><dd>{s.totals.products_active} {s.totals.products_active === 1 ? 'activo' : 'activos'} · {s.totals.products_inactive} {s.totals.products_inactive === 1 ? 'inactivo' : 'inactivos'}</dd>
            <dt>Movimientos</dt><dd>{s.totals.movements} · {s.totals.movements_pending} pendientes</dd>
            <dt>Último movimiento</dt><dd>{s.totals.last_movement_at ? fmtDateTime(s.totals.last_movement_at) : '—'}</dd>
            <dt>Alertas de stock activas</dt><dd>{s.totals.alerts_active}</dd>
            <dt>Préstamos abiertos</dt><dd>{s.totals.loans_open}</dd>
          </dl>
          <p className="bd-muted" style={{ margin: 0 }}>Soporte no ve el detalle de la bodega: solo estas cifras, para revisar que el sistema se usa con normalidad.</p>
        </Panel>
      </div>
    </>
  )
}
