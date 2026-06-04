import { Check, Circle, Package, Truck, MapPin, ShieldCheck, Star, Clock } from 'lucide-react'

export type TrackingStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETE'

export interface TrackingStep {
  key: TrackingStatus
  label: string
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  timestamp?: string | null
  note?: string | null
}

interface OrderTrackerProps {
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  createdAt: string
  paidAt?: string | null
  shippedAt?: string | null
  shippingNote?: string | null
  /** Escrow already released? */
  released?: boolean
}

const STEPS: TrackingStep[] = [
  {
    key: 'PENDING',
    label: 'Order placed',
    sublabel: 'Awaiting payment',
    icon: Circle,
  },
  {
    key: 'PAID',
    label: 'Payment in escrow',
    sublabel: 'Funds held securely',
    icon: ShieldCheck,
  },
  {
    key: 'PROCESSING',
    label: 'Being prepared',
    sublabel: 'Seller is working on your order',
    icon: Package,
  },
  {
    key: 'SHIPPED',
    label: 'Shipped',
    sublabel: 'On its way to you',
    icon: Truck,
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    sublabel: 'Confirm receipt to release payment',
    icon: MapPin,
  },
  {
    key: 'COMPLETE',
    label: 'Complete',
    sublabel: 'Payment released to seller',
    icon: Star,
  },
]

function statusToActiveIndex(
  dbStatus: OrderTrackerProps['status'],
  released: boolean,
): number {
  if (dbStatus === 'CANCELLED') return -1
  if (released || dbStatus === 'DELIVERED') return 5
  if (dbStatus === 'SHIPPED') return 3
  if (dbStatus === 'PAID') return 2
  if (dbStatus === 'PENDING') return 0
  return 0
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(Math.abs(ms) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return ''
}

export function OrderTracker({
  status,
  createdAt,
  paidAt,
  shippedAt,
  shippingNote,
  released = false,
}: OrderTrackerProps) {
  const activeIndex = statusToActiveIndex(status, released)

  const timestamps: Partial<Record<TrackingStatus, string | null>> = {
    PENDING: createdAt,
    PAID: paidAt ?? null,
    SHIPPED: shippedAt ?? null,
    DELIVERED: status === 'DELIVERED' ? shippedAt : null,
  }

  if (status === 'CANCELLED') {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-destructive text-xl">✕</span>
        </div>
        <p className="font-sans font-semibold text-destructive">Order cancelled</p>
        <p className="font-sans text-sm text-muted mt-1">{formatTs(createdAt)}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted" />
          <span className="font-sans text-sm font-semibold text-foreground">Order progress</span>
        </div>
        <span className={`font-sans text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
          released
            ? 'bg-success/15 text-success'
            : status === 'DELIVERED'
            ? 'bg-primary/15 text-primary'
            : status === 'SHIPPED'
            ? 'bg-gold/20 text-foreground'
            : status === 'PAID'
            ? 'bg-accent/15 text-accent'
            : 'bg-border text-muted'
        }`}>
          {released ? 'Complete' : status === 'PENDING' ? 'Awaiting payment' : status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      </div>

      {/* Desktop — horizontal stepper */}
      <div className="hidden sm:block px-6 py-8">
        <div className="relative flex items-start justify-between">
          {/* Background connecting line */}
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" />
          {/* Filled progress line */}
          <div
            className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-700"
            style={{ width: `${(activeIndex / (STEPS.length - 1)) * 100}%`, right: 'auto' }}
          />

          {STEPS.map((step, i) => {
            const done = i < activeIndex
            const active = i === activeIndex
            const upcoming = i > activeIndex
            const Icon = step.icon
            const ts = timestamps[step.key]

            return (
              <div key={step.key} className="relative flex flex-col items-center flex-1">
                {/* Circle */}
                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  done
                    ? 'bg-primary border-primary'
                    : active
                    ? 'bg-card border-primary shadow-lg shadow-primary/25'
                    : 'bg-card border-border'
                }`}>
                  {done ? (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  ) : (
                    <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted'}`} />
                  )}
                  {/* Pulse for active */}
                  {active && (
                    <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
                  )}
                </div>

                {/* Labels */}
                <div className="mt-3 text-center max-w-[90px]">
                  <p className={`font-sans text-xs font-semibold leading-tight ${
                    done ? 'text-primary' : active ? 'text-foreground' : 'text-muted'
                  }`}>
                    {step.label}
                  </p>
                  {ts && (
                    <p className="font-sans text-[10px] text-muted mt-1 leading-tight">
                      {relativeTime(ts) || formatTs(ts).split(',')[0]}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile — vertical stepper */}
      <div className="sm:hidden px-5 py-5 space-y-0">
        {STEPS.map((step, i) => {
          const done = i < activeIndex
          const active = i === activeIndex
          const isLast = i === STEPS.length - 1
          const Icon = step.icon
          const ts = timestamps[step.key]

          return (
            <div key={step.key} className="flex gap-4">
              {/* Left — icon + connector */}
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                  done
                    ? 'bg-primary border-primary'
                    : active
                    ? 'bg-card border-primary shadow-md shadow-primary/20'
                    : 'bg-card border-border'
                }`}>
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
                  ) : (
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'text-muted/40'}`} />
                  )}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1.5 min-h-[20px] ${done ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>

              {/* Right — content */}
              <div className={`pb-5 flex-1 ${isLast ? '' : ''}`}>
                <p className={`font-sans text-sm font-semibold leading-snug ${
                  done ? 'text-primary' : active ? 'text-foreground' : 'text-muted/60'
                }`}>
                  {step.label}
                </p>
                {(active || done) && (
                  <p className="font-sans text-xs text-muted mt-0.5">{step.sublabel}</p>
                )}
                {ts && (
                  <p className="font-sans text-[10px] text-muted/70 mt-1 tabular-nums">
                    {formatTs(ts)}
                    {relativeTime(ts) && ` · ${relativeTime(ts)}`}
                  </p>
                )}
                {/* Shipping note on SHIPPED step */}
                {step.key === 'SHIPPED' && shippingNote && done && (
                  <div className="mt-2 bg-border/20 rounded-lg px-3 py-2">
                    <p className="font-sans text-xs text-muted italic">"{shippingNote}"</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Shipping note on desktop */}
      {shippingNote && (status === 'SHIPPED' || status === 'DELIVERED') && (
        <div className="hidden sm:block px-6 pb-5">
          <div className="bg-border/20 rounded-xl px-4 py-3 flex items-start gap-2">
            <Truck className="w-3.5 h-3.5 text-muted mt-0.5 flex-shrink-0" />
            <p className="font-sans text-xs text-muted leading-relaxed">
              <span className="font-semibold text-foreground">Seller note: </span>
              "{shippingNote}"
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
