/** Catálogos y tablas de referencia que varias pantallas necesitan a la vez, con mapas por id. */
import { useMemo } from 'react'
import { useCategories, useLoans, useLots, useMachines, useProducts, useUnits } from './hooks'
import type { Category, Loan, Lot, Machine, Product, Unit } from './types'
import { available, loanedByProduct } from '../lib/domain'
import { unitLabel } from '../lib/format'
import { isConnectionError } from '../lib/errors'

export interface Inventory {
  products: Product[]
  productById: Map<number, Product>
  categories: Category[]
  categoryById: Map<number, Category>
  units: Unit[]
  unitById: Map<number, Unit>
  lots: Lot[]
  lotById: Map<number, Lot>
  lotsByProduct: Map<number, Lot[]>
  machines: Machine[]
  machineById: Map<number, Machine>
  loans: Loan[]
  loanedByProduct: Map<number, number>
  /** Abreviatura de la unidad de un producto: «u.», «kg», «l»… */
  unitOf: (p: Pick<Product, 'unit_of_measure_id'> | undefined) => string
  /** Disponible = stock − prestado. */
  availableOf: (p: Product) => number
  isLoading: boolean
  isError: boolean
  offline: boolean
  refetch: () => void
}

export function useInventory(opts: { lots?: boolean; machines?: boolean; loans?: boolean } = {}): Inventory {
  const want = { lots: true, machines: true, loans: true, ...opts }
  const products = useProducts()
  const categories = useCategories()
  const units = useUnits()
  const lots = useLots()
  const machines = useMachines()
  const loans = useLoans()
  const queries = [products, categories, units, ...(want.lots ? [lots] : []), ...(want.machines ? [machines] : []), ...(want.loans ? [loans] : [])]

  return useMemo<Inventory>(() => {
    const productList = products.data ?? []
    const lotList = want.lots ? (lots.data ?? []) : []
    const lotsByProduct = new Map<number, Lot[]>()
    for (const l of lotList) lotsByProduct.set(l.product_id, [...(lotsByProduct.get(l.product_id) ?? []), l])
    const unitById = new Map((units.data ?? []).map((u) => [u.id, u]))
    const loaned = loanedByProduct(want.loans ? loans.data : [])
    return {
      products: productList,
      productById: new Map(productList.map((p) => [p.id, p])),
      categories: categories.data ?? [],
      categoryById: new Map((categories.data ?? []).map((c) => [c.id, c])),
      units: units.data ?? [],
      unitById,
      lots: lotList,
      lotById: new Map(lotList.map((l) => [l.id, l])),
      lotsByProduct,
      machines: want.machines ? (machines.data ?? []) : [],
      machineById: new Map((want.machines ? (machines.data ?? []) : []).map((m) => [m.id, m])),
      loans: want.loans ? (loans.data ?? []) : [],
      loanedByProduct: loaned,
      unitOf: (p) => unitLabel(p ? unitById.get(p.unit_of_measure_id)?.abbreviation : undefined),
      availableOf: (p) => available(p, loaned),
      isLoading: queries.some((q) => q.isLoading),
      isError: queries.some((q) => q.isError),
      offline: queries.some((q) => q.isError && isConnectionError(q.error)),
      refetch: () => queries.forEach((q) => void q.refetch()),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.data, categories.data, units.data, lots.data, machines.data, loans.data, products.isLoading, products.isError, categories.isError, units.isError, lots.isError, machines.isError, loans.isError, want.lots, want.machines, want.loans])
}
