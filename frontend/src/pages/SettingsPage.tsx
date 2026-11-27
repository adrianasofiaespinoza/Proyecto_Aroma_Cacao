import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useCompanySettings, useRules, useSaveRules, useSaveSettings } from '../api/hooks'
import { useSessionUser } from '../app/AuthProvider'
import { ROLES, can } from '../lib/permissions'
import { PasswordPanel } from './AccountPage'
import type { CompanySettings, CompanySettingsInput } from '../api/types'
import { Button, Checkbox, ConnectionError, Field, LoadingRows, Notice, PageHeader, Panel, Select, TextInput, useToast } from '../components/ui'
import { CURRENCIES, DATE_FORMATS, MODULES, colorErrors, deriveTheme, isHexColor, type DateFormat } from '../lib/company'
import { describeError, isConnectionError } from '../lib/errors'

const MAX_LOGO_KB = 200
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const SAMPLE_DATE = new Date(2026, 10, 24)

type Form = CompanySettingsInput
type ErrorBox = { title: string; message: string; code?: string } | null

function toForm(s: CompanySettings): Form {
  const { logo_url: _logo, ...rest } = s
  void _logo
  return { ...rest, tax_id: rest.tax_id ?? '' }
}

function sampleDate(format: DateFormat): string {
  const dd = '24'
  const mm = '11'
  const yyyy = String(SAMPLE_DATE.getFullYear())
  return format === 'mm/dd/aaaa' ? `${mm}/${dd}/${yyyy}` : format === 'aaaa-mm-dd' ? `${yyyy}-${mm}-${dd}` : `${dd}/${mm}/${yyyy}`
}

