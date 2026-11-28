import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'
import { useModules, useTheme } from './ThemeProvider'
import type { ModuleId } from '../lib/company'
import { AppLayout } from './AppLayout'
import { can } from '../lib/permissions'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { ProductsPage } from '../pages/products/ProductsPage'
import { ProductFormPage } from '../pages/products/ProductFormPage'
import { ProductLotsPage } from '../pages/products/ProductLotsPage'
import { ImportPage } from '../pages/products/ImportPage'
import { MovementsPage } from '../pages/movements/MovementsPage'
import { NewMovementPage } from '../pages/movements/NewMovementPage'
import { MovementDetailPage } from '../pages/movements/MovementDetailPage'
import { LoansPage } from '../pages/LoansPage'
import { MachinesPage } from '../pages/machines/MachinesPage'
import { MachineDetailPage } from '../pages/machines/MachineDetailPage'
import { SuppliersPage } from '../pages/suppliers/SuppliersPage'
import { SupplierDetailPage } from '../pages/suppliers/SupplierDetailPage'
import { UsersPage } from '../pages/UsersPage'
import { MorePage } from '../pages/MorePage'
import { AccountPage, FirstPasswordPage } from '../pages/AccountPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { RecoverPage } from '../pages/password/RecoverPage'
import { SupportPage } from '../pages/SupportPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ExportPage } from '../pages/ExportPage'
import { ComponentsDevPage } from '../pages/ComponentsDevPage'
import { LoadingRows } from '../components/ui'

function RequireAuth() {
  const { user, checking } = useAuth()
  const location = useLocation()
  if (!user) {
    if (checking) return <div className="bd-center"><LoadingRows rows={2} label="Comprobando la sesión…" /></div>
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  // Con la contraseña inicial no ve nada más hasta elegir la suya (el backend también lo exige)
  if (user.mustChangePassword) return <FirstPasswordPage />
  return <AppLayout><Outlet /></AppLayout>
}

function RequireUsersAdmin() {
  const { user } = useAuth()
  return user && can(user.role, 'usuarios') ? <Outlet /> : <Navigate to="/" replace />
}

/** Configuración: coordinador y soporte. Los demás cambian su contraseña en /cuenta. */
function RequireSettings() {
  const { user } = useAuth()
  return user && can(user.role, 'reglas') ? <Outlet /> : <Navigate to="/cuenta" replace />
}

/** Cambiar contraseña: quien tiene Configuración la cambia ahí. */
function AccountRoute() {
  const { user } = useAuth()
  return user && can(user.role, 'reglas') ? <Navigate to="/configuracion" replace /> : <AccountPage />
}

/** Datos de la bodega: todos menos soporte, que tiene su propio panel técnico. */
function RequireWarehouse() {
  const { user } = useAuth()
  return user && can(user.role, 'ver') ? <Outlet /> : <Navigate to="/" replace />
}

/** Inicio: el tablero de la bodega o, para soporte, el panel técnico. */
function HomeRoute() {
  const { user } = useAuth()
  return user && can(user.role, 'sistema') ? <SupportPage /> : <DashboardPage />
}

function RequireImport() {
  const { user } = useAuth()
  return user && can(user.role, 'importar') ? <Outlet /> : <Navigate to="/productos" replace />
}

/** Un módulo desactivado en Configuración no tiene pantalla: vuelve al inicio. */
function RequireModule({ module }: { module: ModuleId }) {
  const modules = useModules()
  return modules[module] ? <Outlet /> : <Navigate to="/" replace />
}

export function App() {
  const { tenant } = useTheme()
  // Si cambian la moneda o el formato de fecha, las pantallas se vuelven a pintar con el formato nuevo.
  // La clave va aquí, debajo de ToastProvider, para no perder el aviso de «Configuración guardada».
  return (
    <Routes key={`${tenant.currency}|${tenant.dateFormat}`}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/restablecer" element={<ResetPasswordPage />} />
      <Route path="/recuperar" element={<RecoverPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<HomeRoute />} />
        <Route element={<RequireWarehouse />}>
        <Route path="productos" element={<ProductsPage />} />
        <Route path="productos/nuevo" element={<ProductFormPage />} />
        <Route element={<RequireImport />}>
          <Route path="productos/importar" element={<ImportPage />} />
        </Route>
        <Route path="productos/:id" element={<ProductFormPage />} />
        <Route path="productos/:id/lotes" element={<ProductLotsPage />} />
        <Route path="movimientos" element={<MovementsPage />} />
        <Route path="movimientos/nueva" element={<NewMovementPage />} />
        <Route path="movimientos/:id" element={<MovementDetailPage />} />
        <Route element={<RequireModule module="loans" />}>
          <Route path="prestamos" element={<LoansPage />} />
        </Route>
        <Route element={<RequireModule module="machines" />}>
          <Route path="maquinas" element={<MachinesPage />} />
          <Route path="maquinas/:id" element={<MachineDetailPage />} />
        </Route>
        <Route element={<RequireModule module="suppliers" />}>
          <Route path="proveedores" element={<SuppliersPage />} />
          <Route path="proveedores/:id" element={<SupplierDetailPage />} />
        </Route>
        <Route path="exportar" element={<ExportPage />} />
        </Route>
        <Route element={<RequireUsersAdmin />}>
          <Route path="usuarios" element={<UsersPage />} />
        </Route>
        <Route element={<RequireSettings />}>
          <Route path="configuracion" element={<SettingsPage />} />
        </Route>
        <Route path="mas" element={<MorePage />} />
        <Route path="cuenta" element={<AccountRoute />} />
        {import.meta.env.DEV && <Route path="dev/componentes" element={<ComponentsDevPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
