import type * as React from 'react';
export type Role = 'coordinador' | 'operador' | 'lectura';
export type Action = 'ver' | 'solicitar' | 'autorizar' | 'prestar' | 'administrar' | 'usuarios';
export declare function can(role: Role, action: Action): boolean;
export interface RoleGateProps { role: Role; action: Action; children?: React.ReactNode; fallback?: React.ReactNode }
export declare function RoleGate(props: RoleGateProps): React.ReactElement | null;
export interface Brand { name: string; shortName?: string; product?: string; logoSrc?: string }
export interface User { name: string; role: Role }
export interface Alert { tone?: 'danger' | 'pending' | 'info'; title: string; meta?: string; href?: string; icon?: string }

export interface IconProps { name: string; size?: number; label?: string; className?: string }
export declare function Icon(props: IconProps): React.ReactElement;
export interface BrandMarkProps { brand: Brand; layout?: 'stack' | 'row' }
export declare function BrandMark(props: BrandMarkProps): React.ReactElement;
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'ok' | 'danger' | 'danger-outline'; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: string; iconRight?: string; block?: boolean; loading?: boolean; as?: 'button' | 'a'; href?: string }
export declare function Button(props: ButtonProps): React.ReactElement;
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: string; label: string; variant?: 'outline'; size?: 'lg' }
export declare function IconButton(props: IconButtonProps): React.ReactElement;
export type Status = 'pendiente' | 'autorizado' | 'rechazado' | 'prestado' | 'devuelto' | 'activo' | 'inactivo' | 'stock-bajo' | 'vencido' | 'por-vencer' | 'vigente' | 'sin-lote' | 'solo-lectura';
export interface StatusBadgeProps { status: Status; label?: string; detail?: string; explain?: boolean; size?: 'lg' }
export declare function StatusBadge(props: StatusBadgeProps): React.ReactElement;
export interface TypeTagProps { type: 'entrada' | 'salida' | 'ajuste' }
export declare function TypeTag(props: TypeTagProps): React.ReactElement;
export declare function CodeTag(props: { children?: React.ReactNode }): React.ReactElement;
export interface StockMeterProps { current: number; min: number; max: number; unit?: string; compact?: boolean }
export declare function StockMeter(props: StockMeterProps): React.ReactElement;
export interface KpiItem { label: string; value: React.ReactNode; icon?: string; hint?: string; tone?: 'danger' | 'pending' | 'info'; href?: string }
export interface KpiStripProps { items: KpiItem[] }
export declare function KpiStrip(props: KpiStripProps): React.ReactElement;
export interface PanelProps { title?: React.ReactNode; icon?: string; count?: React.ReactNode; actions?: React.ReactNode; tone?: 'danger' | 'pending'; flush?: boolean; children?: React.ReactNode; className?: string }
export declare function Panel(props: PanelProps): React.ReactElement;
export interface Column<R> { key: string; header: React.ReactNode; render?: (row: R) => React.ReactNode; align?: 'right'; width?: number | string; mobile?: 'title' | 'subtitle' | 'badge' | 'meta' | 'wide' | 'hidden'; mobileLabel?: string }
export interface DataTableProps<R = any> { columns: Column<R>[]; rows?: R[]; rowKey?: string; rowTone?: (row: R) => 'danger' | 'pending' | 'selected' | 'muted' | null; onRowClick?: (row: R) => void; actions?: ((row: R) => React.ReactNode) | null; mobileActions?: ((row: R) => React.ReactNode) | null; state?: 'ready' | 'loading' | 'empty' | 'error'; empty?: { icon?: string; title?: string; text?: string; action?: React.ReactNode }; onRetry?: () => void; caption?: string; loadingLabel?: string }
export declare function DataTable<R>(props: DataTableProps<R>): React.ReactElement;
export interface FieldProps { label?: React.ReactNode; htmlFor?: string; required?: boolean; optional?: boolean; hint?: React.ReactNode; error?: React.ReactNode; className?: string; children?: React.ReactNode }
export declare function Field(props: FieldProps): React.ReactElement;
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> { icon?: string; suffix?: string; readOnlyValue?: React.ReactNode }
export declare function TextInput(props: TextInputProps): React.ReactElement;
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { options: (string | { value: string; label: string })[]; placeholder?: string }
export declare function Select(props: SelectProps): React.ReactElement;
export declare function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.ReactElement;
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> { label: React.ReactNode }
export declare function Checkbox(props: CheckboxProps): React.ReactElement;
export interface QuantityStepperProps { value?: number; defaultValue?: number; min?: number; max?: number; unit?: string; onChange?: (n: number) => void; id?: string; label?: string }
export declare function QuantityStepper(props: QuantityStepperProps): React.ReactElement;
export declare function FilterBar(props: { children?: React.ReactNode }): React.ReactElement;
export declare function SearchInput(props: TextInputProps): React.ReactElement;
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { pressed?: boolean; count?: number; icon?: string }
export declare function Chip(props: ChipProps): React.ReactElement;
export interface SegmentedProps { options: { value: string; label: React.ReactNode; icon?: string }[]; value?: string; onChange?: (v: string) => void; label?: string }
export declare function Segmented(props: SegmentedProps): React.ReactElement;
export interface NoticeProps { tone?: 'danger' | 'pending' | 'ok' | 'info'; title?: React.ReactNode; children?: React.ReactNode; code?: string; actions?: React.ReactNode; icon?: string }
export declare function Notice(props: NoticeProps): React.ReactElement;
export interface ToastProps { tone?: 'ok' | 'danger'; children?: React.ReactNode; onClose?: () => void }
export declare function Toast(props: ToastProps): React.ReactElement;
export interface ModalProps { open?: boolean; title: string; icon?: string; tone?: 'ok' | 'danger'; children?: React.ReactNode; footer?: React.ReactNode; onClose?: () => void; contained?: boolean }
export declare function Modal(props: ModalProps): React.ReactElement | null;
export interface ConfirmDialogProps { title: string; tone?: 'ok' | 'danger' | 'brand'; icon?: string; children?: React.ReactNode; consequences?: [React.ReactNode, React.ReactNode][]; confirmLabel?: string; cancelLabel?: string; confirmIcon?: string; onConfirm?: () => void; onCancel?: () => void; contained?: boolean; reason?: React.ReactNode; loading?: boolean }
export declare function ConfirmDialog(props: ConfirmDialogProps): React.ReactElement;
export interface NotificationBellProps { count?: number; open?: boolean; onToggle?: () => void }
export declare function NotificationBell(props: NotificationBellProps): React.ReactElement;
export declare function AlertsPanel(props: { alerts?: Alert[]; onClose?: () => void }): React.ReactElement;
export interface AppShellProps { brand: Brand; user: User; current?: string; pendingCount?: number; alerts?: Alert[]; alertsOpen?: boolean; onNavigate?: (id: string) => void; onToggleAlerts?: () => void; banner?: React.ReactNode; overlay?: React.ReactNode; children?: React.ReactNode }
export declare function AppShell(props: AppShellProps): React.ReactElement;
export interface PageHeaderProps { title: React.ReactNode; subtitle?: React.ReactNode; back?: string; actions?: React.ReactNode }
export declare function PageHeader(props: PageHeaderProps): React.ReactElement;
export interface EmptyStateProps { icon?: string; title: React.ReactNode; text?: React.ReactNode; action?: React.ReactNode; tone?: 'error' }
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;
export interface LoadingRowsProps { rows?: number; label?: string }
export declare function LoadingRows(props: LoadingRowsProps): React.ReactElement;
export interface ConnectionErrorProps { onRetry?: () => void; variant?: 'block' | 'banner'; text?: string }
export declare function ConnectionError(props: ConnectionErrorProps): React.ReactElement;
export interface MovementFlowProps { status?: 'pendiente' | 'autorizado' | 'rechazado'; requested?: { by?: string; at?: string }; reviewed?: { by?: string; at?: string; reason?: string } }
export declare function MovementFlow(props: MovementFlowProps): React.ReactElement;
export interface StockImpactProps { before: number; after: number; unit?: string; status?: 'pendiente' | 'autorizado' | 'rechazado'; blocked?: boolean; label?: string }
export declare function StockImpact(props: StockImpactProps): React.ReactElement;
declare global { interface Window { Bodega: typeof import('./index') } }
