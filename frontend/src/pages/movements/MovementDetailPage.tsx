import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuthorizeMovement, useMovement, useRejectMovement } from '../../api/hooks'
import { useInventory } from '../../api/useInventory'
import { useSessionUser } from '../../app/AuthProvider'
import {
  Button, CodeTag, ConfirmDialog, ConnectionError, LoadingRows, MovementFlow, Notice, PageHeader, Panel, StatusBadge, StockImpact, TypeTag, useToast,
} from '../../components/ui'
import { TYPE_LABEL, isLowStock } from '../../lib/domain'
import { describeError, isApiError, isConnectionError } from '../../lib/errors'
import { fmtDateTime, fmtQty, fmtRelative, shortName } from '../../lib/format'
import { can } from '../../lib/permissions'
import { machineLabel, movementView, type MovementLineView } from './movementView'

type Dialog = 'authorize' | 'reject' | null

export function MovementDetailPage() {
  const { id } = useParams()
  const movementId = Number(id)
  const user = useSessionUser()
  const navigate = useNavigate()
  const toast = useToast()
  const inv = useInventory()
  const movement = useMovement(movementId)
  const authorize = useAuthorizeMovement()
  const reject = useRejectMovement()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [authError, setAuthError] = useState<ReturnType<typeof describeError> | null>(null)
  /** Stock antes de autorizar, para mostrar el antes → después real. */
  const [applied, setApplied] = useState<{ before: number; after: number; unit: string } | null>(null)

  if (movement.isLoading || inv.isLoading) return <Panel flush><LoadingRows rows={3} label="Cargando la solicitud…" /></Panel>
  if (movement.isError || !movement.data) {
    if (isConnectionError(movement.error)) return <Panel flush><ConnectionError onRetry={() => void movement.refetch()} /></Panel>
    return <Notice tone="danger" title="No se encontró la solicitud">Puede que el enlace esté mal o que la solicitud ya no exista. <Button size="sm" variant="secondary" onClick={() => navigate('/movimientos')}>Volver a movimientos</Button></Notice>
  }

  const v = movementView(inv, movement.data)
  const reviewer = can(user.role, 'autorizar')
  const pending = v.status === 'pendiente'
  const first = v.first
  const blocked = v.lines.some((l) => l.blocked) || authError?.code?.startsWith('STOCK_INSUFICIENTE') === true
  const typeLabel = TYPE_LABEL[v.type]
  const article = v.type === 'ajuste' ? 'el ajuste' : `la ${typeLabel.toLowerCase()}`

  const doAuthorize = async () => {
    setAuthError(null)
    try {
      const before = first ? first.before : 0
      await authorize.mutateAsync(v.m.id)
      setDialog(null)
      if (first) {
        setApplied({ before, after: first.after, unit: first.unit })
        toast.ok(<><b>{typeLabel} autorizada.</b> El stock de {first.product?.name ?? 'el producto'} {first.after > before ? 'subió' : first.after < before ? 'bajó' : 'quedó'} de {fmtQty(before, first.unit)} a {fmtQty(first.after, first.unit)}.</>)
      } else toast.ok(<b>{typeLabel} autorizada.</b>)
    } catch (err) {
      setDialog(null)
      setAuthError({ ...describeError(err), code: isApiError(err) ? err.codeLabel : undefined })
    }
  }

  const doReject = async () => {
    try {
      await reject.mutateAsync(v.m.id)
      setDialog(null)
      toast.ok(<><b>Solicitud rechazada.</b> El stock no cambió.</>)
    } catch (err) {
      setDialog(null)
      const d = describeError(err)
      toast.danger(<><b>{d.title}</b> {d.message}</>)
    }
  }

  const lineBlock = (l: MovementLineView) => (
    <div className="rv-line" key={l.detail.id}>
      <div>
        <b>{l.product?.name ?? `Producto ${l.detail.product_id}`}</b>
        <div className="bd-cell-sub">
          {l.product && <CodeTag>{l.product.internal_code}</CodeTag>}
          {l.product?.physical_location ? ` · ${l.product.physical_location}` : ''}
          {l.lot ? ` · lote ${l.lot.lot_number}` : l.product?.requires_lot ? '' : ' · sin lote'}
          {l.machine ? ` → ${machineLabel(l.machine)}` : ''}
        </div>
      </div>
      <div className="rv-qty"><small>{v.type === 'ajuste' ? 'Contado' : 'Cantidad'}</small><b className="bd-num">{fmtQty(l.qty, l.unit)}</b></div>
      {pending ? (
        <StockImpact before={l.before} after={l.after} unit={l.unit} status="pendiente" blocked={l.blocked} label={v.type === 'salida' ? 'Disponible' : v.type === 'ajuste' ? (l.lot ? 'En el lote' : 'En sistema') : 'Stock actual'} />
      ) : v.status === 'autorizado' && applied ? (
        <StockImpact before={applied.before} after={applied.after} unit={applied.unit} status="autorizado" />
      ) : v.status === 'rechazado' ? (
        <StockImpact before={l.before} after={l.after} unit={l.unit} status="rechazado" label={v.type === 'salida' ? 'Disponible' : 'Stock'} />
      ) : (
        <div className="bd-muted" style={{ gridColumn: '1 / -1' }}>Stock actual del producto: <b className="bd-num">{fmtQty(l.product?.current_stock, l.unit)}</b></div>
      )}
    </div>
  )

  const subtitle = pending
    ? `Solicitado por ${v.m.requesting_user_name ?? '—'} · ${fmtRelative(v.m.date)}`
    : `${typeLabel} · ${v.summary}${first?.machine ? ` → ${first.machine.identification_code}` : ''}`

  return (
    <>
      <PageHeader
        back="Movimientos"
        backTo="/movimientos"
        title={<span className="rv-title">{pending && reviewer ? 'Revisar ' : ''}<CodeTag>{v.code}</CodeTag></span>}
        subtitle={subtitle}
        actions={<StatusBadge status={v.status} explain size="lg" />}
      />

      {authError && (
        <Notice tone="danger" title={authError.title} code={authError.code} actions={reviewer && pending ? <Button variant="danger" icon="x-lg" onClick={() => setDialog('reject')}>Rechazar solicitud</Button> : undefined}>
          {authError.message}{blocked ? ' No se autorizó y el stock no cambió. Rechaza la solicitud y pide una nueva por la cantidad disponible.' : ''}
        </Notice>
      )}
      {pending && !authError && blocked && reviewer && (
        <Notice tone="danger" title="La salida supera lo disponible" actions={<Button variant="danger" icon="x-lg" onClick={() => setDialog('reject')}>Rechazar solicitud</Button>}>
          {first && `Se pidieron ${fmtQty(first.qty, first.unit)} de ${first.product?.name ?? 'el producto'} y hay ${fmtQty(first.before, first.unit)} disponibles.`} Una salida mayor a lo disponible siempre se rechaza.
        </Notice>
      )}
      {pending && !blocked && (
        <div className="rv-band bd-hatch">
          <span>Esta {v.type === 'ajuste' ? 'solicitud de ajuste' : typeLabel.toLowerCase()} <b>todavía no se aplicó al stock</b>. {reviewer ? `Solo se ${v.type === 'entrada' ? 'suma' : v.type === 'salida' ? 'descuenta' : 'aplica'} cuando la autorices.` : 'Esperando la revisión del coordinador.'}</span>
        </div>
      )}
      {v.status === 'rechazado' && (
        <Notice tone="danger" icon="x-octagon-fill" title={`Rechazada${v.m.authorizing_user_name ? ` por ${shortName(v.m.authorizing_user_name)}` : ''}`}>
          El stock no cambió. Si hace falta, crea una solicitud nueva con la cantidad correcta.
        </Notice>
      )}

      <div className="bd-split">
        <Panel title="Solicitud" icon="file-earmark-text">
          <div className="bd-stack">
            <dl className="bd-dl">
              <div><dt>Tipo</dt><dd><TypeTag type={v.type} /></dd></div>
              <div><dt>Orden de trabajo</dt><dd className="bd-mono">{v.m.work_order_number || '—'}</dd></div>
              {v.type === 'salida' && <div><dt>Máquina destino</dt><dd>{machineLabel(first?.machine)}</dd></div>}
              <div><dt>Solicitante</dt><dd>{v.m.requesting_user_name ?? '—'}</dd></div>
              <div><dt>Fecha</dt><dd className="bd-num">{fmtDateTime(v.m.date)}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt>Motivo</dt><dd>{v.m.reason || <span className="bd-muted">Sin motivo</span>}</dd></div>
            </dl>
            {v.lines.map(lineBlock)}
            {pending && v.lines.filter((l) => l.belowMin && !l.blocked).map((l) => (
              <Notice key={l.detail.id} tone="danger" icon="exclamation-triangle-fill" title="Quedará bajo el mínimo">
                Tras {article} quedarán {fmtQty(l.after, l.unit)} (mínimo {fmtQty(l.product?.minimum_stock, l.unit)}). Considera pedir una compra.
              </Notice>
            ))}
          </div>
        </Panel>
        <Panel title="Estado" icon="clipboard-check">
          <div className="bd-stack">
            <MovementFlow
              status={v.status}
              requested={{ by: shortName(v.m.requesting_user_name), at: fmtDateTime(v.m.date) }}
              reviewed={{ by: shortName(v.m.authorizing_user_name), reason: v.status === 'rechazado' ? 'Stock sin cambios' : undefined }}
            />
          </div>
        </Panel>
      </div>

      {v.status === 'autorizado' && first?.product && isLowStock(first.product) && can(user.role, 'solicitar') && (
        <Panel title="Siguiente paso" icon="info-circle-fill">
          <div className="bd-row">
            <span>El producto quedó bajo el mínimo ({fmtQty(first.product.minimum_stock, first.unit)}).</span>
            <Button variant="secondary" icon="box-arrow-in-down" onClick={() => navigate(`/movimientos/nueva?tipo=entrada&producto=${first.product?.id}`)}>Pedir entrada</Button>
          </div>
        </Panel>
      )}
      {v.status === 'rechazado' && can(user.role, 'solicitar') && first?.product && (
        <Button variant="primary" size="xl" block icon="arrow-repeat" onClick={() => navigate(`/movimientos/nueva?tipo=${v.type}&producto=${first.product?.id}`)}>Crear una nueva solicitud</Button>
      )}

      {pending && reviewer && (
        <div className="rv-actions">
          <Button variant="danger-outline" size="lg" icon="x-lg" onClick={() => setDialog('reject')}>Rechazar</Button>
          <Button variant="ok" size="lg" icon="check-lg" disabled={blocked} onClick={() => setDialog('authorize')}>Autorizar y aplicar al stock</Button>
        </div>
      )}

      {dialog === 'authorize' && first && (
        <ConfirmDialog
          tone="ok"
          icon="clipboard-check"
          title={`¿Autorizar ${article} ${v.code}?`}
          confirmLabel="Sí, autorizar y aplicar"
          confirmIcon="check-lg"
          loading={authorize.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => void doAuthorize()}
          consequences={[
            ['Producto', first.product?.name ?? '—'],
            [v.type === 'entrada' ? 'Se suman' : v.type === 'salida' ? 'Se descuentan' : 'Contado', fmtQty(first.qty, first.unit)],
            [v.type === 'salida' ? 'Disponible' : 'Stock', `${fmtQty(first.before, first.unit)} → ${fmtQty(first.after, first.unit)}`],
            ...(first.machine || v.m.work_order_number ? [['Destino', [first.machine?.identification_code, v.m.work_order_number].filter(Boolean).join(' · ')] as [string, string]] : []),
            ...(v.lines.length > 1 ? [['Líneas', `${v.lines.length} productos`] as [string, string]] : []),
          ]}
        >
          <p style={{ margin: 0 }}>El stock se actualizará en cuanto confirmes. Para revertirlo habrá que registrar {v.type === 'entrada' ? 'una salida' : 'una entrada'} o un ajuste.</p>
        </ConfirmDialog>
      )}
      {dialog === 'reject' && (
        <ConfirmDialog
          tone="danger"
          icon="x-octagon-fill"
          title={`¿Rechazar ${v.code}?`}
          confirmLabel="Sí, rechazar"
          confirmIcon="x-lg"
          loading={reject.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => void doReject()}
        >
          <p style={{ margin: 0 }}>El stock no cambia. La solicitud queda cerrada como Rechazada y {v.m.requesting_user_name ?? 'quien la pidió'} la verá así en su lista.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
