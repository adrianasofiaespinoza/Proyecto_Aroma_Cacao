import { ICONS } from './icons.js';
const React = window.React;
const { useState } = React;
const cx = (...a) => a.filter(Boolean).join(' ');

/* ---------- Permisos ---------- */
export const ROLES = {
  coordinador: { label: 'Coordinador', icon: 'shield-lock' },
  operador: { label: 'Operador', icon: 'wrench-adjustable' },
  lectura: { label: 'Solo lectura', icon: 'eye' },
};
const PERMS = {
  coordinador: ['ver', 'solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios'],
  operador: ['ver', 'solicitar', 'prestar'],
  lectura: ['ver'],
};
export function can(role, action) { return (PERMS[role] || []).includes(action); }
export function RoleGate({ role, action, children, fallback = null }) { return can(role, action) ? children : fallback; }

/* ---------- Icono (Bootstrap Icons) ---------- */
export function Icon({ name, size, label, className, style }) {
  const p = ICONS[name] || '';
  return (
    <svg className={cx('bd-icon', className)} viewBox="0 0 16 16" width={size || 16} height={size || 16} fill="currentColor"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} style={style}
      dangerouslySetInnerHTML={{ __html: p }} />
  );
}

/* ---------- Marca ---------- */
export function BrandMark({ brand = {}, layout = 'stack' }) {
  const { name = 'Empresa', shortName, product = 'Mantenimiento', logoSrc } = brand;
  return (
    <div className={cx('bd-brand', layout === 'row' && 'bd-brand-row')}>
      {logoSrc ? <img src={logoSrc} alt={name} /> : <span className="bd-brand-name">{shortName || name}</span>}
      <span className="bd-brand-product">{product}</span>
    </div>
  );
}

/* ---------- Botones ---------- */
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, block, loading, children, className, as, ...rest }) {
  const Tag = as || 'button';
  return (
    <Tag type={Tag === 'button' ? 'button' : undefined} {...rest}
      className={cx('bd-btn', 'bd-btn-' + variant, size !== 'md' && 'bd-btn-' + size, block && 'bd-btn-block', loading && 'bd-btn-loading', className)}
      aria-busy={loading ? 'true' : undefined}>
      {loading ? <Icon name="arrow-repeat" /> : icon && <Icon name={icon} />}
      {children}
      {iconRight && <Icon name={iconRight} />}
    </Tag>
  );
}
export function IconButton({ icon, label, variant, size, className, children, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx('bd-iconbtn', variant === 'outline' && 'bd-iconbtn-outline', size === 'lg' && 'bd-iconbtn-lg', className)}>
      <Icon name={icon} />{children}
    </button>
  );
}

/* ---------- Insignias ---------- */
const STATUS = {
  pendiente: { label: 'Pendiente', icon: 'hourglass-split', sub: 'No aplicado al stock' },
  autorizado: { label: 'Autorizado', icon: 'check-circle-fill', sub: 'Aplicado al stock' },
  rechazado: { label: 'Rechazado', icon: 'x-octagon-fill', sub: 'Sin efecto en stock' },
  prestado: { label: 'Prestado', icon: 'arrow-right' },
  devuelto: { label: 'Devuelto', icon: 'check-lg' },
  activo: { label: 'Activo', icon: 'check-lg' },
  inactivo: { label: 'Inactivo', icon: 'slash-circle' },
  'stock-bajo': { label: 'Stock bajo', icon: 'exclamation-triangle-fill' },
  vencido: { label: 'Vencido', icon: 'calendar-x' },
  'por-vencer': { label: 'Por vencer', icon: 'hourglass-split' },
  vigente: { label: 'Vigente', icon: 'calendar-event' },
  'sin-lote': { label: 'Sin lote', icon: 'dash-lg' },
  'solo-lectura': { label: 'Solo lectura', icon: 'eye' },
};
export function StatusBadge({ status, label, detail, explain, size }) {
  const s = STATUS[status] || { label: status, icon: 'info-circle-fill' };
  const sub = detail || (explain ? s.sub : null);
  return (
    <span className={cx('bd-badge', 'bd-badge-' + status, status === 'pendiente' && 'bd-hatch', size === 'lg' && 'bd-badge-lg')}>
      <Icon name={s.icon} />{label || s.label}
      {sub && <span className="bd-badge-sub">{sub}</span>}
    </span>
  );
}
const TYPES = { entrada: ['Entrada', 'box-arrow-in-down'], salida: ['Salida', 'box-arrow-up'], ajuste: ['Ajuste', 'sliders'] };
export function TypeTag({ type }) {
  const [l, i] = TYPES[type] || [type, 'dash-lg'];
  return <span className="bd-type"><Icon name={i} />{l}</span>;
}
export function CodeTag({ children }) { return <code className="bd-code">{children}</code>; }

