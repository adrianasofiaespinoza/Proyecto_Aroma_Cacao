import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'
import { AppLayout } from './AppLayout'
import { can } from '../lib/permissions'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { ProductsPage } from '../pages/products/ProductsPage'
import { ProductFormPage } from '../pages/products/ProductFormPage'
import { ProductLotsPage } from '../pages/products/ProductLotsPage'
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
import { ComponentsDevPage } from '../pages/ComponentsDevPage'
import { LoadingRows } from '../components/ui'

function RequireAuth() {
  const { user, checking } = useAuth()
  const location = useLocation()
  if (!user) {
    if (checking) return <div className="bd-center"><LoadingRows rows={2} label="Comprobando la sesión…" /></div>
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <AppLayout><Outlet /></AppLayout>
}

function RequireUsersAdmin() {
  const { user } = useAuth()
  return user && can(user.role, 'usuarios') ? <Outlet /> : <Navigate to="/" replace />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="productos/nuevo" element={<ProductFormPage />} />
        <Route path="productos/:id" element={<ProductFormPage />} />
        <Route path="productos/:id/lotes" element={<ProductLotsPage />} />
        <Route path="movimientos" element={<MovementsPage />} />
        <Route path="movimientos/nueva" element={<NewMovementPage />} />
        <Route path="movimientos/:id" element={<MovementDetailPage />} />
        <Route path="prestamos" element={<LoansPage />} />
        <Route path="maquinas" element={<MachinesPage />} />
        <Route path="maquinas/:id" element={<MachineDetailPage />} />
        <Route path="proveedores" element={<SuppliersPage />} />
        <Route path="proveedores/:id" element={<SupplierDetailPage />} />
        <Route element={<RequireUsersAdmin />}>
          <Route path="usuarios" element={<UsersPage />} />
        </Route>
        <Route path="mas" element={<MorePage />} />
        {import.meta.env.DEV && <Route path="dev/componentes" element={<ComponentsDevPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
