'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronDown, ChevronUp, Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import {
  getOwnStallStatus,
  updateStallStatus,
  type StallStatus,
} from '@/lib/api/seller'
import { useSession } from '@/lib/auth/use-session'

const SELLER = {
  username: 'adaeze',
  memberSince: 'April 2026',
}

// Mock recovery phrase shown when the seller passes the password gate.
// In production, the client decrypts the encrypted nsec stored on the
// server using the seller's passphrase, then formats it as words.
const MOCK_RECOVERY_PHRASE =
  'verb yellow market guitar canyon harvest valley copper river orchid quiet basket'

export default function SellerSettingsPage() {
  const router = useRouter()

  // Change-password expanded form
  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaved, setPwSaved] = useState(false)

  // Recovery phrase gate
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryUnlocked, setRecoveryUnlocked] = useState(false)
  const [recoveryPw, setRecoveryPw] = useState('')
  const [showRecoveryPw, setShowRecoveryPw] = useState(false)
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [phraseCopied, setPhraseCopied] = useState(false)

  // Custody disclosure
  const [custodyOpen, setCustodyOpen] = useState(false)

  // Close shop destructive
  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  // ── Shop status (kind 30053) ─────────────────────────────────────────────
  const { user } = useSession()
  const [stallStatus, setStallStatus] = useState<StallStatus>('open')
  const [stallMessage, setStallMessage] = useState('')
  const [stallPassword, setStallPassword] = useState('')
  const [stallShowPassword, setStallShowPassword] = useState(false)
  const [stallSubmitting, setStallSubmitting] = useState(false)
  const [stallError, setStallError] = useState<string | null>(null)
  const [stallSaved, setStallSaved] = useState(false)

  // Seed the form with the seller's current status so the radio reflects
  // what's actually live on Nostr today. Silent on failure — the form
  // still works, it just defaults to "open".
  useEffect(() => {
    if (!user?.username) return
    let cancelled = false
    getOwnStallStatus(user.username)
      .then(current => {
        if (cancelled) return
        setStallStatus(current.stallStatus)
        setStallMessage(current.stallStatusMessage ?? '')
      })
      .catch(() => {
        // Defaults are fine.
      })
    return () => {
      cancelled = true
    }
  }, [user?.username])

  const handleSubmitStall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (stallSubmitting || !stallPassword) return
    setStallSubmitting(true)
    setStallError(null)
    setStallSaved(false)
    try {
      const res = await updateStallStatus({
        status: stallStatus,
        message: stallMessage.trim() || undefined,
        password: stallPassword,
      })
      setStallStatus(res.stallStatus)
      setStallMessage(res.stallStatusMessage ?? '')
      setStallPassword('')
      setStallSaved(true)
      setTimeout(() => setStallSaved(false), 4000)
    } catch (err) {
      setStallError(
        err instanceof ApiError
          ? err.message
          : 'Could not update status. Check your password and try again.',
      )
    } finally {
      setStallSubmitting(false)
    }
  }

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)

    if (!currentPw || !newPw || !confirmPw) return
    if (newPw !== confirmPw) {
      setPwError('New passwords don\'t match.')
      return
    }
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }

    setPwSubmitting(true)
    await new Promise(r => setTimeout(r, 1200))
    setPwSubmitting(false)
    setPwSaved(true)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setTimeout(() => {
      setPwSaved(false)
      setPwOpen(false)
    }, 2000)
  }

  const handleUnlockRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecoveryError(null)
    if (!recoveryPw) return
    setRecoverySubmitting(true)
    await new Promise(r => setTimeout(r, 1000))
    setRecoverySubmitting(false)
    setRecoveryUnlocked(true)
    setRecoveryPw('')
  }

  const handleCopyPhrase = () => {
    navigator.clipboard.writeText(MOCK_RECOVERY_PHRASE)
    setPhraseCopied(true)
    setTimeout(() => setPhraseCopied(false), 2000)
  }

  const handleHideRecovery = () => {
    setRecoveryUnlocked(false)
    setRecoveryOpen(false)
  }

  const handleSignOut = () => {
    router.push('/')
  }

  const handleConfirmClose = async () => {
    setClosing(true)
    await new Promise(r => setTimeout(r, 1500))
    router.push('/')
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Back-arrow header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-5 py-3 flex items-center">
          <Link
            href="/seller"
            className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-24">
        <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-10">Settings.</h1>

        {/* ACCOUNT */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-4">Account</h2>
          <div className="bg-white border border-border rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-baseline gap-4">
              <span className="font-sans text-sm text-muted">Username</span>
              <span className="font-sans text-base text-foreground tabular-nums">{SELLER.username}</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-baseline gap-4">
              <span className="font-sans text-sm text-muted">Member since</span>
              <span className="font-sans text-base text-foreground">{SELLER.memberSince}</span>
            </div>
          </div>
          <p className="font-sans text-xs text-muted mt-3">
            Your username is your shop URL slug. It can&apos;t be changed.
          </p>
        </section>

        {/* SHOP STATUS — kind 30053 published when the seller saves. */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-4">Shop status</h2>
          <form
            onSubmit={handleSubmitStall}
            className="bg-white border border-border rounded-lg p-5 space-y-5"
          >
            <p className="font-sans text-sm text-muted">
              Tell buyers whether your shop is open, on a short break, or closed. The
              banner on your storefront updates as soon as you save.
            </p>

            {/* Three options. Disabled while submitting. */}
            <fieldset className="space-y-3" disabled={stallSubmitting}>
              <legend className="sr-only">Shop status</legend>
              {([
                {
                  key: 'open' as const,
                  label: 'Open',
                  sub: 'Buyers can place orders normally.',
                },
                {
                  key: 'vacation' as const,
                  label: 'On vacation',
                  sub: 'Catalog stays visible. Buyers see your message and know orders are paused.',
                },
                {
                  key: 'closed' as const,
                  label: 'Closed',
                  sub: 'Catalog is dimmed and buyers can&apos;t open a Buy flow.',
                },
              ]).map(opt => {
                const checked = stallStatus === opt.key
                return (
                  <label
                    key={opt.key}
                    className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-input/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stallStatus"
                      value={opt.key}
                      checked={checked}
                      onChange={() => setStallStatus(opt.key)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-base font-medium text-foreground">
                        {opt.label}
                      </p>
                      <p
                        className="font-sans text-xs text-muted mt-0.5"
                        // Apostrophes in the static copy live in `sub` so render with HTML entity.
                        dangerouslySetInnerHTML={{ __html: opt.sub }}
                      />
                    </div>
                  </label>
                )
              })}
            </fieldset>

            {/* Optional message — only useful for vacation/closed but kept
                visible in 'open' too so the seller can pre-write a note. */}
            <div className="space-y-2">
              <label
                htmlFor="stallMessage"
                className="block font-sans text-sm font-medium text-foreground"
              >
                Message <span className="text-muted font-normal">(optional, shown to buyers)</span>
              </label>
              <textarea
                id="stallMessage"
                value={stallMessage}
                onChange={e => setStallMessage(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={
                  stallStatus === 'vacation'
                    ? 'Back from a short break the second week of June.'
                    : stallStatus === 'closed'
                      ? 'Thanks for visiting. Not taking new orders right now.'
                      : ''
                }
                className="w-full px-3 py-2 border border-border rounded font-sans text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                disabled={stallSubmitting}
              />
              <p className="font-sans text-xs text-muted text-right tabular-nums">
                {stallMessage.length}/200
              </p>
            </div>

            {/* Password — needed for the server to decrypt the seller's nsec
                and sign the kind 30053 event. */}
            <div className="space-y-2">
              <label
                htmlFor="stallPassword"
                className="block font-sans text-sm font-medium text-foreground"
              >
                Your password
              </label>
              <div className="relative">
                <input
                  id="stallPassword"
                  type={stallShowPassword ? 'text' : 'password'}
                  value={stallPassword}
                  onChange={e => setStallPassword(e.target.value)}
                  placeholder="Enter your password to sign the status update"
                  className="w-full px-3 py-2 pr-10 border border-border rounded font-sans text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={stallSubmitting}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setStallShowPassword(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground"
                  aria-label={stallShowPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {stallShowPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="font-sans text-xs text-muted">
                We use it to decrypt your Nostr key locally on the server, sign the
                event, then discard it. Maya never stores your password.
              </p>
            </div>

            {/* Error + success */}
            {stallError && (
              <p className="font-sans text-sm text-error">{stallError}</p>
            )}
            {stallSaved && (
              <p className="font-sans text-sm text-success">
                Status updated and published to Nostr ✓
              </p>
            )}

            <button
              type="submit"
              disabled={stallSubmitting || !stallPassword}
              className="w-full bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ minHeight: '48px' }}
            >
              {stallSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                'Save status'
              )}
            </button>
          </form>
        </section>

        {/* SECURITY */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-4">Security</h2>
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            {/* Change password row */}
            <button
              type="button"
              onClick={() => setPwOpen(!pwOpen)}
              className="w-full p-5 flex items-center justify-between hover:bg-input/30 transition-colors text-left"
            >
              <div>
                <p className="font-sans text-base text-foreground font-medium">Change password</p>
                <p className="font-sans text-xs text-muted mt-1">
                  We can&apos;t reset it for you. If you forget the new one, your shop is gone.
                </p>
              </div>
              {pwOpen ? <ChevronUp className="w-5 h-5 text-muted shrink-0 ml-3" /> : <ChevronDown className="w-5 h-5 text-muted shrink-0 ml-3" />}
            </button>
            {pwOpen && (
              <div className="border-t border-border p-5 space-y-4">
                <form onSubmit={handleSubmitPassword} className="space-y-4">
                  {/* Current */}
                  <div className="space-y-2">
                    <label htmlFor="currentPw" className="block font-sans text-sm font-medium">Current password</label>
                    <div className="relative">
                      <input
                        id="currentPw"
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPw}
                        onChange={e => setCurrentPw(e.target.value)}
                        className="w-full px-4 py-3 pr-12 bg-white rounded border border-border text-base focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ minHeight: '48px', fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        aria-label={showCurrent ? 'Hide password' : 'Show password'}
                      >
                        {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {/* New */}
                  <div className="space-y-2">
                    <label htmlFor="newPw" className="block font-sans text-sm font-medium">New password</label>
                    <div className="relative">
                      <input
                        id="newPw"
                        type={showNew ? 'text' : 'password'}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        className="w-full px-4 py-3 pr-12 bg-white rounded border border-border text-base focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ minHeight: '48px', fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        aria-label={showNew ? 'Hide password' : 'Show password'}
                      >
                        {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {/* Confirm */}
                  <div className="space-y-2">
                    <label htmlFor="confirmPw" className="block font-sans text-sm font-medium">Confirm new password</label>
                    <div className="relative">
                      <input
                        id="confirmPw"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        className="w-full px-4 py-3 pr-12 bg-white rounded border border-border text-base focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ minHeight: '48px', fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {pwError && <p className="font-sans text-sm text-error">{pwError}</p>}
                  {pwSaved && (
                    <p className="font-sans text-sm text-success flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      Password updated.
                    </p>
                  )}

                  <p className="font-sans text-sm text-accent">
                    Write your new password down. We can&apos;t reset it for you.
                  </p>

                  <button
                    type="submit"
                    disabled={!currentPw || !newPw || !confirmPw || pwSubmitting}
                    className="w-full bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {pwSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      'Update password'
                    )}
                  </button>
                </form>
              </div>
            )}

            <div className="border-t border-border" />

            {/* Recovery phrase row */}
            <button
              type="button"
              onClick={() => {
                setRecoveryOpen(!recoveryOpen)
                if (recoveryOpen) {
                  setRecoveryUnlocked(false)
                  setRecoveryError(null)
                  setRecoveryPw('')
                }
              }}
              className="w-full p-5 flex items-center justify-between hover:bg-input/30 transition-colors text-left"
            >
              <div>
                <p className="font-sans text-base text-foreground font-medium">View recovery phrase</p>
                <p className="font-sans text-xs text-muted mt-1">
                  Twelve words that can sign in as you. Treat them like your password.
                </p>
              </div>
              {recoveryOpen ? <ChevronUp className="w-5 h-5 text-muted shrink-0 ml-3" /> : <ChevronDown className="w-5 h-5 text-muted shrink-0 ml-3" />}
            </button>
            {recoveryOpen && (
              <div className="border-t border-border p-5">
                {!recoveryUnlocked ? (
                  <form onSubmit={handleUnlockRecovery} className="space-y-4">
                    <p className="font-sans text-sm text-foreground">
                      Enter your password to view your recovery phrase.
                    </p>
                    <div className="relative">
                      <input
                        type={showRecoveryPw ? 'text' : 'password'}
                        value={recoveryPw}
                        onChange={e => setRecoveryPw(e.target.value)}
                        placeholder="Your password"
                        className="w-full px-4 py-3 pr-12 bg-white rounded border border-border text-base focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ minHeight: '48px', fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRecoveryPw(!showRecoveryPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        aria-label={showRecoveryPw ? 'Hide password' : 'Show password'}
                      >
                        {showRecoveryPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {recoveryError && <p className="font-sans text-sm text-error">{recoveryError}</p>}
                    <button
                      type="submit"
                      disabled={!recoveryPw || recoverySubmitting}
                      className="w-full bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {recoverySubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Unlocking…
                        </>
                      ) : (
                        'Show recovery phrase'
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[#F5EFE3] rounded-lg p-4">
                      <p className="font-mono text-base text-foreground leading-relaxed break-words">
                        {MOCK_RECOVERY_PHRASE}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPhrase}
                      className="w-full bg-transparent border border-primary text-primary py-3 rounded font-sans text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                    >
                      {phraseCopied ? (
                        <>
                          <Check className="w-4 h-4" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copy phrase
                        </>
                      )}
                    </button>
                    <p className="font-sans text-sm text-accent">
                      Anyone with this phrase can sign in as you. Write it down somewhere private. Don&apos;t share it. Don&apos;t store it online unencrypted.
                    </p>
                    <button
                      type="button"
                      onClick={handleHideRecovery}
                      className="w-full text-muted hover:text-foreground font-sans text-sm transition-colors py-2"
                    >
                      Hide phrase
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* HOW YOUR MONEY IS HELD */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-4">How your money is held</h2>
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setCustodyOpen(!custodyOpen)}
              className="w-full p-5 flex items-center justify-between hover:bg-input/30 transition-colors text-left"
            >
              <p className="font-sans text-base text-foreground font-medium">
                Where your balance lives.
              </p>
              {custodyOpen ? <ChevronUp className="w-5 h-5 text-muted shrink-0 ml-3" /> : <ChevronDown className="w-5 h-5 text-muted shrink-0 ml-3" />}
            </button>
            {custodyOpen && (
              <div className="border-t border-border p-5 space-y-3 font-sans text-sm text-foreground leading-relaxed">
                <p>
                  Right now, your balance sits in a platform-managed wallet that Maya operates on
                  your behalf. Every credit and debit is recorded in an audit ledger we can&apos;t
                  edit after the fact.
                </p>
                <p>
                  You can withdraw to your bank or to your own Lightning address at any time. We
                  can&apos;t lose your funds; only you decide when they move.
                </p>
                <p className="text-muted">
                  In v2, every seller graduates to their own self-custodial wallet automatically.
                  Until then, this is the honest picture.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* SIGN OUT */}
        <section className="mb-12">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-white border border-border text-foreground py-3 rounded font-sans font-medium hover:bg-input/30 transition-colors"
          >
            Sign out
          </button>
        </section>

        {/* DANGER ZONE */}
        <div className="h-px bg-border mb-8" />
        <section>
          <h2 className="font-serif text-xl font-normal mb-4 text-error">Close your shop</h2>

          {!closeOpen ? (
            <div className="space-y-3">
              <p className="font-sans text-sm text-muted">
                This unlists every product, signs you out, and makes your shop URL unavailable. Your
                data is preserved — you can re-open by signing back in.
              </p>
              <button
                type="button"
                onClick={() => setCloseOpen(true)}
                className="w-full bg-white border border-error text-error py-3 rounded font-sans font-medium hover:bg-error/5 transition-colors"
              >
                Close your shop
              </button>
            </div>
          ) : (
            <div className="bg-[#F5EFE3] rounded-lg p-4 space-y-4">
              <p className="font-sans text-sm text-foreground">
                Sure you want to close Adaeze Studio? Your products will be unlisted. You can sign back in to re-open.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmClose}
                  disabled={closing}
                  className="flex-1 bg-error text-primary-foreground py-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {closing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Closing…
                    </>
                  ) : (
                    'Yes, close my shop'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCloseOpen(false)}
                  disabled={closing}
                  className="flex-1 bg-transparent text-foreground py-3 rounded font-sans text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
