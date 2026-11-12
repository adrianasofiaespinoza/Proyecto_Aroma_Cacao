// @card height=820 width=1760 subtitle="Empresa, RUC, contacto y productos que ofrece con precio de referencia."
import { B, Devices, Shell, COORD, LECT, SUPPLIERS, render } from './_kit.jsx';
const { PageHeader, Panel, DataTable, CodeTag, Button, IconButton, FilterBar, SearchInput } = B;
const offer = [
  { id: 1, code: 'ROD-0412', name: 'Rodamiento 6205-2RS', price: '$ 8,40', unit: 'u.', upd: '02/10/2026' },
  { id: 2, code: 'ROD-0415', name: 'Rodamiento 6206-2RS', price: '$ 10,95', unit: 'u.', upd: '02/10/2026' },
  { id: 3, code: 'ROD-0501', name: 'Chumacera UCP 207', price: '$ 24,30', unit: 'u.', upd: '18/08/2026' },
  { id: 4, code: 'LUB-0021', name: 'Grasa grado alimenticio H1', price: '$ 31,00', unit: 'kg', upd: '18/08/2026' },
];
const offerCols = [
  { key: 'name', header: 'Producto', mobile: 'title', render: r => <><div className="bd-cell-title">{r.name}</div><div className="bd-cell-sub bd-mono">{r.code}</div></> },
  { key: 'price', header: 'Precio ref.', align: 'right', mobile: 'meta', render: r => <b className="bd-num">{r.price} <span className="bd-cell-sub">/ {r.unit}</span></b> },
  { key: 'upd', header: 'Actualizado', mobile: 'meta', render: r => <span className="bd-num">{r.upd}</span> },
];
const Detail = ({ m }) => (
  <Panel title="Rodamientos del Pacífico S.A." icon="building" flush>
    <div className="pv-sup">
      <dl className="bd-dl">
        <div><dt>RUC</dt><dd className="bd-mono">0991234567001</dd></div>
        <div><dt>Contacto</dt><dd>Ing. Carla Solórzano</dd></div>
        <div><dt>Teléfono</dt><dd className="bd-num">04 259 1180</dd></div>
        <div><dt>Correo</dt><dd>ventas@rodapacifico.ec</dd></div>
        <div style={{ gridColumn: '1 / -1' }}><dt>Dirección</dt><dd>Av. Juan Tanca Marengo km 2, Guayaquil</dd></div>
      </dl>
      {m && <div className="pv-sup-call"><Button variant="secondary" size="lg" icon="telephone" as="a" href="tel:042591180">Llamar</Button><Button variant="secondary" size="lg" icon="envelope" as="a" href="mailto:ventas@rodapacifico.ec">Escribir</Button></div>}
    </div>
    <DataTable columns={offerCols} rows={offer} caption="Productos que ofrece" />
    <p className="pv-sup-note">Precios de referencia en USD sin IVA. Se usan para estimar; no generan órdenes de compra.</p>
  </Panel>
);
const desktop = (
  <Shell user={COORD} current="proveedores">
    <PageHeader title="Proveedores" subtitle="18 proveedores activos" actions={<Button variant="primary" icon="plus-lg">Nuevo proveedor</Button>} />
    <div className="bd-split">
      <Panel flush>
        <FilterBar><SearchInput placeholder="Buscar por empresa, RUC o producto" /></FilterBar>
        <DataTable rows={SUPPLIERS} rowTone={r => r.id === 1 ? 'selected' : null} caption="Proveedores"
          columns={[
            { key: 'name', header: 'Empresa', render: r => <><div className="bd-cell-title">{r.name}</div><div className="bd-cell-sub bd-mono">{r.ruc}</div></> },
            { key: 'contact', header: 'Contacto', render: r => <><div>{r.contact}</div><div className="bd-cell-sub bd-num">{r.phone}</div></> },
            { key: 'products', header: 'Productos', align: 'right', render: r => <b className="bd-num">{r.products}</b> },
          ]} actions={() => <IconButton icon="pencil" label="Editar proveedor" />} />
      </Panel>
      <Detail />
    </div>
  </Shell>
);
const mobile = <Shell user={LECT} current="proveedores"><PageHeader back="Proveedores" title="Proveedor" /><Detail m /></Shell>;
render(<Devices height={760} desktop={desktop} mobile={mobile} dRole="Coordinador" mRole="Solo lectura" />);
