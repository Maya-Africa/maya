'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronDown, ChevronUp, Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react'

const BUYER = {
  displayName: 'Tobi Akinwale',
  memberSince: 'May 2026',
}

// Mock recovery phrase shown when the buyer passes the password gate.
// In production, the client decrypts the encrypted nsec stored on the
// server using the user-typed passphrase (PBKDF2 + AES-GCM) and formats
// the resulting bytes as 12 BIP39 words.
const MOCK_RECOVERY_PHRASE =
  'lantern bridge ginger marble cradle indigo orchid quartz violet harbor pebble candle'

export default function BuyerSettingsPage() {
  const router = useRouter()

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

  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryUnlocked, setRecoveryUnlocked] = useState(false)
  const [recoveryPw, setRecoveryPw] = useState('')
  const [showRecoveryPw, setShowRecoveryPw] = useState(false)
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [phraseCopied, setPhraseCopied] = useState(false)

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

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Back-arrow header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-5 py-3 flex items-center">
          <Link
            href="/profile"
            className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
            aria-label="Back to your profile"
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
              <span className="font-sans text-sm text-muted">Display name</span>
              <span className="font-sans text-base text-foreground">{BUYER.displayName}</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-baseline gap-4">
              <span className="font-sans text-sm text-muted">Member since</span>
              <span className="font-sans text-base text-foreground">{BUYER.memberSince}</span>
            </div>
          </div>
          <p className="font-sans text-xs text-muted mt-3">
            Editing your display name is coming soon. For now it&apos;s the name you signed up with.
          </p>
        </section>

        {/* SECURITY */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-4">Security</h2>
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            {/* Change password */}
            <button
              type="button"
              onClick={() => setPwOpen(!pwOpen)}
              className="w-full p-5 flex items-center justify-between hover:bg-input/30 transition-colors text-left"
            >
              <div>
                <p className="font-sans text-base text-foreground font-medium">Change password</p>
                <p className="font-sans text-xs text-muted mt-1">
                  We can&apos;t reset it for you. If you forget the new one, you lose your orders.
                </p>
              </div>
              {pwOpen ? (
                <ChevronUp className="w-5 h-5 text-muted shrink-0 ml-3" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted shrink-0 ml-3" />
              )}
            </button>
            {pwOpen && (
              <div className="border-t border-border p-5 space-y-4">
                <form onSubmit={handleSubmitPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="currentPw" className="block font-sans text-sm font-medium">
                      Current password
                    </label>
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
                  <div className="space-y-2">
                    <label htmlFor="newPw" className="block font-sans text-sm font-medium">
                      New password
                    </label>
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
                  <div className="space-y-2">
                    <label htmlFor="confirmPw" className="block font-sans text-sm font-medium">
                      Confirm new password
                    </label>
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

            {/* Recovery phrase */}
            <button
              type="button"
              onClick={() => {
                setRecoveryOpen(!recoveryOpen)
                if (recoveryOpen) {
                  setRecoveryUnlocked(false)
                  setRecoveryPw('')
                }
              }}
              className="w-full p-5 flex items-center justify-between hover:bg-input/30 transition-colors text-left"
            >
              <div>
                <p className="font-sans text-base text-foreground font-medium">
                  View recovery phrase
                </p>
                <p className="font-sans text-xs text-muted mt-1">
                  Twelve words that can sign in as you. Treat them like your password.
                </p>
              </div>
              {recoveryOpen ? (
                <ChevronUp className="w-5 h-5 text-muted shrink-0 ml-3" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted shrink-0 ml-3" />
              )}
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
                      Anyone with this phrase can sign in as you. Write it down somewhere private.
                      Don&apos;t share it. Don&apos;t store it online unencrypted.
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

        {/* SIGN OUT */}
        <section className="mb-10">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-white border border-border text-foreground py-3 rounded font-sans font-medium hover:bg-input/30 transition-colors"
          >
            Sign out
          </button>
        </section>

        {/* Footnote */}
        <p className="font-sans text-xs text-muted text-center max-w-md mx-auto">
          Account deletion isn&apos;t available yet. If you need to remove your account, reach out
          to Maya support.
        </p>
      </main>
    </div>
  )
}
