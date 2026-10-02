'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------- Tombol ---------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500/50',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-violet-600 text-white hover:bg-violet-500',
        variant === 'secondary' &&
          'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
        variant === 'ghost' && 'text-slate-300 hover:bg-slate-800',
        className,
      )}
      {...props}
    />
  )
}

/* ---------- Kartu ---------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-slate-800 bg-slate-900 shadow-sm', className)}
      {...props}
    />
  )
}

/* ---------- Chip / label status ---------- */

const chipStyles: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  yellow: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  blue: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  gray: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

export function Chip({
  color = 'gray',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof chipStyles }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        chipStyles[color],
        className,
      )}
      {...props}
    />
  )
}

export function StatusChip({ status }: { status?: string }) {
  if (status === 'banned') return <Chip color="red">Diblokir</Chip>
  if (status === 'suspended') return <Chip color="yellow">Suspend</Chip>
  return <Chip color="green">Aktif</Chip>
}

/* ---------- Field form ---------- */

const fieldClass =
  'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, props.className)} {...props} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, props.className)} {...props} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, props.className)} {...props} />
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1 block text-sm font-medium text-slate-300', className)}
      {...props}
    />
  )
}

/* ---------- Modal ---------- */

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Loading & kosong ---------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-violet-400', className)} />
}

export function EmptyState({ message = 'Tidak ada data.' }: { message?: string }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-slate-500">{message}</div>
  )
}

/* ---------- Pagination ---------- */

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
      <span className="text-sm text-slate-400">
        Halaman {page} dari {pages}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  )
}

/* ---------- Toast ---------- */

type ToastItem = { id: number; kind: 'success' | 'error'; message: string }

const ToastContext = createContext<(message: string, kind?: ToastItem['kind']) => void>(
  () => {},
)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(1)

  const push = useCallback((message: string, kind: ToastItem['kind'] = 'success') => {
    const id = idRef.current++
    setToasts((prev) => [...prev.slice(-2), { id, kind, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg',
              t.kind === 'success'
                ? 'border-emerald-500/40 bg-emerald-950 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950 text-rose-200',
            )}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