/* ---------- Medidor de stock ---------- */
export function StockMeter({ current, min, max, unit = 'u.', compact }) {
  const low = current <= min;
  const top = Math.max(max || 0, current, min) || 1;
  const pct = Math.min(100, (current / top) * 100);
  return (
    <div className={cx('bd-meter', low && 'bd-meter-low')} title={`Actual ${current} · mínimo ${min} · máximo ${max}`}>
      <div className="bd-meter-top">
        <span className="bd-meter-val">{current} {unit}</span>
        {low ? <span className="bd-meter-lbl"><Icon name="exclamation-triangle-fill" />≤ mín {min}</span>
          : !compact && <span className="bd-meter-lbl">mín {min} · máx {max}</span>}
      </div>
      <div className="bd-meter-bar" aria-hidden="true">
        <div className="bd-meter-fill" style={{ width: pct + '%' }} />
        <div className="bd-meter-min" style={{ left: `calc(${(min / top) * 100}% - 1px)` }} />
      </div>
    </div>
  );
}

/* ---------- Banda de indicadores ---------- */
export function KpiStrip({ items = [] }) {
  return (
    <div className="bd-kpis">
      {items.map((k, i) => (
        <a key={i} href={k.href || '#'} className={cx('bd-kpi', 'bd-focusable', k.tone && 'bd-kpi-' + k.tone, k.tone === 'pending' && 'bd-hatch')}>
          <span className="bd-kpi-label">{k.icon && <Icon name={k.icon} />}{k.label}</span>
          <span className="bd-kpi-value">{k.value}</span>
          {k.hint && <span className="bd-kpi-hint">{k.hint}</span>}
        </a>
      ))}
    </div>
  );
}

/* ---------- Panel ---------- */
export function Panel({ title, icon, count, actions, tone, flush, children, className }) {
  return (
    <section className={cx('bd-panel', tone && 'bd-panel-' + tone, flush && 'bd-panel-flush', className)}>
      {(title || actions) && (
        <header className="bd-panel-head">
          {title && <h2 className="bd-panel-title">{icon && <Icon name={icon} />}{title}</h2>}
          {count != null && <span className="bd-panel-count">{count}</span>}
          {actions && <div className="bd-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="bd-panel-body">{children}</div>
    </section>
  );
}

/* ---------- Vacío / carga / error ---------- */
export function EmptyState({ icon = 'inbox', title, text, action, tone }) {
  return (
    <div className={cx('bd-empty', tone === 'error' && 'bd-empty-error')} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} /><h3>{title}</h3>{text && <p>{text}</p>}{action}
    </div>
  );
}
export function LoadingRows({ rows = 5, label = 'Cargando…' }) {
  return (
    <div className="bd-loading" aria-busy="true" aria-live="polite">
      <div className="bd-loading-msg"><Icon name="arrow-repeat" />{label}</div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bd-loading-row">
          <div className="bd-skel" style={{ width: 60 + ((i * 17) % 35) + '%' }} />
          <div className="bd-skel" style={{ width: '70%' }} />
          <div className="bd-skel" style={{ width: '50%' }} />
          <div className="bd-skel" style={{ width: '40%' }} />
        </div>
      ))}
    </div>
  );
}
export function ConnectionError({ onRetry, variant = 'block', text }) {
  if (variant === 'banner') return (
    <div className="bd-offline" role="alert"><Icon name="wifi-off" />Sin conexión. Los datos pueden estar desactualizados.
      <Button size="sm" variant="secondary" icon="arrow-repeat" onClick={onRetry}>Reintentar</Button></div>
  );
  return <EmptyState tone="error" icon="wifi-off" title="No hay conexión con el servidor"
    text={text || 'Revisa la red Wi-Fi de la planta. Lo que escribiste no se perdió: vuelve a intentarlo cuando regrese la señal.'}
    action={<Button variant="primary" size="lg" icon="arrow-repeat" onClick={onRetry}>Reintentar</Button>} />;
}

