// @card height=820 width=1760 subtitle="Máquinas de planta y sus repuestos compatibles."
import { B, Devices, Shell, COORD, OPER, MACHINES, PRODUCTS, render } from './_kit.jsx';
const { PageHeader, Panel, DataTable, CodeTag, Button, IconButton, StockMeter, FilterBar, SearchInput, StatusBadge } = B;
const parts = PRODUCTS.filter(p => [1, 2, 3, 5, 6].includes(p.id));
const partCols = [
  { key: 'name', header: 'Repuesto', mobile: 'title', render: r => <><div className="bd-cell-title">{r.name}</div><div className="bd-cell-sub"><span className="bd-mono">{r.code}</span> · {r.part}</div></> },
  { key: 'stock', header: 'Stock', width: 160, mobile: 'wide', render: r => <StockMeter current={r.stock} min={r.min} max={r.max} unit={r.unit} compact /> },
  { key: 'st', header: '', mobile: 'badge', render: r => r.stock <= r.min ? <StatusBadge status="stock-bajo" /> : null },
];
const desktop = (
  <Shell user={COORD} current="maquinas">
    <PageHeader title="Máquinas" subtitle="27 máquinas en 4 naves" actions={<Button variant="primary" icon="plus-lg">Nueva máquina</Button>} />
    <div className="mq-split">
      <Panel flush>
        <FilterBar><SearchInput placeholder="Buscar por nombre o código" /></FilterBar>
        <DataTable rows={MACHINES} rowTone={r => r.id === 1 ? 'selected' : null} caption="Máquinas"
          columns={[
            { key: 'code', header: 'Código', render: r => <CodeTag>{r.code}</CodeTag> },
            { key: 'name', header: 'Nombre', render: r => <span className="bd-cell-title">{r.name}</span> },
            { key: 'loc', header: 'Ubicación en planta' },
            { key: 'parts', header: 'Repuestos', align: 'right', render: r => <b className="bd-num">{r.parts}</b> },
          ]} actions={() => <IconButton icon="pencil" label="Editar" />} />
      </Panel>
      <Panel title="T-01 · Tostador continuo" icon="gear-wide-connected" count="Nave 1 · Tostado" flush actions={<Button size="sm" variant="secondary" icon="plus-lg">Vincular repuesto</Button>}>
        <DataTable columns={partCols} rows={parts} rowTone={r => r.stock <= r.min ? 'danger' : null} caption="Repuestos compatibles" />
      </Panel>
    </div>
  </Shell>
);
const mobile = (
  <Shell user={OPER} current="maquinas">
    <PageHeader back="Máquinas" title="Tostador continuo" subtitle="T-01 · Nave 1 · Tostado · 14 repuestos" />
    <Panel title="Repuestos compatibles" icon="box-seam" flush>
      <DataTable columns={partCols} rows={parts} rowTone={r => r.stock <= r.min ? 'danger' : null} mobileActions={() => <Button variant="secondary" icon="box-arrow-up">Pedir salida</Button>} />
    </Panel>
  </Shell>
);
render(<Devices height={760} desktop={desktop} mobile={mobile} dRole="Coordinador" mRole="Operador" />);
