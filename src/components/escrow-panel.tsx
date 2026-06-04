'use client'

import { useState } from 'react'
import { Shield, Lock, Unlock, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

type EscrowPhase =
  | 'locked'       // funded, seller working
  | 'ready'        // shipped — buyer can release
  | 'released'     // all funds sent to seller
  | 'disputed'
  | 'refunded'

interface EscrowPanelProps {
  phase: EscrowPhase
  totalNgn: string          // e.g. "₦90,000"
  releasedNgn?: string      // e.g. "₦40,000" for partial release
  lockedNgn?: string
  sellerName: string
  onRelease?: () => Promise<void>
  onDispute?: (reason: string) => Promise<void>
  /** If milestones exist, show them */
  milestones?: Array<{
    id: string
    title: string
    amountNgn: string
    status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'RELEASED' | 'DISPUTED'
    onRelease?: () => Promise<void>
  }>
}

const PHASE_CONFIG: Record<EscrowPhase, {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
  bg: string
  border: string
  description: string
}> = {
  locked: {
    icon: Lock,
    label: 'In escrow',
    color: 'text-primary',
    bg: 'bg-primary/8',
    border: 'border-primary/20',
    description: 'Your payment is held securely. It will be released to the seller when you confirm delivery.',
  },
  ready: {
    icon: Unlock,
    label: 'Ready to release',
    color: 'text-accent',
    bg: 'bg-accent/8',
    border: 'border-accent/25',
    description: 'The seller has marked this as shipped. Confirm you received it to release the payment.',
  },
  released: {
    icon: CheckCircle2,
    label: 'Released',
    color: 'text-success',
    bg: 'bg-success/8',
    border: 'border-success/25',
    description: 'Payment has been released to the seller. Thank you for your order.',
  },
  disputed: {
    icon: AlertTriangle,
    label: 'Disputed',
    color: 'text-destructive',
    bg: 'bg-destructive/8',
    border: 'border-destructive/25',
    description: "Your dispute has been filed. Maya's team will review and contact both parties.",
  },
  refunded: {
    icon: CheckCircle2,
    label: 'Refunded',
    color: 'text-muted',
    bg: 'bg-border/30',
    border: 'border-border',
    description: 'This order was refunded. Funds will return to your account within 2–5 business days.',
  },
}

const MILESTONE_STATUS_CONFIG = {
  PENDING: { label: 'Pending', dot: 'bg-border', text: 'text-muted' },
  IN_PROGRESS: { label: 'In progress', dot: 'bg-gold', text: 'text-foreground' },
  SUBMITTED: { label: 'Awaiting approval', dot: 'bg-accent', text: 'text-accent' },
  RELEASED: { label: 'Released', dot: 'bg-success', text: 'text-success' },
  DISPUTED: { label: 'Disputed', dot: 'bg-destructive', text: 'text-destructive' },
}

export function EscrowPanel({
  phase,
  totalNgn,
  releasedNgn,
  lockedNgn,
  sellerName,
  onRelease,
  onDispute,
  milestones,
}: EscrowPanelProps) {
  const cfg = PHASE_CONFIG[phase]
  const Icon = cfg.icon

  const [releasing, setReleasing] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputing, setDisputing] = useState(false)
  const [milestonesOpen, setMilestonesOpen] = useState(true)
  const [milestoneReleasing, setMilestoneReleasing] = useState<string | null>(null)

  const handleRelease = async () => {
    if (!onRelease || releasing) return
    setReleasing(true)
    try {
      await onRelease()
    } finally {
      setReleasing(false)
    }
  }

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onDispute || disputing) return
    setDisputing(true)
    try {
      await onDispute(disputeReason)
      setDisputeOpen(false)
    } finally {
      setDisputing(false)
    }
  }

  const handleMilestoneRelease = async (m: NonNullable<EscrowPanelProps['milestones']>[number]) => {
    if (!m.onRelease || milestoneReleasing) return
    setMilestoneReleasing(m.id)
    try {
      await m.onRelease()
    } finally {
      setMilestoneReleasing(null)
    }
  }

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-5 h-5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-sans text-sm font-bold text-foreground">Escrow protection</p>
            <span className={`font-sans text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <p className="font-sans text-xs text-muted mt-0.5 leading-relaxed">{cfg.description}</p>
        </div>
      </div>

      {/* Money visualization */}
      <div className="px-5 pb-4">
        <div className="bg-card rounded-xl border border-border p-4">
          {/* Flow: Buyer → Escrow → Seller */}
          <div className="flex items-center gap-2 mb-4">
            {/* Buyer */}
            <div className="flex-1 text-center">
              <div className="w-9 h-9 rounded-full bg-border/40 flex items-center justify-center mx-auto mb-1.5">
                <span className="font-sans text-xs font-bold text-muted">YOU</span>
              </div>
              <p className="font-sans text-[10px] text-muted">Buyer</p>
            </div>

            {/* Arrow + escrow box */}
            <div className="flex-[2] flex flex-col items-center gap-1">
              <div className={`w-full rounded-xl border-2 ${
                phase === 'released' ? 'border-success/40 bg-success/8' : 'border-primary/30 bg-primary/8'
              } px-3 py-2.5 text-center`}>
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Shield className={`w-3.5 h-3.5 ${phase === 'released' ? 'text-success' : 'text-primary'}`} />
                  <span className="font-sans text-[10px] font-bold text-muted uppercase tracking-wide">
                    {phase === 'released' ? 'Released' : 'Escrow'}
                  </span>
                </div>
                <p className={`font-serif text-xl font-normal ${phase === 'released' ? 'text-success' : 'text-primary'}`}>
                  {phase === 'released' ? totalNgn : (lockedNgn ?? totalNgn)}
                </p>
                {releasedNgn && phase !== 'released' && (
                  <p className="font-sans text-[10px] text-success mt-0.5">
                    {releasedNgn} released
                  </p>
                )}
              </div>
              {/* Dashed arrows */}
              <div className="flex items-center w-full px-2 gap-1">
                <div className="flex-1 h-px border-t-2 border-dashed border-border" />
                <span className="font-sans text-[9px] text-muted uppercase tracking-wider whitespace-nowrap px-1">protected</span>
                <div className="flex-1 h-px border-t-2 border-dashed border-border" />
              </div>
            </div>

            {/* Seller */}
            <div className="flex-1 text-center">
              <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-1.5">
                <span className="font-sans text-[10px] font-bold text-accent">
                  {sellerName.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <p className="font-sans text-[10px] text-muted truncate">{sellerName.split(' ')[0]}</p>
            </div>
          </div>

          {/* Amount breakdown */}
          {releasedNgn && lockedNgn && phase !== 'released' && (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
              <div className="text-center">
                <p className="font-sans text-[10px] text-muted uppercase tracking-wide">Released</p>
                <p className="font-sans text-sm font-bold text-success">{releasedNgn}</p>
              </div>
              <div className="text-center">
                <p className="font-sans text-[10px] text-muted uppercase tracking-wide">Still locked</p>
                <p className="font-sans text-sm font-bold text-primary">{lockedNgn}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      {milestones && milestones.length > 0 && (
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={() => setMilestonesOpen(v => !v)}
            className="w-full flex items-center justify-between py-2 font-sans text-sm font-semibold text-foreground"
          >
            <span>Milestones ({milestones.filter(m => m.status === 'RELEASED').length}/{milestones.length} done)</span>
            {milestonesOpen ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
          </button>

          {milestonesOpen && (
            <div className="space-y-2 mt-1">
              {milestones.map((m) => {
                const mCfg = MILESTONE_STATUS_CONFIG[m.status]
                return (
                  <div key={m.id} className={`bg-card rounded-xl border p-3.5 flex items-center gap-3 ${
                    m.status === 'SUBMITTED' ? 'border-accent/40' : 'border-border'
                  }`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${mCfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-sans text-sm font-semibold leading-tight ${m.status === 'RELEASED' ? 'text-muted line-through' : 'text-foreground'}`}>
                        {m.title}
                      </p>
                      <p className={`font-sans text-[10px] mt-0.5 ${mCfg.text}`}>{mCfg.label}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-sans text-sm font-bold text-foreground">{m.amountNgn}</p>
                      {m.status === 'SUBMITTED' && m.onRelease && (
                        <button
                          type="button"
                          onClick={() => handleMilestoneRelease(m)}
                          disabled={milestoneReleasing !== null}
                          className="mt-1 bg-accent text-white text-[10px] font-sans font-bold px-2.5 py-1 rounded-full hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {milestoneReleasing === m.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                          Release →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(phase === 'locked' || phase === 'ready') && (
        <div className="px-5 pb-5 space-y-3">
          {/* Release all button */}
          {onRelease && phase === 'ready' && (
            <button
              type="button"
              onClick={handleRelease}
              disabled={releasing}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-sans font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-lg shadow-primary/20"
            >
              {releasing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Releasing payment…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> I received it — release payment</>
              )}
            </button>
          )}

          {/* 48h auto-release note */}
          {phase === 'ready' && (
            <p className="font-sans text-[10px] text-muted text-center">
              Payment auto-releases after 48 hours if not disputed
            </p>
          )}

          {/* Dispute */}
          {onDispute && !disputeOpen && (
            <button
              type="button"
              onClick={() => setDisputeOpen(true)}
              className="w-full py-3 rounded-xl border border-border font-sans text-sm font-semibold text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Something is wrong — raise a dispute
            </button>
          )}

          {disputeOpen && (
            <form onSubmit={handleDispute} className="space-y-3 bg-card rounded-xl border border-border p-4">
              <p className="font-sans text-sm font-semibold text-foreground">What went wrong?</p>
              <textarea
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                placeholder="Describe the issue so Maya can help resolve it."
                rows={3}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl font-sans text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-destructive/40 resize-none"
                style={{ fontSize: '16px' }}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={disputing}
                  className="flex-1 flex items-center justify-center gap-2 bg-destructive text-white py-3 rounded-xl font-sans font-bold text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {disputing ? <><Loader2 className="w-4 h-4 animate-spin" /> Filing…</> : 'File dispute'}
                </button>
                <button
                  type="button"
                  onClick={() => { setDisputeOpen(false); setDisputeReason('') }}
                  className="px-4 py-3 rounded-xl border border-border font-sans text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Released / Refunded state */}
      {(phase === 'released' || phase === 'refunded') && (
        <div className="px-5 pb-5">
          <div className={`flex items-center gap-3 rounded-xl p-4 border ${
            phase === 'released' ? 'bg-success/8 border-success/25' : 'bg-border/20 border-border'
          }`}>
            <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${phase === 'released' ? 'text-success' : 'text-muted'}`} />
            <p className="font-sans text-sm text-muted leading-relaxed">
              {phase === 'released'
                ? `Payment of ${totalNgn} has been sent to ${sellerName}.`
                : 'This order has been refunded. Funds will return within 2–5 business days.'}
            </p>
          </div>
        </div>
      )}

      {/* Disputed state */}
      {phase === 'disputed' && (
        <div className="px-5 pb-5">
          <div className="flex items-start gap-3 rounded-xl p-4 bg-destructive/8 border border-destructive/25">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-sans text-sm font-semibold text-destructive">Dispute filed</p>
              <p className="font-sans text-xs text-muted mt-1">Maya's team will review and contact both parties within 24 hours. Funds remain held in escrow.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
