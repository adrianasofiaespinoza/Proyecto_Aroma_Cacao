import { useNavigate } from 'react-router'
import { useAuth, useSessionUser } from '../app/AuthProvider'
import { THEMES, useTheme } from '../app/ThemeProvider'
import { Button, Icon, NAV, PageHeader, Panel, Segmented, useGo } from '../components/ui'
import { can } from '../lib/permissions'

/** «Más» de la barra inferior: las secciones que no caben en ella, el tema y cerrar sesión. */
export function MorePage() {
  const user = useSessionUser()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const go = useGo()
  const items = NAV.filter((n) => !n.m && (!n.action || can(user.role, n.action)))
  return (
    <>
      <PageHeader title="Más" subtitle={user.name} />
      <div className="bd-page-more">
        {items.map((n) => (
          <a key={n.id} href={n.href} className="bd-more-link bd-focusable" onClick={go(n.href)}>
            <Icon name={n.icon} />{n.label}<Icon name="chevron-right" className="bd-chev" />
          </a>
        ))}
      </div>
      <Panel title="Tema" icon="palette">
        <Segmented label="Tema" value={theme} onChange={(v) => setTheme(v as typeof theme)} options={THEMES.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))} />
      </Panel>
      <Button variant="secondary" size="xl" block icon="box-arrow-right" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>Cerrar sesión</Button>
    </>
  )
}
