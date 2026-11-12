/** Consultas y mutaciones con TanStack Query. Las claves viven aquí para invalidar con precisión. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './endpoints'
import type { MovementStatus, MovementType } from './types'

export const keys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  units: ['units'] as const,
  products: ['products'] as const,
  product: (id: number) => ['products', id] as const,
  lots: ['lots'] as const,
  movements: (params?: { status?: MovementStatus; type?: MovementType }) => ['movements', params ?? {}] as const,
  movement: (id: number) => ['movements', 'one', id] as const,
  alerts: ['alerts'] as const,
  machines: ['machines'] as const,
  loans: ['loans'] as const,
  workers: ['workers'] as const,
  suppliers: ['suppliers'] as const,
  users: ['users'] as const,
}

const CATALOG = { staleTime: 10 * 60_000 }

export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: api.getCategories, ...CATALOG })
export const useUnits = () => useQuery({ queryKey: keys.units, queryFn: api.getUnits, ...CATALOG })
export const useProducts = () => useQuery({ queryKey: keys.products, queryFn: api.getProducts })
export const useProduct = (id: number) => useQuery({ queryKey: keys.product(id), queryFn: () => api.getProduct(id), enabled: Number.isFinite(id) })
export const useLots = () => useQuery({ queryKey: keys.lots, queryFn: () => api.getLots() })
export const useMovements = (params?: { status?: MovementStatus; type?: MovementType }) =>
  useQuery({ queryKey: keys.movements(params), queryFn: () => api.getMovements(params) })
export const useMovement = (id: number) => useQuery({ queryKey: keys.movement(id), queryFn: () => api.getMovement(id), enabled: Number.isFinite(id) })
export const useAlerts = () => useQuery({ queryKey: keys.alerts, queryFn: api.getAlerts, refetchInterval: 60_000 })
export const useMachines = () => useQuery({ queryKey: keys.machines, queryFn: api.getMachines })
export const useLoans = () => useQuery({ queryKey: keys.loans, queryFn: api.getLoans })
export const useWorkers = () => useQuery({ queryKey: keys.workers, queryFn: api.getWorkers })
export const useSuppliers = () => useQuery({ queryKey: keys.suppliers, queryFn: api.getSuppliers })
export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: api.getUsers })

/** Invalida un grupo de claves tras una mutación. */
function useInvalidate() {
  const qc = useQueryClient()
  return (...groups: readonly (readonly unknown[])[]) => Promise.all(groups.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

const STOCK_KEYS = [keys.products, keys.lots, keys.alerts, ['movements']] as const

export function useCreateProduct() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createProduct, onSuccess: () => inv(keys.products, keys.alerts) })
}
export function useUpdateProduct() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof api.updateProduct>[1] }) => api.updateProduct(id, input),
    onSuccess: () => inv(keys.products, keys.alerts),
  })
}
export function useDeactivateProduct() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.deactivateProduct, onSuccess: () => inv(keys.products, keys.alerts) })
}
export function useReactivateProduct() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.reactivateProduct, onSuccess: () => inv(keys.products, keys.alerts) })
}
export function useCreateLot() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: ({ productId, input }: { productId: number; input: Parameters<typeof api.createLot>[1] }) => api.createLot(productId, input),
    onSuccess: () => inv(keys.lots, keys.products),
  })
}
export function useUpdateLot() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: ({ lotId, input }: { lotId: number; input: Parameters<typeof api.updateLot>[1] }) => api.updateLot(lotId, input),
    onSuccess: () => inv(keys.lots),
  })
}
export function useCreateMovement() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createMovement, onSuccess: () => inv(['movements'], keys.alerts) })
}
export function useAuthorizeMovement() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.authorizeMovement, onSuccess: () => inv(...STOCK_KEYS) })
}
export function useRejectMovement() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.rejectMovement, onSuccess: () => inv(['movements'], keys.alerts) })
}
export function useSaveMachine() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: Parameters<typeof api.saveMachine>[1] }) => api.saveMachine(id, input),
    onSuccess: () => inv(keys.machines),
  })
}
export function useMachineProducts() {
  const inv = useInvalidate()
  const add = useMutation({ mutationFn: ({ machineId, productId }: { machineId: number; productId: number }) => api.addMachineProduct(machineId, productId), onSuccess: () => inv(keys.machines) })
  const remove = useMutation({ mutationFn: ({ machineId, productId }: { machineId: number; productId: number }) => api.removeMachineProduct(machineId, productId), onSuccess: () => inv(keys.machines) })
  return { add, remove }
}
export function useCreateLoan() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createLoan, onSuccess: () => inv(keys.loans, keys.workers) })
}
export function useReturnLoan() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.returnLoan, onSuccess: () => inv(keys.loans) })
}
export function useSaveSupplier() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: Parameters<typeof api.saveSupplier>[1] }) => api.saveSupplier(id, input),
    onSuccess: () => inv(keys.suppliers),
  })
}
export function useSupplierProducts() {
  const inv = useInvalidate()
  const add = useMutation({ mutationFn: ({ supplierId, productId, price }: { supplierId: number; productId: number; price: number | null }) => api.addSupplierProduct(supplierId, productId, price), onSuccess: () => inv(keys.suppliers) })
  const update = useMutation({ mutationFn: ({ supplierId, productId, price }: { supplierId: number; productId: number; price: number | null }) => api.updateSupplierPrice(supplierId, productId, price), onSuccess: () => inv(keys.suppliers) })
  const remove = useMutation({ mutationFn: ({ supplierId, productId }: { supplierId: number; productId: number }) => api.removeSupplierProduct(supplierId, productId), onSuccess: () => inv(keys.suppliers) })
  return { add, update, remove }
}
export function useCreateUser() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createUser, onSuccess: () => inv(keys.users) })
}
export function useUpdateUser() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof api.updateUser>[1] }) => api.updateUser(id, input),
    onSuccess: () => inv(keys.users),
  })
}
