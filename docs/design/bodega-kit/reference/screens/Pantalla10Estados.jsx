// @card height=820 width=1760 subtitle="Cargando, lista vacía, error de conexión y la vista Solo lectura (sin botones de escritura)."
import { B, Frame, Shell, OPER, LECT, PRODUCTS, render } from './_kit.jsx';
const { PageHeader, Panel, DataTable, Button, ConnectionError, StockMeter, StatusBadge, FilterBar, SearchInput, Chip, CodeTag, Notice } = B;
const cols = [
  { key: 'name', header: 'Producto', mobile: 'title', render: r => <span className="bd-cell-title">{r.name}</span> },
  { key: 'stock', header: 'Stock', mobile: 'wide', render: r => <StockMeter current={r.stock} min={r.min} max={r.max} unit={r.unit} /> },
];
const H = 760;
const loading = <Shell user={OPER} current="productos"><PageHeader title="Productos" /><Panel flush><DataTable columns={cols} state="loading" loadingLabel="Cargando productos…" /></Panel></Shell>;
const empty = <Shell user={OPER} current="movimientos"><PageHeader title="Mis solicitudes" /><Panel flush><FilterBar><SearchInput defaultValue="OT-9999" /><div className="bd-filter-scroll"><Chip pressed icon="hourglass-split">Pendientes</Chip></div></FilterBar>
  <DataTable columns={cols} state="empty" empty={{ icon: 'search', title: 'Sin resultados para “OT-9999”', text: 'No tienes solicitudes pendientes con esa orden de trabajo.', action: <Button variant="secondary" size="lg" icon="x-lg">Quitar filtros</Button> }} /></Panel></Shell>;
const offline = <Shell user={OPER} current="prestamos" banner={<ConnectionError variant="banner" />}><PageHeader title="Préstamos" /><Panel flush><DataTable columns={cols} state="error" /></Panel></Shell>;
const p = PRODUCTS[0];
const readonly = (
  <Shell user={LECT} current="productos">
    <PageHeader back="Productos" title="Rodamiento 6205-2RS" subtitle="ROD-0412 · SKF · A-03-2" actions={<StatusBadge status="solo-lectura" size="lg" />} />
    <Panel title="Stock" icon="box-seam"><StockMeter current={p.stock} min={p.min} max={p.max} /></Panel>
    <Panel title="Datos" icon="file-earmark-text"><dl className="bd-dl"><div><dt>N.º de parte</dt><dd className="bd-mono">{p.part}</dd></div><div><dt>Categoría</dt><dd>{p.cat}</dd></div><div><dt>Ubicación</dt><dd className="bd-mono">{p.loc}</dd></div><div><dt>Lote</dt><dd>No requiere</dd></div></dl></Panel>
    <Notice tone="info" icon="eye">Tu rol solo permite consultar. Las acciones de editar, desactivar y solicitar no se muestran.</Notice>
  </Shell>
);
render(
  <div className="pv-devices">
    <Frame label="Cargando" width={390} height={H}>{loading}</Frame>
    <Frame label="Lista vacía" role="filtro sin resultados" width={390} height={H}>{empty}</Frame>
    <Frame label="Sin conexión" width={390} height={H}>{offline}</Frame>
    <Frame label="Solo lectura" width={390} height={H}>{readonly}</Frame>
  </div>
);
