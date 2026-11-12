// @card height=900 width=1760 subtitle="Lista con búsqueda y filtros. Coordinador edita; Solo lectura no ve botones de escritura."
import { B, Devices, Shell, COORD, LECT, PRODUCTS, render } from './_kit.jsx';
const { PageHeader, Panel, DataTable, StockMeter, CodeTag, Button, IconButton, StatusBadge, FilterBar, SearchInput, Select, Segmented, Chip, Notice, RoleGate } = B;
const cols = [
  { key: 'code', header: 'Código', mobile: 'meta', render: r => <CodeTag>{r.code}</CodeTag> },
  { key: 'name', header: 'Producto · marca · modelo · n.º de parte', mobile: 'title', render: r => <><div className="bd-cell-title">{r.name}</div><div className="bd-cell-sub">{r.brand} · {r.model} · <span className="bd-mono">{r.part}</span>{r.lot ? ' · por lote' : ''}</div></> },
  { key: 'cat', header: 'Categoría', mobile: 'hidden', render: r => <><div>{r.cat}</div><div className="bd-cell-sub">{r.unit === 'u.' ? 'Unidad' : r.unit === 'kg' ? 'Kilogramo' : 'Litro'}</div></> },
  { key: 'loc', header: 'Ubicación', mobileLabel: 'Ubicación', render: r => <span className="bd-mono">{r.loc}</span> },
  { key: 'stock', header: 'Stock (mín–máx)', width: 170, mobile: 'wide', mobileLabel: 'Stock', render: r => <StockMeter current={r.stock} min={r.min} max={r.max} unit={r.unit} /> },
  { key: 'state', header: 'Estado', mobile: 'badge', render: r => r.stock <= r.min && r.active ? <StatusBadge status="stock-bajo" /> : <StatusBadge status={r.active ? 'activo' : 'inactivo'} /> },
];
const tone = r => !r.active ? 'muted' : r.stock <= r.min ? 'danger' : null;
function List({ role }) {
  const canEdit = role === 'coordinador';
  return (
    <Panel flush>
      <FilterBar>
        <SearchInput placeholder="Buscar por código, nombre, marca o n.º de parte" />
        <div className="bd-row"><span className="bd-filter-label bd-hide-m">Categoría</span><Select options={['Todas las categorías', 'Rodamientos', 'Transmisión', 'Lubricantes', 'Sellos', 'Filtros', 'Eléctricos']} aria-label="Categoría" /></div>
        <Segmented label="Estado" value="activos" options={[{ value: 'activos', label: 'Activos' }, { value: 'inactivos', label: 'Inactivos' }, { value: 'todos', label: 'Todos' }]} />
        <Chip icon="exclamation-triangle-fill" count={3}>Stock bajo</Chip>
      </FilterBar>
      <DataTable columns={cols} rows={PRODUCTS} rowTone={tone} caption="Productos"
        actions={canEdit ? r => <>
          {r.lot && <Button size="sm" variant="ghost" icon="layers">Lotes</Button>}
          <IconButton icon="pencil" label={'Editar ' + r.name} />
          {r.active ? <IconButton icon="power" label={'Desactivar ' + r.name} /> : <IconButton icon="arrow-counterclockwise" label={'Reactivar ' + r.name} />}
        </> : null}
        mobileActions={role === 'lectura' ? null : r => r.lot ? <Button variant="secondary" icon="layers">Ver lotes</Button> : null} />
    </Panel>
  );
}
const desktop = (
  <Shell user={COORD} current="productos">
    <PageHeader title="Productos" subtitle="212 activos · 3 con stock bajo · 14 inactivos" actions={<><Button variant="secondary" icon="upc-scan">Buscar por código</Button><RoleGate role="coordinador" action="administrar"><Button variant="primary" icon="plus-lg">Nuevo producto</Button></RoleGate></>} />
    <List role="coordinador" />
  </Shell>
);
const mobile = (
  <Shell user={LECT} current="productos">
    <PageHeader title="Productos" subtitle="212 activos · 3 con stock bajo" />
    <Notice tone="info" icon="eye" title="Acceso de solo lectura">Puedes consultar el inventario. Para pedir repuestos, habla con el coordinador.</Notice>
    <List role="lectura" />
  </Shell>
);
render(<Devices desktop={desktop} mobile={mobile} dRole="Coordinador" mRole="Solo lectura" />);