function samplePrice(currency: string): string {
  const locale = CURRENCIES.find((c) => c.code === currency)?.locale ?? 'es-EC'
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(1234.5)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Vista previa de la marca con los colores elegidos (tema claro). */
function ColorPreview({ brand, accent, name }: { brand: string; accent: string; name: string }) {
  if (!isHexColor(brand) || !isHexColor(accent)) return null
  const t = deriveTheme(brand, accent).claro
  return (
    <div className="cf-preview" aria-hidden="true">
      <div className="cf-preview-nav" style={{ background: t['nav-bg'], color: t['nav-ink'] }}>
        <b>{name || 'Mi empresa'}</b>
        <span className="cf-preview-item" style={{ background: t['nav-active-bg'], color: t['nav-ink'], borderColor: t.accent }}>Inicio</span>
        <span style={{ color: t['nav-ink-muted'] }}>Productos</span>
      </div>
      <div className="cf-preview-body">
        <span className="cf-preview-btn" style={{ background: t.brand, color: t['on-brand'] }}>Guardar</span>
        <span className="cf-preview-chip" style={{ background: t['brand-tint'], color: t['brand-ink'] }}>Autorizada</span>
        <span className="cf-preview-chip" style={{ background: t.accent, color: t['on-accent'] }}>3 pendientes</span>
        <span style={{ color: t.brand, fontWeight: 600 }}>Enlace</span>
      </div>
    </div>
  )
}

/**
 * Configuración. El equipo de desarrollo (rol soporte) ve todo: marca, moneda y módulos.
 * El coordinador de la empresa solo ve las reglas de operación (autoaprobación).
 */
/**
 * Configuración: solo coordinador y soporte (decisión de la usuaria, 2026-11-25). Cada uno ve sus secciones.
 * - Soporte: datos de la empresa, apariencia y módulos (incluye la autoaprobación).
 * - Coordinador: la autoaprobación de sus solicitudes.
 * - Los dos: cambiar su contraseña. El operador y solo lectura la cambian en «Cambiar contraseña» (/cuenta).
 */
export function SettingsPage() {
  const user = useSessionUser()
  return (
    <>
      <PageHeader title="Configuración" subtitle={`${user.name} · ${ROLES[user.role].label}`} />
      <div className="bd-stack">
        {can(user.role, 'configurar') ? <CompanySettingsForm /> : <RulesForm />}
        <PasswordPanel />
      </div>
    </>
  )
}

const AUTO_APPROVE_HELP = 'Útil en empresas pequeñas. Se aplican las mismas validaciones de stock y lotes; si alguna falla, la solicitud queda pendiente. El historial registra al coordinador como solicitante y como quien autoriza. Las solicitudes de los operadores siempre esperan revisión.'

/** Lo único que el coordinador de la empresa configura por su cuenta. */
function RulesForm() {
  const rules = useRules()
  const save = useSaveRules()
  const toast = useToast()
  const [error, setError] = useState<ErrorBox>(null)

  const toggle = async (value: boolean) => {
    setError(null)
    try {
      await save.mutateAsync({ coordinator_auto_approve: value })
      toast.ok(value ? <><b>Autoaprobación activada.</b> Tus solicitudes se autorizarán al enviarlas.</> : <><b>Autoaprobación desactivada.</b> Tus solicitudes quedarán pendientes de revisión.</>)
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <>
      {rules.isError ? (
        isConnectionError(rules.error) ? <ConnectionError onRetry={() => void rules.refetch()} /> : <Notice tone="danger" title={describeError(rules.error).title}>{describeError(rules.error).message}</Notice>
      ) : !rules.data ? (
        <LoadingRows rows={2} label="Cargando…" />
      ) : (
        <Panel title="Autorización de solicitudes" icon="clipboard-check">
          {error && <Notice tone="danger" title={error.title} code={error.code}>{error.message}</Notice>}
          <Checkbox
            label={<span><b>Autorizar automáticamente las solicitudes del coordinador</b></span>}
            checked={rules.data.coordinator_auto_approve}
            disabled={save.isPending}
            onChange={(e) => void toggle(e.target.checked)}
          />
          <p className="bd-muted" style={{ margin: 0 }}>{AUTO_APPROVE_HELP}</p>
        </Panel>
      )}
    </>
  )
}

/** Configuración completa de la instalación: solo el equipo de desarrollo. El backend vuelve a validar todo. */
function CompanySettingsForm() {
  const settings = useCompanySettings()
  const { save, uploadLogo, deleteLogo } = useSaveSettings()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<ErrorBox>(null)
  const [logoError, setLogoError] = useState<ErrorBox>(null)

  useEffect(() => {
    if (settings.data && !form) setForm(toForm(settings.data))
  }, [settings.data, form])

  if (settings.isError) {
    return (
      <>
        {isConnectionError(settings.error) ? <ConnectionError onRetry={() => void settings.refetch()} /> : <Notice tone="danger" title={describeError(settings.error).title}>{describeError(settings.error).message}</Notice>}
      </>
    )
  }
  if (!form || !settings.data) {
    return (
      <>
        <LoadingRows rows={4} label="Cargando la configuración…" />
      </>
    )
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))
  const colors = colorErrors(form.brand_color, form.accent_color)
  const errors = {
    name: !form.name.trim() ? 'Escribe el nombre de la empresa.' : undefined,
    short_name: !form.short_name.trim() ? 'Escribe un nombre corto para el menú.' : undefined,
    tax_id_label: !form.tax_id_label.trim() ? 'Escribe la etiqueta, por ejemplo RUC, NIT o RFC.' : undefined,
    brand: colors.brand,
    accent: colors.accent,
  }
  const valid = Object.values(errors).every((e) => !e)
  const show = (e?: string) => (tried ? e : undefined)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    setError(null)
    if (!valid) return
    try {
      const saved = await save.mutateAsync({ ...form, tax_id: form.tax_id?.trim() || null })
      setForm(toForm(saved))
      setTried(false)
      toast.ok(<><b>Configuración guardada.</b> Los cambios ya se ven en todas las pantallas.</>)
    } catch (err) {
      setError(describeError(err))
    }
  }

  const pickLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setLogoError(null)
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError({ title: 'Formato no admitido', message: 'Usa un archivo PNG, JPG, WebP o SVG.' })
      return
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      setLogoError({ title: 'El logo pesa demasiado', message: `Pesa ${Math.ceil(file.size / 1024)} KB y el máximo es ${MAX_LOGO_KB} KB.` })
      return
    }
    try {
      await uploadLogo.mutateAsync(await readAsDataUrl(file))
      toast.ok(<><b>Logo actualizado.</b> También se usa como icono de la pestaña.</>)
    } catch (err) {
      setLogoError(describeError(err))
    }
  }

  const removeLogo = async () => {
    setLogoError(null)
    try {
      await deleteLogo.mutateAsync()
      toast.ok(<><b>Logo quitado.</b> Se muestra el nombre de la empresa.</>)
    } catch (err) {
      setLogoError(describeError(err))
    }
  }

  const logoUrl = settings.data.logo_url
  return (
    <>
      <Notice tone="info" icon="person-badge" title="Datos de la empresa, apariencia y módulos">Solo el equipo de soporte ve esta sección.</Notice>
      <form className="bd-stack" onSubmit={submit} noValidate>
        {error && <Notice tone="danger" title={error.title} code={error.code}>{error.message}</Notice>}

        <Panel title="Empresa" icon="building">
          <div className="bd-form-grid">
            <Field label="Nombre" htmlFor="cf-name" required hint="Aparece en el inicio de sesión y en el pie del menú." error={show(errors.name)}>
              <TextInput id="cf-name" value={form.name} maxLength={100} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Nombre corto" htmlFor="cf-short" required hint="Se ve en el menú y en la pestaña del navegador." error={show(errors.short_name)}>
              <TextInput id="cf-short" value={form.short_name} maxLength={40} onChange={(e) => set('short_name', e.target.value)} />
            </Field>
            <Field label="Subtítulo" htmlFor="cf-subtitle" optional hint="Por ejemplo, el área: Mantenimiento.">
              <TextInput id="cf-subtitle" value={form.subtitle} maxLength={60} onChange={(e) => set('subtitle', e.target.value)} />
            </Field>
            <Field label="Identificación fiscal" htmlFor="cf-tax-label" required hint="El nombre que usa tu país: RUC, NIT, RFC, CUIT…" error={show(errors.tax_id_label)}>
              <TextInput id="cf-tax-label" value={form.tax_id_label} maxLength={10} onChange={(e) => set('tax_id_label', e.target.value)} />
            </Field>
            <Field label={`Número de ${form.tax_id_label || 'identificación'}`} htmlFor="cf-tax" optional hint="No se muestra antes de iniciar sesión.">
              <TextInput id="cf-tax" className="bd-mono" value={form.tax_id ?? ''} maxLength={30} onChange={(e) => set('tax_id', e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel title="Logo" icon="palette">
          <div className="cf-logo">
            <div className="cf-logo-box">{logoUrl ? <img src={logoUrl} alt={`Logo de ${form.name}`} /> : <span className="bd-muted">Sin logo</span>}</div>
            <div className="bd-stack">
              <p className="bd-muted" style={{ margin: 0 }}>PNG, JPG, WebP o SVG de hasta {MAX_LOGO_KB} KB. Mejor con fondo transparente. También se usa como icono de la pestaña.</p>
              {logoError && <Notice tone="danger" title={logoError.title} code={logoError.code}>{logoError.message}</Notice>}
              <div className="bd-row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} hidden onChange={(e) => void pickLogo(e)} />
                <Button icon="box-arrow-up" loading={uploadLogo.isPending} onClick={() => fileRef.current?.click()}>{logoUrl ? 'Cambiar logo' : 'Subir logo'}</Button>
                {logoUrl && <Button variant="ghost" icon="x-lg" loading={deleteLogo.isPending} onClick={() => void removeLogo()}>Quitar logo</Button>}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Colores" icon="palette">
          <div className="bd-form-grid">
            <Field label="Color principal" htmlFor="cf-brand" required hint="Botones, enlaces y menú. Debe leerse sobre fondo blanco." error={errors.brand}>
              <div className="cf-color">
                <input type="color" aria-label="Elegir color principal" value={isHexColor(form.brand_color) ? form.brand_color : '#000000'} onChange={(e) => set('brand_color', e.target.value)} />
                <TextInput id="cf-brand" className="bd-mono" value={form.brand_color} maxLength={7} onChange={(e) => set('brand_color', e.target.value.trim())} />
              </div>
            </Field>
            <Field label="Color de acento" htmlFor="cf-accent" required hint="Destaca la sección activa y los avisos. Debe resaltar sobre el menú." error={errors.accent}>
              <div className="cf-color">
                <input type="color" aria-label="Elegir color de acento" value={isHexColor(form.accent_color) ? form.accent_color : '#000000'} onChange={(e) => set('accent_color', e.target.value)} />
                <TextInput id="cf-accent" className="bd-mono" value={form.accent_color} maxLength={7} onChange={(e) => set('accent_color', e.target.value.trim())} />
              </div>
            </Field>
          </div>
          <ColorPreview brand={form.brand_color} accent={form.accent_color} name={form.short_name} />
          <p className="bd-muted" style={{ margin: 0 }}>Los demás tonos, incluido el tema oscuro, se calculan a partir de estos dos.</p>
        </Panel>

        <Panel title="Formato regional" icon="cash-coin">
          <div className="bd-form-grid">
            <Field label="Moneda" htmlFor="cf-currency" required hint={`Ejemplo: ${samplePrice(form.currency)}`}>
              <Select id="cf-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))} />
            </Field>
            <Field label="Formato de fecha" htmlFor="cf-date" required hint={`Ejemplo: ${sampleDate(form.date_format)}`}>
              <Select id="cf-date" value={form.date_format} onChange={(e) => set('date_format', e.target.value as DateFormat)} options={DATE_FORMATS} />
            </Field>
          </div>
        </Panel>

        <Panel title="Módulos" icon="grid-3x3-gap">
          <p className="bd-muted" style={{ margin: 0 }}>Un módulo desactivado desaparece del menú para todos. Sus datos se conservan y vuelven al activarlo.</p>
          <div className="bd-stack">
            {MODULES.map((m) => (
              <div key={m.id}>
                <Checkbox label={<span><b>{m.label}</b> <span className="bd-muted">· {m.hint}</span></span>} checked={form.modules[m.id]} onChange={(e) => set('modules', { ...form.modules, [m.id]: e.target.checked })} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Autorización de solicitudes" icon="clipboard-check">
          <Checkbox
            label={<span><b>Autorizar automáticamente las solicitudes del coordinador</b></span>}
            checked={form.coordinator_auto_approve}
            onChange={(e) => set('coordinator_auto_approve', e.target.checked)}
          />
          <p className="bd-muted" style={{ margin: 0 }}>{AUTO_APPROVE_HELP} El coordinador de la empresa también puede cambiar esta opción.</p>
        </Panel>

        <div className="bd-row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary" size="lg" icon="check-lg" type="submit" loading={save.isPending}>Guardar configuración</Button>
        </div>
      </form>
    </>
  )
}
