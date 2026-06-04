'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Copy, Check, Eye, EyeOff, Loader2 } from 'lucide-react'

// 12-word mock backup phrase. Real implementation generates this with
// `crypto.getRandomValues` and a BIP39 wordlist. The "Confirm" step asks
// for word positions 3 and 7 (1-indexed) — picked deterministically so
// the design preview is testable.
const MOCK_PHRASE = [
  'adore',
  'valor',
  'copper',
  'kingdom',
  'pause',
  'village',
  'whisper',
  'canyon',
  'flock',
  'orchid',
  'silent',
  'diamond',
]

const CONFIRM_POSITIONS = [3, 7] // ask for the 3rd and 7th words (1-indexed)

type Step = 'welcome' | 'backup' | 'confirm' | 'passphrase' | 'init' | 'ready'

function WalletSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('return') ?? '/wallet'

  const [step, setStep] = useState<Step>('welcome')

  // Confirm-words inputs
  const [word1, setWord1] = useState('')
  const [word2, setWord2] = useState('')
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Passphrase
  const [passphrase, setPassphrase] = useState('')
  const [confirmPp, setConfirmPp] = useState('')
  const [showPp, setShowPp] = useState(false)
  const [showConfirmPp, setShowConfirmPp] = useState(false)
  const [ppError, setPpError] = useState<string | null>(null)

  // WASM init progress (mock)
  const [initProgress, setInitProgress] = useState(0)

  // Ready / receive
  const [receiveAddress] = useState('bc1qadaeze...wpu7gx5d3v4mz9') // mock
  const [addressCopied, setAddressCopied] = useState(false)
  const [phraseCopied, setPhraseCopied] = useState(false)

  // Simulate WASM init when we hit the init step
  useEffect(() => {
    if (step !== 'init') return
    setInitProgress(0)
    const interval = setInterval(() => {
      setInitProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 8
      })
    }, 400)
    const completeTimer = setTimeout(() => {
      setStep('ready')
    }, 5500)
    return () => {
      clearInterval(interval)
      clearTimeout(completeTimer)
    }
  }, [step])

  const handleConfirmWords = (e: React.FormEvent) => {
    e.preventDefault()
    setConfirmError(null)
    const expected1 = MOCK_PHRASE[CONFIRM_POSITIONS[0]! - 1]!
    const expected2 = MOCK_PHRASE[CONFIRM_POSITIONS[1]! - 1]!
    if (word1.trim().toLowerCase() !== expected1 || word2.trim().toLowerCase() !== expected2) {
      setConfirmError('Those don\'t match. Check your backup and try again.')
      return
    }
    setStep('passphrase')
  }

  const handleSetPassphrase = (e: React.FormEvent) => {
    e.preventDefault()
    setPpError(null)
    if (!passphrase || passphrase.length < 8) {
      setPpError('Use at least 8 characters.')
      return
    }
    if (passphrase !== confirmPp) {
      setPpError('Passphrases don\'t match.')
      return
    }
    setStep('init')
  }

  const handleCopyPhrase = () => {
    navigator.clipboard.writeText(MOCK_PHRASE.join(' '))
    setPhraseCopied(true)
    setTimeout(() => setPhraseCopied(false), 2000)
  }

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(receiveAddress)
    setAddressCopied(true)
    setTimeout(() => setAddressCopied(false), 2000)
  }

  const handleContinue = () => {
    // returnTo carries the orderId from /checkout for the redirect-back flow.
    // Append ?walletReady=1 so the destination knows to show the
    // "Pay with your Maya wallet" affordance.
    const separator = returnTo.includes('?') ? '&' : '?'
    router.push(`${returnTo}${separator}walletReady=1`)
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Back-arrow header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-5 py-3 flex items-center">
          <Link
            href={returnTo}
            className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
            aria-label="Cancel and go back"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-8 pb-24">
        {/* STEP: WELCOME */}
        {step === 'welcome' && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
                Set up a wallet on this device.
              </h1>
              <p className="font-sans text-base text-muted max-w-lg">
                Maya can create a Lightning wallet right here in your browser. We never see it.
                You hold the keys, we just give you the interface.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-accent text-lg leading-none mt-0.5">✓</span>
                <p className="font-sans text-base text-foreground">No app store, no download.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent text-lg leading-none mt-0.5">✓</span>
                <p className="font-sans text-base text-foreground">
                  Only on this phone. Maya can&apos;t touch it.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent text-lg leading-none mt-0.5">✓</span>
                <p className="font-sans text-base text-foreground">
                  Backup phrase lets you restore on any device.
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep('backup')}
              className="w-full bg-primary text-primary-foreground py-4 rounded font-sans font-medium hover:opacity-90 transition-opacity"
              style={{ minHeight: '56px' }}
            >
              Get started
            </button>

            <p className="font-sans text-xs text-muted text-center">
              Takes about 90 seconds. You&apos;ll need a quiet moment to write 12 words down.
            </p>
          </div>
        )}

        {/* STEP: BACKUP PHRASE */}
        {step === 'backup' && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
                Write these down.
              </h1>
              <p className="font-sans text-base text-muted max-w-lg">
                These twelve words ARE your wallet. If you lose them and clear this device, your
                funds are gone. If someone else gets them, they can spend everything.
              </p>
            </div>

            {/* 12-word grid */}
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MOCK_PHRASE.map((word, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-[#F5EFE3] rounded p-3"
                  >
                    <span className="font-sans text-xs text-muted tabular-nums w-5 shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="font-mono text-base text-foreground">{word}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCopyPhrase}
                className="w-full mt-4 bg-transparent border border-primary text-primary py-2.5 rounded font-sans text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
              >
                {phraseCopied ? (
                  <>
                    <Check className="w-4 h-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy all words
                  </>
                )}
              </button>
            </div>

            <p className="font-sans text-sm text-accent">
              Write the words on paper, in order. Don&apos;t screenshot. Don&apos;t store them
              online unencrypted.
            </p>

            <button
              onClick={() => setStep('confirm')}
              className="w-full bg-primary text-primary-foreground py-4 rounded font-sans font-medium hover:opacity-90 transition-opacity"
              style={{ minHeight: '56px' }}
            >
              I&apos;ve written them down
            </button>
          </div>
        )}

        {/* STEP: CONFIRM (retype 2 random words) */}
        {step === 'confirm' && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
                Confirm your backup.
              </h1>
              <p className="font-sans text-base text-muted max-w-lg">
                Type two of the words from your backup. This makes sure you actually wrote them
                down.
              </p>
            </div>

            <form onSubmit={handleConfirmWords} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="word1" className="block font-sans text-base font-medium">
                  Word #{CONFIRM_POSITIONS[0]}
                </label>
                <input
                  id="word1"
                  type="text"
                  value={word1}
                  onChange={e => setWord1(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 font-mono text-base border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="word2" className="block font-sans text-base font-medium">
                  Word #{CONFIRM_POSITIONS[1]}
                </label>
                <input
                  id="word2"
                  type="text"
                  value={word2}
                  onChange={e => setWord2(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 font-mono text-base border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                />
              </div>

              {confirmError && (
                <p className="font-sans text-sm text-error">{confirmError}</p>
              )}

              <button
                type="submit"
                disabled={!word1 || !word2}
                className="w-full bg-primary text-primary-foreground py-4 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '56px' }}
              >
                Confirm backup
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setStep('backup')}
                className="font-sans text-sm text-muted hover:text-foreground transition-colors"
              >
                Back to backup phrase
              </button>
            </div>
          </div>
        )}

        {/* STEP: SET PASSPHRASE */}
        {step === 'passphrase' && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
                Pick a passphrase.
              </h1>
              <p className="font-sans text-base text-muted max-w-lg">
                The passphrase locks your wallet on this device. Anyone who picks up your phone
                needs it before they can pay.
              </p>
            </div>

            <form onSubmit={handleSetPassphrase} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="pp" className="block font-sans text-base font-medium">
                  Passphrase
                </label>
                <div className="relative">
                  <input
                    id="pp"
                    type={showPp ? 'text' : 'password'}
                    value={passphrase}
                    onChange={e => setPassphrase(e.target.value)}
                    className="w-full px-4 py-3 pr-12 text-base border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ minHeight: '48px', fontSize: '16px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPp(!showPp)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    aria-label={showPp ? 'Hide passphrase' : 'Show passphrase'}
                  >
                    {showPp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPp" className="block font-sans text-base font-medium">
                  Confirm passphrase
                </label>
                <div className="relative">
                  <input
                    id="confirmPp"
                    type={showConfirmPp ? 'text' : 'password'}
                    value={confirmPp}
                    onChange={e => setConfirmPp(e.target.value)}
                    className="w-full px-4 py-3 pr-12 text-base border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ minHeight: '48px', fontSize: '16px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPp(!showConfirmPp)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    aria-label={showConfirmPp ? 'Hide passphrase' : 'Show passphrase'}
                  >
                    {showConfirmPp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {ppError && <p className="font-sans text-sm text-error">{ppError}</p>}

              <p className="font-sans text-sm text-accent">
                Different from your backup phrase. The passphrase protects this device only; the
                backup phrase restores your wallet anywhere.
              </p>

              <button
                type="submit"
                disabled={!passphrase || !confirmPp}
                className="w-full bg-primary text-primary-foreground py-4 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '56px' }}
              >
                Lock my wallet
              </button>
            </form>
          </div>
        )}

        {/* STEP: WASM INIT */}
        {step === 'init' && (
          <div className="space-y-8 py-8 text-center">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>

            <div className="space-y-3">
              <h1 className="font-serif text-3xl sm:text-4xl font-normal leading-tight">
                Setting up your wallet.
              </h1>
              <p className="font-sans text-base text-muted max-w-md mx-auto">
                Loading the Lightning network code into your browser. About five seconds.
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="h-2 bg-input rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.min(initProgress, 100)}%` }}
                />
              </div>
              <p className="font-sans text-xs text-muted mt-2 tabular-nums">
                {Math.min(initProgress, 100)}%
              </p>
            </div>
          </div>
        )}

        {/* STEP: READY (receive address shown) */}
        {step === 'ready' && (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="w-7 h-7 text-success" strokeWidth={3} />
                </div>
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight text-center">
                Your wallet is ready.
              </h1>
              <p className="font-sans text-base text-muted max-w-md mx-auto text-center">
                Add Bitcoin or Lightning to it, then come back here to pay your order.
              </p>
            </div>

            {/* Receive section */}
            <div className="bg-white border border-border rounded-lg p-5 space-y-4">
              <p className="font-sans text-xs text-muted uppercase tracking-widest">
                Your wallet address
              </p>

              {/* QR placeholder */}
              <div className="bg-white rounded flex items-center justify-center text-center mx-auto"
                   style={{ width: 200, height: 200 }}>
                <div className="text-xs text-muted font-sans">QR code</div>
              </div>

              <div className="bg-[#F5EFE3] rounded p-3">
                <p className="font-mono text-sm text-foreground break-all">{receiveAddress}</p>
              </div>

              <button
                onClick={handleCopyAddress}
                className="w-full bg-transparent border border-primary text-primary py-2.5 rounded font-sans text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
              >
                {addressCopied ? (
                  <>
                    <Check className="w-4 h-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy address
                  </>
                )}
              </button>

              <p className="font-sans text-xs text-muted">
                Send any amount from another wallet, an exchange, or someone you know. Funds usually
                show up in under a minute.
              </p>
            </div>

            <button
              onClick={handleContinue}
              className="w-full bg-primary text-primary-foreground py-4 rounded font-sans font-medium hover:opacity-90 transition-opacity"
              style={{ minHeight: '56px' }}
            >
              {returnTo.startsWith('/checkout') ? 'Continue to pay your order' : 'Go to my wallet'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default function WalletSetupPage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <WalletSetupContent />
    </Suspense>
  )
}