/* ---------- Tabla densa con tarjetas en móvil ---------- */
export function DataTable({ columns, rows = [], rowKey = 'id', rowTone, onRowClick, actions, mobileActions, state = 'ready', empty = {}, onRetry, caption, loadingLabel }) {
  if (state === 'loading') return <div className="bd-dt"><LoadingRows label={loadingLabel || 'Cargando…'} /></div>;
  if (state === 'error') return <div className="bd-dt"><ConnectionError onRetry={onRetry} /></div>;
  if (state === 'empty' || !rows.length) return <div className="bd-dt"><EmptyState icon={empty.icon || 'inbox'} title={empty.title || 'No hay registros'} text={empty.text} action={empty.action} /></div>;
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key]);
  const titleCol = columns.find(c => c.mobile === 'title') || columns[0];
  const subCol = columns.find(c => c.mobile === 'subtitle');
  const badgeCol = columns.find(c => c.mobile === 'badge');
  const metaCols = columns.filter(c => !c.mobile || c.mobile === 'meta' || c.mobile === 'wide');
  return (
    <div className="bd-dt">
      <table className="bd-table">
        {caption && <caption className="bd-sr">{caption}</caption>}
        <thead><tr>{columns.map(c => <th key={c.key} className={c.align === 'right' ? 'bd-right' : undefined} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}{actions && <th className="bd-right"><span className="bd-sr">Acciones</span></th>}</tr></thead>
        <tbody>
          {rows.map(r => {
            const tone = rowTone && rowTone(r);
            return (
              <tr key={r[rowKey]} className={cx(tone && 'bd-tr-' + tone, onRowClick && 'bd-click')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map(c => <td key={c.key} className={c.align === 'right' ? 'bd-right' : undefined}>{cell(c, r)}</td>)}
                {actions && <td><div className="bd-row-actions">{actions(r)}</div></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="bd-cards">
        {rows.map(r => {
          const tone = rowTone && rowTone(r);
          const ma = (mobileActions || actions) && (mobileActions || actions)(r);
          return (
            <li key={r[rowKey]} className={cx('bd-card', tone && 'bd-card-' + tone)} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              <div className="bd-card-head">
                <div className="bd-card-title">{cell(titleCol, r)}{subCol && <div className="bd-card-sub">{cell(subCol, r)}</div>}</div>
                {badgeCol && cell(badgeCol, r)}
              </div>
              {metaCols.length > 0 && (
                <dl className="bd-card-meta">
                  {metaCols.filter(c => c !== titleCol).map(c => <div key={c.key} className={c.mobile === 'wide' ? 'bd-wide' : undefined}><dt>{c.mobileLabel || c.header}</dt><dd>{cell(c, r)}</dd></div>)}
                </dl>
              )}
              {ma && <div className="bd-card-actions">{ma}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Formularios ---------- */
export function Field({ label, htmlFor, required, optional, hint, error, children, className }) {
  return (
    <div className={cx('bd-field', error && 'bd-invalid', className)}>
      {label && <label className="bd-label" htmlFor={htmlFor}>{label}{required && <span className="bd-req" aria-hidden="true">*</span>}{required && <span className="bd-sr">(obligatorio)</span>}{optional && <span className="bd-opt">Opcional</span>}</label>}
      {children}
      {error ? <span className="bd-error" role="alert"><Icon name="exclamation-octagon-fill" />{error}</span> : hint && <span className="bd-hint">{hint}</span>}
    </div>
  );
}
export function TextInput({ icon, suffix, readOnlyValue, className, ...rest }) {
  if (readOnlyValue != null) return <div className="bd-input bd-readonly" aria-readonly="true"><Icon name="lock" />{readOnlyValue}</div>;
  if (!icon && !suffix) return <input className={cx('bd-input', className)} {...rest} />;
  return <div className="bd-input-wrap">{icon && <Icon name={icon} />}<input className={cx('bd-input', icon && 'bd-has-icon', suffix && 'bd-has-suffix', className)} {...rest} />{suffix && <span className="bd-input-suffix">{suffix}</span>}</div>;
}
export function Select({ options = [], placeholder, className, ...rest }) {
  return (
    <div className="bd-select-wrap">
      <select className={cx('bd-select', className)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="chevron-down" />
    </div>
  );
}
export function Textarea(props) { return <textarea className="bd-textarea" {...props} />; }
export function Checkbox({ label, ...rest }) {
  return <label className="bd-check"><input type="checkbox" {...rest} /><span className="bd-check-box"><Icon name="check-lg" /></span>{label}</label>;
}
export function QuantityStepper({ value, defaultValue = 1, min = 0, max, unit = 'u.', onChange, id, label = 'Cantidad' }) {
  const [inner, setInner] = useState(defaultValue);
  const v = value != null ? value : inner;
  const set = n => { const c = Math.max(min, max != null ? Math.min(max, n) : n); setInner(c); onChange && onChange(c); };
  return (
    <div className="bd-stepper">
      <button type="button" aria-label={'Restar 1 a ' + label} onClick={() => set(v - 1)}><Icon name="dash-lg" /></button>
      <input id={id} inputMode="numeric" value={v} aria-label={label} onChange={e => set(parseInt(e.target.value || '0', 10))} />
      <span className="bd-stepper-unit">{unit}</span>
      <button type="button" aria-label={'Sumar 1 a ' + label} onClick={() => set(v + 1)}><Icon name="plus-lg" /></button>
    </div>
  );
}

/* ---------- Filtros ---------- */
export function FilterBar({ children }) { return <div className="bd-filters" role="search">{children}</div>; }
export function SearchInput({ placeholder = 'Buscar…', ...rest }) {
  return <div className="bd-search"><TextInput icon="search" type="search" placeholder={placeholder} aria-label={placeholder} {...rest} /></div>;
}
export function Chip({ pressed, count, icon, children, ...rest }) {
  return <button type="button" className="bd-chip" aria-pressed={pressed ? 'true' : 'false'} {...rest}>{icon && <Icon name={icon} />}{children}{count != null && <span className="bd-chip-count">{count}</span>}</button>;
}
export function Segmented({ options = [], value, onChange, label }) {
  return (
    <div className="bd-seg" role="group" aria-label={label}>
      {options.map(o => <button key={o.value} type="button" aria-pressed={o.value === value ? 'true' : 'false'} onClick={() => onChange && onChange(o.value)}>{o.icon && <Icon name={o.icon} />}{o.label}</button>)}
    </div>
  );
}

/* ---------- Avisos ---------- */
const NOTICE_ICON = { danger: 'exclamation-octagon-fill', pending: 'hourglass-split', ok: 'check-circle-fill', info: 'info-circle-fill' };
export function Notice({ tone = 'info', title, children, code, actions, icon }) {
  return (
    <div className={cx('bd-notice', 'bd-notice-' + tone, tone === 'pending' && 'bd-hatch')} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon || NOTICE_ICON[tone]} />
      <div>{title && <span className="bd-notice-title">{title}</span>}{children}{code && <span className="bd-notice-code">Código: {code}</span>}</div>
      {actions && <div className="bd-notice-actions">{actions}</div>}
    </div>
  );
}
export function Toast({ tone = 'ok', children, onClose }) {
  return (
    <div className={cx('bd-toast', 'bd-toast-' + tone)} role="status">
      <Icon name={NOTICE_ICON[tone]} /><div>{children}</div>
      {onClose && <IconButton icon="x-lg" label="Cerrar aviso" onClick={onClose} />}
    </div>
  );
}

/* ---------- Modal y confirmación ---------- */
export function Modal({ open = true, title, icon, tone, children, footer, onClose, contained }) {
  if (!open) return null;
  return (
    <div className={cx('bd-overlay', contained && 'bd-overlay-contained')} onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={cx('bd-modal', tone && 'bd-modal-' + tone)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="bd-modal-head">{icon && <Icon name={icon} />}<h2 className="bd-modal-title">{title}</h2>{onClose && <IconButton icon="x-lg" label="Cerrar" onClick={onClose} />}</div>
        <div className="bd-modal-body">{children}</div>
        {footer && <div className="bd-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
export function ConfirmDialog({ title, tone = 'ok', icon, children, consequences, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', confirmIcon, onConfirm, onCancel, contained, reason, loading }) {
  const variant = tone === 'danger' ? 'danger' : tone === 'ok' ? 'ok' : 'primary';
  return (
    <Modal title={title} tone={tone} icon={icon || (tone === 'danger' ? 'exclamation-octagon-fill' : 'clipboard-check')} onClose={onCancel} contained={contained}
      footer={<><Button variant="secondary" size="lg" onClick={onCancel}>{cancelLabel}</Button><Button variant={variant} size="lg" icon={confirmIcon} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      {children}
      {consequences && <dl className="bd-consequence">{consequences.map(([k, v], i) => <React.Fragment key={i}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>}
      {reason}
    </Modal>
  );
}

/* ---------- Campana de alertas ---------- */
const ALERT_ICON = { danger: 'exclamation-triangle-fill', pending: 'hourglass-split', info: 'calendar-event' };
export function NotificationBell({ count = 0, open, onToggle }) {
  return (
    <IconButton icon={count ? 'bell-fill' : 'bell'} label={count ? `Alertas: ${count} activas` : 'Alertas: ninguna activa'} className="bd-bell" aria-expanded={open ? 'true' : 'false'} onClick={onToggle}>
      {count > 0 && <span className="bd-bell-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </IconButton>
  );
}
export function AlertsPanel({ alerts = [], onClose }) {
  return (
    <div className="bd-alerts" role="dialog" aria-label="Alertas activas">
      <div className="bd-alerts-head">Alertas activas · {alerts.length}{onClose && <IconButton icon="x-lg" label="Cerrar alertas" onClick={onClose} />}</div>
      {alerts.length ? (
        <ul>{alerts.map((a, i) => (
          <li key={i}><a href={a.href || '#'} className={cx('bd-alert', 'bd-alert-' + (a.tone || 'info'), 'bd-focusable')}>
            <Icon name={a.icon || ALERT_ICON[a.tone] || 'info-circle-fill'} /><span><b>{a.title}</b><small>{a.meta}</small></span><Icon name="chevron-right" className="bd-chev" />
          </a></li>))}
        </ul>
      ) : <EmptyState icon="bell" title="Sin alertas" text="Todo el stock está sobre el mínimo y no hay solicitudes esperando." />}
      <div className="bd-alerts-foot"><Button variant="ghost" size="sm">Ver todas las alertas</Button></div>
    </div>
  );
}

/* ---------- Marco de la aplicación ---------- */
export const NAV = [
  { id: 'inicio', label: 'Inicio', icon: 'house-door', m: true },
  { id: 'productos', label: 'Productos', icon: 'box-seam', m: true },
  { id: 'movimientos', label: 'Movimientos', icon: 'arrow-left-right', m: true },
  { id: 'prestamos', label: 'Préstamos', icon: 'tools', m: true },
  { id: 'maquinas', label: 'Máquinas', icon: 'gear-wide-connected' },
  { id: 'proveedores', label: 'Proveedores', icon: 'truck' },
  { id: 'usuarios', label: 'Usuarios', icon: 'people', action: 'usuarios' },
];
export function AppShell({ brand, user = {}, current = 'inicio', pendingCount, alerts = [], alertsOpen, onNavigate, onToggleAlerts, banner, children, overlay }) {
  const items = NAV.filter(n => !n.action || can(user.role, n.action));
  const role = ROLES[user.role] || ROLES.lectura;
  const initials = (user.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('');
  const link = n => (
    <a key={n.id} href={'#' + n.id} className="bd-nav-item" aria-current={n.id === current ? 'page' : undefined} onClick={onNavigate ? e => { e.preventDefault(); onNavigate(n.id); } : undefined}>
      <Icon name={n.icon} />{n.label}
      {n.id === 'movimientos' && pendingCount > 0 && can(user.role, 'autorizar') && <span className="bd-nav-count" aria-label={`${pendingCount} por autorizar`}>{pendingCount}</span>}
    </a>
  );
  const mobileItems = items.filter(n => n.m);
  const moreActive = !mobileItems.some(n => n.id === current);
  return (
    <div className="bd-app"><div className="bd-layout">
      <aside className="bd-rail" aria-label="Navegación principal">
        <div className="bd-rail-brand"><BrandMark brand={brand} /></div>
        <nav>{items.map(link)}</nav>
        <div className="bd-rail-foot">Bodega v1.0</div>
      </aside>
      <div className="bd-main">
        <header className="bd-header">
          <div className="bd-mhead-brand"><BrandMark brand={brand} layout="row" /></div>
          <div className="bd-header-ctx"><Icon name="building" /><b>{brand && brand.name}</b><span>·</span><span>Bodega de mantenimiento</span></div>
          <div className="bd-header-right">
            <NotificationBell count={alerts.length} open={alertsOpen} onToggle={onToggleAlerts} />
            <div className="bd-user">
              <span className="bd-avatar" aria-hidden="true">{initials}</span>
              <span className="bd-user-text"><span className="bd-user-name">{user.name}</span><br /><span className="bd-role"><Icon name={role.icon} />{role.label}</span></span>
              <span className="bd-sr">{user.name}, {role.label}</span>
            </div>
          </div>
        </header>
        {banner}
        <main className="bd-content">{children}</main>
      </div></div>
      {alertsOpen && <AlertsPanel alerts={alerts} onClose={onToggleAlerts} />}
      <nav className="bd-bottomnav" aria-label="Navegación principal">
        {mobileItems.map(link)}
        <a href="#mas" className="bd-nav-item" aria-current={moreActive ? 'page' : undefined}><Icon name="grid-3x3-gap" />Más</a>
      </nav>
      {overlay}
    </div>
  );
}
export function PageHeader({ title, subtitle, back, actions }) {
  return (
    <div className="bd-pagehead">
      <div>{back && <a className="bd-back" href="#"><Icon name="chevron-left" />{back}</a>}<h1>{title}</h1>{subtitle && <div className="bd-pagehead-sub">{subtitle}</div>}</div>
      {actions && <div className="bd-pagehead-actions">{actions}</div>}
    </div>
  );
}

/* ---------- Flujo e impacto del movimiento ---------- */
export function MovementFlow({ status = 'pendiente', requested = {}, reviewed = {} }) {
  const final = status === 'autorizado' ? { cls: 'bd-flow-ok', icon: 'check-lg', name: 'Autorizado · stock actualizado' }
    : status === 'rechazado' ? { cls: 'bd-flow-danger', icon: 'x-lg', name: 'Rechazado · stock sin cambios' }
    : { cls: 'bd-flow-todo', icon: 'box-seam', name: 'Aplicar al stock' };
  return (
    <div className="bd-flowwrap">
      <ol className="bd-flow" aria-label="Estado de la solicitud">
        <li className="bd-flow-done"><span className="bd-flow-dot"><Icon name="file-earmark-text" /></span><span className="bd-flow-name">Solicitado</span><span className="bd-flow-meta">{requested.by} · {requested.at}</span></li>
        <li className={status === 'pendiente' ? 'bd-flow-current' : 'bd-flow-done'}><span className="bd-flow-dot"><Icon name={status === 'pendiente' ? 'hourglass-split' : 'clipboard-check'} /></span><span className="bd-flow-name">{status === 'pendiente' ? 'Esperando revisión' : 'Revisado'}</span><span className="bd-flow-meta">{status === 'pendiente' ? 'Coordinador de mantenimiento' : `${reviewed.by} · ${reviewed.at}`}</span></li>
        <li className={final.cls}><span className="bd-flow-dot"><Icon name={final.icon} /></span><span className="bd-flow-name">{final.name}</span><span className="bd-flow-meta">{status === 'pendiente' ? 'Ocurre solo al autorizar' : status === 'autorizado' ? 'Movimiento aplicado' : (reviewed.reason || 'Sin movimiento de stock')}</span></li>
      </ol>
    </div>
  );
}
export function StockImpact({ before, after, unit = 'u.', status = 'pendiente', blocked, label = 'Stock actual' }) {
  const note = blocked ? ['exclamation-octagon-fill', 'Supera lo disponible'] : status === 'pendiente' ? ['hourglass-split', 'Solo si se autoriza'] : status === 'autorizado' ? ['check-circle-fill', 'Aplicado'] : ['slash-circle', 'No se aplicó'];
  const delta = after - before;
  return (
    <div className={cx('bd-impact', 'bd-impact-' + status, blocked && 'bd-impact-blocked')}>
      <div className="bd-impact-box"><small>{status === 'autorizado' ? 'Antes' : label}</small><b>{before} {unit}</b></div>
      <div className="bd-impact-arrow" aria-hidden="true"><span>{delta > 0 ? '+' + delta : delta === 0 ? '±0' : '−' + Math.abs(delta)}</span><Icon name="arrow-right" /></div>
      <div className="bd-impact-box bd-impact-next"><small>{status === 'autorizado' ? 'Ahora' : status === 'rechazado' ? 'Habría quedado' : 'Quedaría'}</small><b>{after} {unit}</b></div>
      <span className="bd-impact-note" style={{ color: blocked ? 'var(--danger-ink)' : undefined }}><Icon name={note[0]} />{note[1]}</span>
    </div>
  );
}
