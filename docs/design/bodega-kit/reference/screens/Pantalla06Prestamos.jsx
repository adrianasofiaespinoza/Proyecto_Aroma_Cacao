// @card height=900 width=1760 subtitle="Herramientas prestadas a trabajadores sin cuenta. Disponible = stock − prestado."
import { B, Devices, Shell, OPER, LOANS, render } from './_kit.jsx';
const { PageHeader, Panel, DataTable, StatusBadge, CodeTag, Button, Field, TextInput, Select, QuantityStepper, Segmented, FilterBar, SearchInput, ConfirmDialog, Notice } = B;
const avail = r => <span className="pr-avail"><b>{r.stock - r.lent}</b> de {r.stock}<span className="bd-cell-sub"><br />{r.stock} − {r.lent} prestada{r.lent === 1 ? '' : 's'}</span></span>;
const cols = [
  { key: 'tool', header: 'Herramienta', width: '34%', mobile: 'title', render: r => <><div className="bd-cell-title">{r.tool}</div><div className="bd-cell-sub"><span className="bd-mono">{r.code}</span> · {r.qty} u.</div></> },
  { key: 'worker', header: 'Trabajador', mobile: 'wide' },
  { key: 'avail', header: 'Disponible', mobile: 'meta', render: avail },
  { key: 'out', header: 'Prestado / devuelto', mobile: 'meta', mobileLabel: 'Prestado', render: r => <><div className="bd-num">{r.out}</div><div className="bd-cell-sub bd-num bd-hide-m">{r.back === '—' ? 'Sin devolver' : r.back}</div></> },
  { key: 'status', header: 'Estado', mobile: 'badge', render: r => <StatusBadge status={r.status} /> },
];
const tone = r => r.status === 'devuelto' ? 'muted' : null;
const list = (m) => (
  <Panel flush>
    <FilterBar><SearchInput placeholder="Buscar herramienta o trabajador" /><Segmented label="Estado" value="prestado" options={[{ value: 'prestado', label: 'Prestadas · 3' }, { value: 'devuelto', label: 'Devueltas' }, { value: 'todos', label: 'Todas' }]} /></FilterBar>
    <DataTable columns={cols} rows={LOANS} rowTone={tone} caption="Préstamos"
      actions={r => r.status === 'prestado' ? <Button size="sm" variant="secondary" icon="arrow-counterclockwise">Devolver</Button> : null}
      mobileActions={r => r.status === 'prestado' ? <Button variant="primary" icon="arrow-counterclockwise">Registrar devolución</Button> : null} />
  </Panel>
);
const desktop = (
  <Shell user={OPER} current="prestamos">
    <PageHeader title="Préstamos de herramientas" subtitle="3 herramientas fuera de bodega · la más antigua desde ayer 08:10" />
    <div className="pr-split">
      {list()}
      <Panel title="Nuevo préstamo" icon="tools">
        <div className="bd-stack">
          <Field label="Herramienta" htmlFor="h1" required><Select id="h1" options={['HER-0031 · Multímetro digital True RMS', 'HER-0012 · Torquímetro 1/2"']} /></Field>
          <div className="pr-calc"><div><small>Stock</small><b>3</b></div><span>−</span><div><small>Prestado</small><b>2</b></div><span>=</span><div className="pr-calc-res"><small>Disponible</small><b>1</b></div></div>
          <Field label="Trabajador" htmlFor="w1" required hint="Escribe el nombre completo. No necesita cuenta en el sistema."><TextInput id="w1" icon="person-badge" defaultValue="Kevin Bajaña (contratista Electromec)" /></Field>
          <div className="bd-form-grid">
            <Field label="Cantidad" htmlFor="c1" required hint="Máximo 1"><QuantityStepper id="c1" defaultValue={1} max={1} /></Field>
            <Field label="Fecha de préstamo" htmlFor="f1" required><TextInput id="f1" icon="calendar-event" defaultValue="10/11/2026 09:30" /></Field>
          </div>
          <Button variant="primary" size="lg" block icon="check-lg">Registrar préstamo</Button>
        </div>
      </Panel>
    </div>
  </Shell>
);
const sheet = (
  <ConfirmDialog contained tone="ok" icon="arrow-counterclockwise" title="¿Registrar la devolución?" confirmLabel="Sí, ya está en bodega" confirmIcon="check-lg"
    consequences={[['Herramienta', 'Torquímetro 1/2" · HER-0012'], ['Trabajador', 'Jorge Tomalá'], ['Devuelto', 'Hoy 09:32'], ['Disponible', '1 → 2 de 2']]}>
    <p style={{ margin: 0 }}>Confirma que la herramienta está físicamente en la bodega y en buen estado.</p>
  </ConfirmDialog>
);
const mobile = <Shell user={OPER} current="prestamos" overlay={sheet}><PageHeader title="Préstamos" actions={<Button variant="primary" size="xl" icon="plus-lg">Prestar herramienta</Button>} />{list(true)}</Shell>;
render(<Devices desktop={desktop} mobile={mobile} dRole="Operador" mRole="Operador · confirmar devolución" />);
