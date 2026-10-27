import React, { useEffect, useId, useRef } from 'react';
import { Loader2, X, type LucideIcon } from 'lucide-react';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

/* -------------------------------------------------------------
   Admin design system primitives (shadcn-style, token based).
   Presentation only: no data access, no business logic.
   They reuse the existing tokens in index.css (bg-surface,
   border-line, text-ink, ...) so light/dark keeps working.
   ------------------------------------------------------------- */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------- Buttons ---------- */

export type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AdminButtonSize = 'sm' | 'md';

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap select-none cursor-pointer transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const BTN_VARIANT: Record<AdminButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-soft border border-accent',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-hover',
  ghost: 'bg-transparent text-body border border-transparent hover:bg-surface-hover hover:text-ink',
  danger: 'bg-danger text-white border border-danger hover:bg-danger/85',
};

const BTN_SIZE: Record<AdminButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
};

export function buttonClass(variant: AdminButtonVariant = 'secondary', size: AdminButtonSize = 'md', extra = ''): string {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], extra);
}

interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  isLoading?: boolean;
  icon?: LucideIcon;
}

export const AdminButton: React.FC<AdminButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  icon: Icon,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}) => (
  <button type={type} disabled={disabled || isLoading} className={buttonClass(variant, size, className)} {...props}>
    {isLoading ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
    ) : Icon ? (
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
    ) : null}
    {children}
  </button>
);

/* ---------- Form fields ---------- */

export const inputClass =
  'w-full h-9 px-3 rounded-lg bg-surface border border-line-strong text-sm text-ink placeholder:text-muted ' +
  'focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export const textareaClass = inputClass.replace('h-9 ', 'min-h-20 py-2 ');

export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, htmlFor, hint, error, required, children, className }) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={htmlFor} className="block text-xs font-medium text-heading">
      {label}
      {required && (
        <span className="text-danger ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </label>
    {children}
    {hint && !error && <p className="text-[11px] text-muted">{hint}</p>}
    {error && (
      <p role="alert" className="text-[11px] text-danger">
        {error}
      </p>
    )}
  </div>
);

/* ---------- Surfaces ---------- */

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('bg-surface border border-line rounded-xl', className)} {...props} />
);

export const CardHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  titleAs?: 'h2' | 'h3';
  className?: string;
}> = ({ title, description, action, titleAs: Title = 'h3', className }) => (
  <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-line', className)}>
    <div className="min-w-0">
      <Title className="font-heading text-sm font-semibold text-ink">{title}</Title>
      {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
    </div>
    {action && <div className="flex items-center gap-2 flex-wrap shrink-0">{action}</div>}
  </div>
);

/* ---------- Page header + breadcrumb ---------- */

export const PageHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 className="font-heading text-xl sm:text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      {description && <p className="text-sm text-body mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
  </div>
);

export interface Crumb {
  label: string;
  path?: string;
}

export const Breadcrumb: React.FC<{ items: Crumb[]; onNavigate: (path: string) => void }> = ({ items, onNavigate }) => (
  <nav aria-label="Breadcrumb" className="min-w-0">
    <ol className="flex items-center gap-1.5 text-xs text-muted min-w-0">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <span aria-hidden="true" className="text-line-strong">
                /
              </span>
            )}
            {item.path && !last ? (
              <a
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.path as string);
                }}
                className="hover:text-ink transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {item.label}
              </a>
            ) : (
              <span aria-current={last ? 'page' : undefined} className={cn('truncate', last && 'text-ink font-medium')}>
                {item.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

/* ---------- Badges ---------- */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-hover text-body',
  accent: 'bg-accent-wash text-accent',
  success: 'bg-sage/10 text-sage',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
};

export const Badge: React.FC<{ tone?: BadgeTone; dot?: boolean; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  dot = false,
  children,
  className,
}) => (
  <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium', BADGE_TONE[tone], className)}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
    {children}
  </span>
);

/* ---------- Stat card ---------- */

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: 'accent' | 'warning' | 'info' | 'success';
  footer?: React.ReactNode;
  onClick?: () => void;
}> = ({ label, value, icon: Icon, tone = 'accent', footer, onClick }) => {
  const toneClass = {
    accent: 'bg-accent-wash text-accent',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
    success: 'bg-sage/10 text-sage',
  }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-body">{label}</span>
        <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', toneClass)}>
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
      <div className="font-heading text-2xl sm:text-3xl font-semibold text-ink tracking-tight mt-3">{value}</div>
      {footer && <div className="mt-1.5 text-xs text-muted">{footer}</div>}
    </>
  );
  const cls = 'p-4 sm:p-5 bg-surface border border-line rounded-xl text-left w-full';
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls, 'cursor-pointer hover:border-line-strong hover:bg-surface-hover/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent')}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

/* ---------- Segmented control (filters, timeframe) ---------- */

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center p-0.5 bg-surface-hover rounded-lg text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-2.5 h-7 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            value === o.value ? 'bg-surface text-ink font-medium shadow-xs' : 'text-muted hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */

export const EmptyState: React.FC<{
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6">
    <span className="w-10 h-10 rounded-full bg-surface-hover text-muted flex items-center justify-center">
      <Icon className="w-5 h-5" aria-hidden="true" />
    </span>
    <p className="text-sm font-medium text-ink mt-3">{title}</p>
    {description && <p className="text-xs text-muted mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ---------- Dialog ---------- */

export const Dialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}> = ({ open, onClose, title, description, children, footer, size = 'sm' }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

  // Move focus into the dialog on open and restore it on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('w-full bg-surface border border-line rounded-xl shadow-xl animate-modal-content focus:outline-none max-h-[90vh] flex flex-col', width)}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h3 id={titleId} className="font-heading text-base font-semibold text-ink">
              {title}
            </h3>
            {description && <p className="text-sm text-body mt-1.5 leading-relaxed">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 -m-1 text-muted hover:text-ink rounded-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {children && <div className="px-5 py-4 overflow-y-auto">{children}</div>}
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-line mt-2">{footer}</div>}
        {!children && !footer && <div className="pb-5" />}
      </div>
    </div>
  );
};

/* ---------- Skeletons ---------- */

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cn('skeleton-shimmer rounded-md', className)} />
);

export const StatGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div role="status" aria-label="Memuat ringkasan" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-4 sm:p-5 bg-surface border border-line rounded-xl space-y-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-7 w-16" />
        <SkeletonBlock className="h-3 w-28" />
      </div>
    ))}
  </div>
);
