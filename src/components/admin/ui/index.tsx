// Shared admin UI primitives — daisyUI-flavored, no antd.
// Extracted as pages migrate (Phase 6); keep APIs minimal.
import { useEffect, useState, type ReactNode } from 'react';
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

const controlBase =
  'w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 transition-colors focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="block text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

export function AdminInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, className)} {...props} />;
}

export function AdminSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlBase, className)} {...props}>
      {children}
    </select>
  );
}

// Number input with id-ID thousand separators (replaces antd InputNumber).
export function AdminNumberInput({
  value,
  onChange,
  min,
  max,
  prefix,
  placeholder,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('id-ID') : '');
  useEffect(() => {
    setDisplay(value != null ? value.toLocaleString('id-ID') : '');
  }, [value]);

  const commit = (raw: string) => {
    const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const n = digits ? Number(digits) : null;
    setDisplay(n != null ? n.toLocaleString('id-ID') : '');
    onChange(n);
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        className={cn(controlBase, 'font-semibold tabular-nums', prefix && 'pl-10', className)}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => {
          if (!display) return;
          let n = Number(display.replace(/\D/g, ''));
          if (min != null && n < min) n = min;
          if (max != null && n > max) n = max;
          setDisplay(n.toLocaleString('id-ID'));
          onChange(n);
        }}
      />
    </div>
  );
}

export function ChipToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
        active
          ? 'border-stone-800 bg-stone-800 text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
      )}
    >
      {active && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

// Scrollable modal: header/footer stay pinned, body scrolls (mobile = bottom sheet).
export function AdminModal({
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/30 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-lg' : 'sm:max-w-md'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 md:px-6">
          <h2 className="truncate text-base font-black uppercase tracking-tight text-gray-900 md:text-lg">{title}</h2>
          <button className="btn btn-ghost btn-sm btn-circle shrink-0" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-5 py-3 md:px-6">{footer}</div>
        )}
      </div>
    </div>
  );
}
