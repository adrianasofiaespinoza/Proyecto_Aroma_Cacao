// @card height=820 width=1760 subtitle="Solo Coordinador. Usuario, nombre, correo, rol y estado; nuevo usuario en modal."
import { B, Devices, Shell, COORD, USERLIST, render } from './_kit.jsx';
const ROLES = B.ROLES;
const { PageHeader, Panel, DataTable, Button, IconButton, StatusBadge, FilterBar, SearchInput, Segmented, Modal, Field, TextInput, Select, Icon, Notice } = B;
const RoleTag = ({ r }) => <span className="us-role"><Icon name={ROLES[r].icon} />{ROLES[r].label}</span>;
const cols = [
  { key: 'user', header: 'Usuario', mobile: 'subtitle', render: r => <span className="bd-mono">{r.user}</span> },
  { key: 'name', header: 'Nombre completo', mobile: 'title', render: r => <span className="bd-cell-title">{r.name}</span> },
  { key: 'email', header: 'Correo', mobile: 'wide' },
  { key: 'role', header: 'Rol', mobile: 'meta', render: r => <RoleTag r={r.role} /> },
  { key: 'active', header: 'Estado', mobile: 'badge', render: r => <StatusBadge status={r.active ? 'activo' : 'inactivo'} /> },
];
const list = (
  <Panel flush>
    <FilterBar><SearchInput placeholder="Buscar por nombre, usuario o correo" /><Segmented label="Rol" value="todos" options={[{ value: 'todos', label: 'Todos' }, { value: 'coordinador', label: 'Coordinador' }, { value: 'operador', label: 'Operador' }, { value: 'lectura', label: 'Solo lectura' }]} /></FilterBar>
    <DataTable columns={cols} rows={USERLIST} rowTone={r => r.active ? null : 'muted'} caption="Usuarios"
      actions={r => <><IconButton icon="pencil" label={'Editar ' + r.name} />{r.active ? <IconButton icon="power" label={'Desactivar ' + r.name} /> : <IconButton icon="arrow-counterclockwise" label={'Reactivar ' + r.name} />}</>}
      mobileActions={r => <><Button variant="secondary" icon="pencil">Editar</Button>{r.active ? <Button variant="danger-outline" icon="power">Desactivar</Button> : <Button variant="secondary" icon="arrow-counterclockwise">Reactivar</Button>}</>} />
  </Panel>
);
const modal = (
  <Modal contained title="Nuevo usuario" icon="person-badge" onClose={() => {}}
    footer={<><Button variant="secondary" size="lg">Cancelar</Button><Button variant="primary" size="lg" icon="check-lg">Crear y enviar acceso</Button></>}>
    <div className="bd-form-grid">
      <Field label="Usuario" htmlFor="u1" required error="Ese usuario ya existe."><TextInput id="u1" className="bd-mono" defaultValue="dmero" /></Field>
      <Field label="Nombre completo" htmlFor="u2" required><TextInput id="u2" defaultValue="Daniela Mero Villón" /></Field>
      <Field label="Correo" htmlFor="u3" required className="bd-span"><TextInput id="u3" icon="envelope" defaultValue="dmerov@aromacacao.ec" /></Field>
      <Field label="Rol" htmlFor="u4" required className="bd-span" hint="Operador: pide entradas y salidas y registra préstamos. No autoriza."><Select id="u4" options={['Operador', 'Coordinador', 'Solo lectura']} /></Field>
    </div>
  </Modal>
);
render(<Devices height={760}
  desktop={<Shell user={COORD} current="usuarios" overlay={modal}><PageHeader title="Usuarios" subtitle="6 usuarios · 1 inactivo" actions={<Button variant="primary" icon="plus-lg">Nuevo usuario</Button>} />{list}</Shell>}
  mobile={<Shell user={COORD} current="usuarios"><PageHeader title="Usuarios" actions={<Button variant="primary" size="xl" icon="plus-lg">Nuevo usuario</Button>} />{list}</Shell>}
  dRole="Coordinador · nuevo usuario" mRole="Coordinador" />);
