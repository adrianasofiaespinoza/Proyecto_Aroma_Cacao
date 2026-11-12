// Datos de ejemplo y marcos de dispositivo compartidos por las pantallas.
export const B = window.Bodega;
export const BRAND = { name: 'Aroma Cacao S.A.', shortName: 'Aroma Cacao', product: 'Mantenimiento' };
export const COORD = { name: 'Marcela Andrade', role: 'coordinador' };
export const OPER = { name: 'Luis Cedeño', role: 'operador' };
export const LECT = { name: 'Patricia Vera', role: 'lectura' };

export const ALERTS = [
  { tone: 'pending', title: '4 solicitudes por autorizar', meta: 'La más antigua: hace 3 h · MOV-0142' },
  { tone: 'danger', title: 'Rodamiento 6205-2RS bajo mínimo', meta: '4 u. · mínimo 10 · Bodega A-03-2' },
  { tone: 'danger', title: 'Banda en V B-52 bajo mínimo', meta: '2 u. · mínimo 4 · Bodega B-01-1' },
  { tone: 'danger', title: 'Sello mecánico 1¼" bajo mínimo', meta: '1 u. · mínimo 2 · Bodega A-05-3' },
  { tone: 'info', title: 'Grasa H1 lote G-2410 vence el 28/11', meta: 'Quedan 6 kg · 18 días' },
];

