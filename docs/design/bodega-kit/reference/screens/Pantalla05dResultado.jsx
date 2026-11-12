// @card height=820 width=1760 subtitle="Después de revisar: Autorizado (aplicado al stock) y Rechazado (sin efecto)."
import { B, Devices, Shell, COORD, OPER, render } from './_kit.jsx';
const { PageHeader, Panel, StatusBadge, CodeTag, TypeTag, MovementFlow, StockImpact, Toast, Notice, Button } = B;
const authorized = (
  <Shell user={COORD} current="movimientos">
    <div className="rs-toast"><Toast tone="ok" onClose={() => {}}><b>Salida autorizada.</b> El stock de Rodamiento 6205-2RS bajó de 4 a 2 u.</Toast></div>
    <PageHeader back="Movimientos" title={<span className="rs-title">MOV-0142</span>} subtitle="Salida · Rodamiento 6205-2RS · 2 u. → T-01" actions={<StatusBadge status="autorizado" explain size="lg" />} />
    <Panel title="Estado" icon="clipboard-check"><div className="bd-stack">
      <MovementFlow status="autorizado" requested={{ by: 'L. Cedeño', at: '10/11 08:12' }} reviewed={{ by: 'M. Andrade', at: '10/11 09:41' }} />
      <StockImpact before={4} after={2} status="autorizado" />
    </div></Panel>
    <Panel title="Siguiente paso" icon="info-circle-fill"><div className="bd-row"><span>El producto quedó bajo el mínimo (10 u.).</span><Button variant="secondary" icon="box-arrow-in-down">Pedir entrada</Button></div></Panel>
  </Shell>
);
const rejected = (
  <Shell user={OPER} current="movimientos">
    <PageHeader back="Mis solicitudes" title={<span className="rs-title">MOV-0138</span>} subtitle="Salida · Banda en V B-52 · 4 u." actions={<StatusBadge status="rechazado" explain size="lg" />} />
    <Notice tone="danger" icon="x-octagon-fill" title="Rechazada por M. Andrade">“Solo hay 2 bandas. Pide 2 ahora y el resto cuando llegue la compra OC-1191.”</Notice>
    <Panel title="Estado" icon="clipboard-check"><div className="bd-stack">
      <MovementFlow status="rechazado" requested={{ by: 'D. Mero', at: '08/11 15:47' }} reviewed={{ by: 'M. Andrade', at: '08/11 16:02', reason: 'Stock sin cambios' }} />
      <StockImpact before={2} after={-2} status="rechazado" label="Stock" />
    </div></Panel>
    <Button variant="primary" size="xl" block icon="arrow-repeat">Crear una nueva con 2 u.</Button>
  </Shell>
);
render(<Devices height={760} desktop={authorized} mobile={rejected} dRole="Coordinador · autorizado" mRole="Operador · rechazado" />);
