// @card height=900 width=1760 subtitle="Filtros por tipo y estado. Pendiente lleva rayado y dice 'No aplicado al stock'."
import { B, Devices, Shell, COORD, OPER, MOVES, render } from './_kit.jsx';
const { PageHeader, Panel, DataTable, StatusBadge, TypeTag, CodeTag, Button, FilterBar, SearchInput, Chip, Segmented } = B;
const cols = [
  { key: 'id', header: 'Movimiento', mobile: 'subtitle', width: 190, render: r => <div className="mv-id"><TypeTag type={r.type} /><CodeTag>{r.id}</CodeTag><span className="bd-cell-sub bd-num">{r.date}</span></div> },
  { key: 'item', header: 'Detalle', mobile: 'title', render: r => <><div className="bd-cell-title">{r.item} · {r.qty}</div><div className="bd-cell-sub">{r.lot !== '—' ? 'Lote ' + r.lot : ''}{r.machine !== '—' ? '→ ' + r.machine : ''}</div></> },
  { key: 'reason', header: 'Motivo / OT', mobile: 'wide', mobileLabel: 'Motivo', render: r => <><div>{r.reason}</div>{r.ot !== '—' && <div className="bd-cell-sub bd-mono">{r.ot}</div>}</> },
  { key: 'by', header: 'Solicitó / Autorizó', mobile: 'meta', mobileLabel: 'Solicitó', render: r => <><div>{r.by}</div><div className="bd-cell-sub bd-hide-m">{r.auth === '—' ? 'Sin revisar' : r.auth}</div></> },
  { key: 'status', header: 'Estado', mobile: 'badge', render: r => <StatusBadge status={r.status} explain /> },
];
const tone = r => r.status === 'pendiente' ? 'pending' : null;
const filters = (m) => (
  <FilterBar>
    <SearchInput placeholder="Buscar por código, producto u OT" />
    <div className="bd-filter-scroll"><span className="bd-filter-label bd-hide-m" style={{ alignSelf: 'center' }}>Tipo</span>
      <Chip pressed>Todos</Chip><Chip icon="box-arrow-in-down">Entrada</Chip><Chip icon="box-arrow-up">Salida</Chip><Chip icon="sliders">Ajuste</Chip></div>
    {!m && <span className="bd-filter-label">Estado</span>}
    <Segmented label="Estado" value="todos" options={[{ value: 'pendiente', label: 'Pendientes', icon: 'hourglass-split' }, { value: 'autorizado', label: 'Autorizados', icon: 'check-circle-fill' }, { value: 'rechazado', label: 'Rechazados', icon: 'x-octagon-fill' }, { value: 'todos', label: 'Todos' }].filter(o => !m || o.value !== 'todos')} />
  </FilterBar>
);
const desktop = (
  <Shell user={COORD} current="movimientos">
    <PageHeader title="Movimientos" subtitle="Noviembre 2026 · 3 pendientes de autorizar" actions={<Button variant="primary" icon="plus-lg">Nueva solicitud</Button>} />
    <Panel flush>
      {filters()}
      <DataTable columns={cols} rows={MOVES} rowTone={tone} caption="Movimientos"
        actions={r => r.status === 'pendiente' ? <Button size="sm" variant="secondary" iconRight="chevron-right">Revisar</Button> : <Button size="sm" variant="ghost">Ver</Button>} />
    </Panel>
  </Shell>
);
const mobile = (
  <Shell user={OPER} current="movimientos">
    <PageHeader title="Mis solicitudes" actions={<Button variant="primary" size="xl" icon="plus-lg">Nueva solicitud</Button>} />
    <Panel flush>{filters(true)}<DataTable columns={cols} rows={MOVES.filter(m => m.by === 'Luis Cedeño' || m.id === 'MOV-0138')} rowTone={tone} /></Panel>
  </Shell>
);
render(<Devices desktop={desktop} mobile={mobile} dRole="Coordinador" mRole="Operador" />);