export const PRODUCTS = [
  { id: 1, code: 'ROD-0412', name: 'Rodamiento rígido de bolas 6205-2RS', brand: 'SKF', model: '6205-2RSH', part: '6205-2RSH/C3', cat: 'Rodamientos', unit: 'u.', stock: 4, min: 10, max: 40, loc: 'A-03-2', active: true, lot: false },
  { id: 2, code: 'BAN-0107', name: 'Banda en V clásica B-52', brand: 'Gates', model: 'Hi-Power II', part: 'B52', cat: 'Transmisión', unit: 'u.', stock: 2, min: 4, max: 12, loc: 'B-01-1', active: true, lot: false },
  { id: 3, code: 'LUB-0021', name: 'Grasa grado alimenticio H1', brand: 'Klüber', model: 'Klübersynth UH1 14-151', part: '012345', cat: 'Lubricantes', unit: 'kg', stock: 18, min: 8, max: 30, loc: 'C-02-1', active: true, lot: true },
  { id: 4, code: 'SEL-0033', name: 'Sello mecánico 1¼" bomba de licor', brand: 'John Crane', model: 'Tipo 21', part: '21-125-CSV', cat: 'Sellos', unit: 'u.', stock: 1, min: 2, max: 6, loc: 'A-05-3', active: true, lot: false },
  { id: 5, code: 'FIL-0090', name: 'Filtro de aceite hidráulico 10 µm', brand: 'Parker', model: '937399Q', part: '937399Q', cat: 'Filtros', unit: 'u.', stock: 9, min: 4, max: 16, loc: 'B-04-2', active: true, lot: false },
  { id: 6, code: 'ELE-0215', name: 'Contactor 3P 25 A 220 V', brand: 'Schneider', model: 'LC1D25M7', part: 'LC1D25M7', cat: 'Eléctricos', unit: 'u.', stock: 6, min: 2, max: 8, loc: 'D-01-4', active: true, lot: false },
  { id: 7, code: 'LUB-0008', name: 'Aceite para cadenas de horno', brand: 'Mobil', model: 'Pyrolube 830', part: 'PY830-20L', cat: 'Lubricantes', unit: 'l', stock: 40, min: 20, max: 80, loc: 'C-01-1', active: false, lot: true },
];
export const LOTS = [
  { id: 1, lot: 'G-2407', exp: '30/10/2026', left: 2, state: 'vencido', days: '−11 días' },
  { id: 2, lot: 'G-2410', exp: '28/11/2026', left: 6, state: 'por-vencer', days: '18 días' },
  { id: 3, lot: 'G-2502', exp: '15/02/2027', left: 10, state: 'vigente', days: '97 días' },
];
export const MOVES = [
  { id: 'MOV-0142', type: 'salida', status: 'pendiente', date: '10/11 08:12', by: 'Luis Cedeño', auth: '—', reason: 'Cambio de rodamiento del tostador', ot: 'OT-3381', item: 'Rodamiento 6205-2RS', qty: '2 u.', lot: '—', machine: 'Tostador continuo T-01' },
  { id: 'MOV-0141', type: 'ajuste', status: 'pendiente', date: '10/11 07:40', by: 'Diana Mero', auth: '—', reason: 'Conteo cíclico estante C-02', ot: '—', item: 'Grasa H1', qty: 'contado 18 kg (sistema 19)', lot: 'G-2410', machine: '—' },
  { id: 'MOV-0140', type: 'entrada', status: 'pendiente', date: '09/11 16:05', by: 'Luis Cedeño', auth: '—', reason: 'Compra OC-1187', ot: '—', item: 'Filtro hidráulico 10 µm', qty: '6 u.', lot: '—', machine: '—' },
  { id: 'MOV-0139', type: 'salida', status: 'autorizado', date: '09/11 11:20', by: 'Jorge Tomalá', auth: 'M. Andrade', reason: 'Fuga en bomba de licor', ot: 'OT-3376', item: 'Sello mecánico 1¼"', qty: '1 u.', lot: '—', machine: 'Molino de licor M-03' },
  { id: 'MOV-0138', type: 'salida', status: 'rechazado', date: '08/11 15:47', by: 'Diana Mero', auth: 'M. Andrade', reason: 'Repuesto para descascarilladora', ot: 'OT-3370', item: 'Banda en V B-52', qty: '4 u.', lot: '—', machine: 'Descascarilladora D-02' },
  { id: 'MOV-0137', type: 'entrada', status: 'autorizado', date: '08/11 09:02', by: 'Luis Cedeño', auth: 'M. Andrade', reason: 'Compra OC-1180', ot: '—', item: 'Grasa H1', qty: '10 kg', lot: 'G-2502', machine: '—' },
];
export const LOANS = [
  { id: 1, tool: 'Torquímetro 1/2" 20–200 N·m', code: 'HER-0012', worker: 'Jorge Tomalá', qty: 1, out: '10/11 07:05', back: '—', status: 'prestado', stock: 2, lent: 1 },
  { id: 2, tool: 'Multímetro digital True RMS', code: 'HER-0031', worker: 'Andrés Quimí (contratista)', qty: 1, out: '09/11 14:30', back: '—', status: 'prestado', stock: 3, lent: 2 },
  { id: 3, tool: 'Extractor de rodamientos 3 garras', code: 'HER-0007', worker: 'Luis Cedeño', qty: 1, out: '09/11 08:10', back: '—', status: 'prestado', stock: 1, lent: 1 },
  { id: 4, tool: 'Llave de impacto 1/2" inalámbrica', code: 'HER-0044', worker: 'Diana Mero', qty: 1, out: '08/11 10:00', back: '08/11 17:45', status: 'devuelto', stock: 2, lent: 0 },
];
export const MACHINES = [
  { id: 1, name: 'Tostador continuo', code: 'T-01', loc: 'Nave 1 · Tostado', parts: 14 },
  { id: 2, name: 'Descascarilladora / aventadora', code: 'D-02', loc: 'Nave 1 · Descascarillado', parts: 9 },
  { id: 3, name: 'Molino de licor de cacao', code: 'M-03', loc: 'Nave 2 · Molienda', parts: 11 },
  { id: 4, name: 'Prensa hidráulica de manteca', code: 'PH-01', loc: 'Nave 2 · Prensado', parts: 17 },
  { id: 5, name: 'Caldero pirotubular 150 BHP', code: 'CB-01', loc: 'Cuarto de máquinas', parts: 8 },
  { id: 6, name: 'Envasadora de polvo de cacao', code: 'E-04', loc: 'Nave 3 · Envasado', parts: 12 },
];
export const SUPPLIERS = [
  { id: 1, name: 'Rodamientos del Pacífico S.A.', ruc: '0991234567001', contact: 'Ing. Carla Solórzano', phone: '04 259 1180', email: 'ventas@rodapacifico.ec', addr: 'Av. Juan Tanca Marengo km 2, Guayaquil', products: 38 },
  { id: 2, name: 'Ferrindustrial Guayas Cía. Ltda.', ruc: '0992876543001', contact: 'Pedro Alvarado', phone: '04 228 4410', email: 'pedidos@ferrindustrial.ec', addr: 'Vía a Daule km 8,5, Guayaquil', products: 112 },
  { id: 3, name: 'Hidráulica Andina S.A.', ruc: '1791456782001', contact: 'Sofía Paredes', phone: '02 246 7720', email: 'sparedes@hidraulicandina.ec', addr: 'Av. Eloy Alfaro N35-12, Quito', products: 21 },
];
export const USERLIST = [
  { id: 1, user: 'mandrade', name: 'Marcela Andrade', email: 'mandrade@aromacacao.ec', role: 'coordinador', active: true },
  { id: 2, user: 'lcedeno', name: 'Luis Cedeño', email: 'lcedeno@aromacacao.ec', role: 'operador', active: true },
  { id: 3, user: 'dmero', name: 'Diana Mero', email: 'dmero@aromacacao.ec', role: 'operador', active: true },
  { id: 4, user: 'jtomala', name: 'Jorge Tomalá', email: 'jtomala@aromacacao.ec', role: 'operador', active: true },
  { id: 5, user: 'pvera', name: 'Patricia Vera', email: 'pvera@aromacacao.ec', role: 'lectura', active: true },
  { id: 6, user: 'rcastro', name: 'Ricardo Castro', email: 'rcastro@aromacacao.ec', role: 'operador', active: false },
];

/* marcos de escritorio y móvil, lado a lado */
export function Frame({ label, role, width, height = 820, children }) {
  return (
    <figure className="pv-fig">
      <figcaption className="pv-cap"><b>{label}</b>{role && <span>{role}</span>}</figcaption>
      <div className="pv-frame" style={{ width, height }}>{children}</div>
    </figure>
  );
}
export function Devices({ desktop, mobile, dRole, mRole, height = 820, mobileFirst }) {
  return (
    <div className="pv-devices">
      {desktop && <Frame label="Escritorio · 1280" role={dRole} width={1280} height={height}>{desktop}</Frame>}
      {mobile && <Frame label="Móvil · 390" role={mRole} width={390} height={height}>{mobile}</Frame>}
    </div>
  );
}
export function render(node) { ReactDOM.createRoot(document.getElementById('root')).render(node); }
export const Shell = (p) => <B.AppShell brand={BRAND} alerts={ALERTS} pendingCount={4} {...p} />;
