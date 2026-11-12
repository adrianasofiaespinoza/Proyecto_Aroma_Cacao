// @card height=900 width=1760 subtitle="Crear y editar. El stock actual solo se ve. Desactivar pide confirmación."
import { B, Devices, Shell, COORD, render } from './_kit.jsx';
const { PageHeader, Panel, Field, TextInput, Select, Checkbox, Button, StatusBadge, Notice, ConfirmDialog, Textarea } = B;
function Form({ m }) {
  const id = k => k + (m ? 'm' : 'd');
  return (
    <>
      <PageHeader back="Productos" title="Editar producto" subtitle="ROD-0412 · creado el 14/03/2025 por M. Andrade"
        actions={<><Button variant="danger-outline" icon="power">Desactivar</Button></>} />
      <Panel title="Identificación" icon="box-seam">
        <div className="bd-form-grid">
          <Field label="Código interno" htmlFor={id('c')} required hint="Único. Prefijo de categoría + número."><TextInput id={id('c')} className="bd-mono" defaultValue="ROD-0412" /></Field>
          <Field label="Nombre" htmlFor={id('n')} required className="bd-span"><TextInput id={id('n')} defaultValue="Rodamiento rígido de bolas 6205-2RS" /></Field>
          <Field label="Marca" htmlFor={id('b')}><TextInput id={id('b')} defaultValue="SKF" /></Field>
          <Field label="Modelo" htmlFor={id('mo')}><TextInput id={id('mo')} defaultValue="6205-2RSH" /></Field>
          <Field label="Número de parte" htmlFor={id('p')}><TextInput id={id('p')} defaultValue="6205-2RSH/C3" /></Field>
          <Field label="Categoría" htmlFor={id('cat')} required><Select id={id('cat')} options={['Rodamientos', 'Transmisión', 'Lubricantes', 'Sellos']} /></Field>
          <Field label="Unidad" htmlFor={id('u')} required><Select id={id('u')} options={['Unidad (u.)', 'Kilogramo (kg)', 'Litro (l)', 'Metro (m)']} /></Field>
        </div>
      </Panel>
      <Panel title="Stock y ubicación" icon="geo-alt">
        <div className="bd-form-grid">
          <Field label="Stock actual" hint="Solo cambia con movimientos autorizados."><TextInput readOnlyValue="4 u." /></Field>
          <Field label="Mínimo" htmlFor={id('min')} required><TextInput id={id('min')} inputMode="numeric" defaultValue="10" suffix="u." /></Field>
          <Field label="Máximo" htmlFor={id('max')} required error="El máximo debe ser mayor que el mínimo (10)."><TextInput id={id('max')} inputMode="numeric" defaultValue="8" suffix="u." /></Field>
          <Field label="Ubicación física" htmlFor={id('l')} required hint="Bodega-estante-nivel, p. ej. A-03-2"><TextInput id={id('l')} className="bd-mono" defaultValue="A-03-2" /></Field>
        </div>
      </Panel>
      <Panel title="Control" icon="sliders">
        <div className="bd-row" style={{ justifyContent: 'space-between' }}>
          <Checkbox label="Requiere lote y fecha de vencimiento" />
          <span className="bd-row"><span className="bd-muted">Estado</span><StatusBadge status="activo" /></span>
        </div>
      </Panel>
      <div className="pf-foot"><Button variant="secondary" size="lg">Cancelar</Button><Button variant="primary" size="lg" icon="check-lg">Guardar cambios</Button></div>
    </>
  );
}
const sheet = (
  <ConfirmDialog contained tone="danger" icon="power" title="¿Desactivar este producto?" confirmLabel="Sí, desactivar" confirmIcon="power"
    consequences={[['Producto', 'ROD-0412 · Rodamiento 6205-2RS'], ['Stock actual', '4 u. (se conserva)'], ['Solicitudes abiertas', '1 pendiente: MOV-0142']]}>
    <p style={{ margin: 0 }}>Dejará de aparecer en nuevas solicitudes. El historial y el stock se conservan, y puedes reactivarlo cuando quieras.</p>
  </ConfirmDialog>
);
render(<Devices desktop={<Shell user={COORD} current="productos"><Form /></Shell>} mobile={<Shell user={COORD} current="productos" overlay={sheet}><Form m /></Shell>} dRole="Coordinador · error de validación" mRole="Confirmar desactivación" />);
