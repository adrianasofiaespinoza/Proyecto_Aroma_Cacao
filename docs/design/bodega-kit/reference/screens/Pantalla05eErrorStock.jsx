// @card height=820 width=1760 subtitle="Error del servidor legible: 'La salida supera lo disponible'. Esa salida siempre se rechaza."
import { B, Devices, Shell, COORD, OPER, render } from './_kit.jsx';
const { PageHeader, Panel, StatusBadge, CodeTag, Notice, Button, StockImpact, Field, QuantityStepper, Textarea, Icon } = B;
const desktop = (
  <Shell user={COORD} current="movimientos">
    <PageHeader back="Movimientos" title={<span style={{ fontFamily: 'var(--font-mono)' }}>MOV-0138</span>} subtitle="Salida · solicitada por Diana Mero · 08/11 15:47" actions={<StatusBadge status="pendiente" explain size="lg" />} />
    <Notice tone="danger" title="La salida supera lo disponible" code="STOCK_INSUFICIENTE · 409"
      actions={<><Button variant="danger" icon="x-lg">Rechazar solicitud</Button></>}>
      Se pidieron 4 u. de Banda en V B-52 y en bodega hay 2 u. No se autorizó y el stock no cambió. Rechaza la solicitud y pide al técnico una nueva por 2 u.
    </Notice>
    <Panel title="Línea de la solicitud" icon="box-seam">
      <div className="er-line">
        <div><b>Banda en V clásica B-52</b><div className="bd-cell-sub"><CodeTag>BAN-0107</CodeTag> · B-01-1 → D-02 Descascarilladora</div></div>
        <StockImpact before={2} after={-2} status="pendiente" blocked label="Disponible" />
      </div>
    </Panel>
    <div className="er-actions"><Button variant="ok" size="lg" icon="check-lg" disabled>Autorizar y aplicar al stock</Button></div>
  </Shell>
);
const mobile = (
  <Shell user={OPER} current="movimientos">
    <PageHeader back="Movimientos" title="Nueva solicitud" subtitle="Salida · Banda en V B-52" />
    <Notice tone="danger" title="La salida supera lo disponible" code="STOCK_INSUFICIENTE">Hay 2 u. en bodega y pediste 4 u. La solicitud no se envió. Baja la cantidad a 2 u. o menos.</Notice>
    <Field label="Cantidad" htmlFor="qe" required error="Máximo disponible: 2 u."><QuantityStepper id="qe" defaultValue={4} /></Field>
    <Field label="Motivo" htmlFor="re" required><Textarea id="re" defaultValue="Repuesto para descascarilladora" /></Field>
    <Button variant="primary" size="xl" block icon="send">Enviar solicitud</Button>
  </Shell>
);
render(<Devices height={760} desktop={desktop} mobile={mobile} dRole="Coordinador · al intentar autorizar" mRole="Operador · al enviar" />);
