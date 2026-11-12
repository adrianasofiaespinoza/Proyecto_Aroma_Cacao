// @card height=900 width=1760 subtitle="El Coordinador revisa. Autorizar confirma el efecto en stock; rechazar exige motivo."
import { B, Devices, Shell, COORD, render } from './_kit.jsx';
const { PageHeader, Panel, StatusBadge, TypeTag, CodeTag, Button, Notice, MovementFlow, StockImpact, ConfirmDialog, Field, Textarea } = B;
function Review() {
  return (
    <>
      <PageHeader back="Movimientos" title={<span className="rv-title">Revisar <CodeTag>MOV-0142</CodeTag></span>} subtitle="Solicitado por Luis Cedeño · hoy 08:12"
        actions={<StatusBadge status="pendiente" explain size="lg" />} />
      <div className="rv-band bd-hatch"><span>Esta salida <b>todavía no se aplicó al stock</b>. Solo se descuenta cuando la autorices.</span></div>
      <div className="bd-split">
        <Panel title="Solicitud" icon="file-earmark-text">
          <div className="bd-stack">
            <dl className="bd-dl">
              <div><dt>Tipo</dt><dd><TypeTag type="salida" /></dd></div>
              <div><dt>Orden de trabajo</dt><dd className="bd-mono">OT-3381</dd></div>
              <div><dt>Máquina destino</dt><dd>T-01 · Tostador continuo</dd></div>
              <div><dt>Solicitante</dt><dd>Luis Cedeño</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt>Motivo</dt><dd>Cambio de rodamiento del tostador, lado motor. Ruido y temperatura alta en la ronda de las 07:00.</dd></div>
            </dl>
            <div className="rv-line">
              <div><b>Rodamiento rígido de bolas 6205-2RS</b><div className="bd-cell-sub"><CodeTag>ROD-0412</CodeTag> · A-03-2 · sin lote</div></div>
              <div className="rv-qty"><small>Cantidad</small><b>2 u.</b></div>
              <StockImpact before={4} after={2} status="pendiente" />
            </div>
            <Notice tone="danger" icon="exclamation-triangle-fill" title="Quedará bajo el mínimo">Tras la salida quedarán 2 u. (mínimo 10). Considera pedir una compra.</Notice>
          </div>
        </Panel>
        <Panel title="Estado" icon="clipboard-check">
          <div className="bd-stack"><MovementFlow status="pendiente" requested={{ by: 'L. Cedeño', at: '10/11 08:12' }} /></div>
        </Panel>
      </div>
      <div className="rv-actions"><Button variant="danger-outline" size="lg" icon="x-lg">Rechazar</Button><Button variant="ok" size="lg" icon="check-lg">Autorizar y aplicar al stock</Button></div>
    </>
  );
}
const confirm = (
  <ConfirmDialog contained tone="ok" icon="clipboard-check" title="¿Autorizar la salida MOV-0142?" confirmLabel="Sí, autorizar y aplicar" confirmIcon="check-lg"
    consequences={[['Producto', 'Rodamiento 6205-2RS'], ['Se descuentan', '2 u.'], ['Stock', '4 u. → 2 u.'], ['Destino', 'T-01 · OT-3381']]}>
    <p style={{ margin: 0 }}>El stock se actualizará en cuanto confirmes. Para revertirlo habrá que registrar una entrada o un ajuste.</p>
  </ConfirmDialog>
);
const reject = (
  <ConfirmDialog contained tone="danger" icon="x-octagon-fill" title="¿Rechazar MOV-0142?" confirmLabel="Rechazar solicitud" confirmIcon="x-lg"
    reason={<Field label="Motivo del rechazo" htmlFor="rr" required hint="Luis Cedeño lo verá en su solicitud."><Textarea id="rr" defaultValue="Usar el rodamiento del kit de mantenimiento preventivo que ya está en el tostador." /></Field>}>
    <p style={{ margin: 0 }}>El stock no cambia. La solicitud queda cerrada como Rechazada.</p>
  </ConfirmDialog>
);
render(<Devices desktop={<Shell user={COORD} current="movimientos" overlay={confirm}><Review /></Shell>} mobile={<Shell user={COORD} current="movimientos" overlay={reject}><Review /></Shell>} dRole="Confirmar autorización" mRole="Rechazar con motivo" />);
