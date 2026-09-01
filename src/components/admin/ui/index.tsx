// Shared admin UI primitives — daisyUI-flavored, no antd.
// Extracted as pages migrate (Phase 6); keep APIs minimal.
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export function AdminCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'error';
}) {
  const toneCls = {
    default: 'text-gray-900',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  }[tone];
  return (
    <AdminCard className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold', toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </AdminCard>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'neutral';

export function AdminButton({
  variant = 'primary',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'btn btn-primary',
    ghost: 'btn btn-ghost border border-gray-200',
    danger: 'btn btn-error',
    neutral: 'btn btn-neutral',
  };
  return (
    <button className={cn(variants[variant], 'min-h-0 h-9', className)} {...props}>
      {children}
    </button>
  );
}
