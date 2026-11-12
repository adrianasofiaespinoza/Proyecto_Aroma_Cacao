// @card height=900 width=1760 subtitle="Salida con motivo faltante (escritorio) y ajuste con conteo físico (móvil)."
import { B, Devices, Shell, OPER, render } from './_kit.jsx';
const { PageHeader, Panel, Field, TextInput, Select, Textarea, Button, Segmented, QuantityStepper, Notice, MovementFlow, StockImpact, CodeTag, Icon } = B;
const typeSel = v => <Segmented label="Tipo de movimiento" value={v} options={[{ value: 'entrada', label: 'Entrada', icon: 'box-arrow-in-down' }, { value: 'salida', label: 'Salida', icon: 'box-arrow-up' }, { value: 'ajuste', label: 'Ajuste', icon: 'sliders' }]} />;
const picked = (name, code, extra) => (
  <div className="ns-picked"><Icon name="box-seam" /><div><b>{name}</b><div className="bd-cell-sub"><CodeTag>{code}</CodeTag> {extra}</div></div><Button size="sm" variant="ghost">Cambiar</Button></div>
);
const desktop = (
  <Shell user={OPER} current="movimientos">
    <PageHeader back="Movimientos" title="Nueva solicitud" subtitle="Se enviará al coordinador para su revisión" />
    <div className="bd-split">
      <Panel title="Detalle" icon="file-earmark-text">
        <div className="bd-stack">
          <div className="ns-type">{typeSel('salida')}</div>
          <Field label="Producto" required>{picked('Rodamiento rígido de bolas 6205-2RS', 'ROD-0412', '· A-03-2 · disponible 4 u.')}</Field>
          <div className="bd-form-grid">
            <Field label="Cantidad" htmlFor="q1" required hint="Disponible: 4 u."><QuantityStepper id="q1" defaultValue={2} /></Field>
            <Field label="Máquina destino" htmlFor="m1" required><Select id="m1" options={['T-01 · Tostador continuo', 'D-02 · Descascarilladora', 'M-03 · Molino de licor']} /></Field>
            <Field label="Orden de trabajo" htmlFor="o1" optional><TextInput id="o1" className="bd-mono" defaultValue="OT-3381" /></Field>
          </div>
          <Field label="Motivo" htmlFor="r1" required error="Escribe el motivo: es obligatorio en salidas y ajustes."><Textarea id="r1" placeholder="Ej.: cambio preventivo del rodamiento lado motor" /></Field>
          <div className="ns-foot"><Button variant="secondary" size="lg">Cancelar</Button><Button variant="primary" size="lg" icon="send">Enviar solicitud</Button></div>
        </div>
      </Panel>
      <Panel title="Qué pasa al enviar" icon="info-circle-fill">
        <div className="bd-stack">
          <Notice tone="pending" title="Queda Pendiente">El stock no cambia hasta que el coordinador la autorice. Mientras tanto, los 2 u. siguen contando como disponibles.</Notice>
          <StockImpact before={4} after={2} status="pendiente" />
          <MovementFlow status="pendiente" requested={{ by: 'Tú', at: 'al enviar' }} />
        </div>
      </Panel>
    </div>
  </Shell>
);
const mobile = (
  <Shell user={OPER} current="movimientos">
    <PageHeader back="Movimientos" title="Nueva solicitud" />
    <div className="ns-type">{typeSel('ajuste')}</div>
    {picked('Grasa grado alimenticio H1', 'LUB-0021', '· C-02-1')}
    <Field label="Lote" htmlFor="l2" required><Select id="l2" options={['G-2410 · vence 28/11/2026 · 6 kg', 'G-2502 · vence 15/02/2027 · 10 kg']} /></Field>
    <Field label="Cantidad contada en bodega" htmlFor="q2" required hint="En el sistema: 19 kg · diferencia −1 kg"><QuantityStepper id="q2" defaultValue={18} unit="kg" /></Field>
    <Field label="Motivo" htmlFor="r2" required><Textarea id="r2" defaultValue="Conteo cíclico estante C-02. Falta 1 kg." /></Field>
    <StockImpact before={19} after={18} unit="kg" status="pendiente" label="En sistema" />
    <Button variant="primary" size="xl" block icon="send">Enviar solicitud</Button>
  </Shell>
);
render(<Devices desktop={desktop} mobile={mobile} dRole="Operador" mRole="Operador · ajuste" />);
