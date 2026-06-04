'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Check, Copy } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { signup } from '@/lib/api/auth'
import { createOrder } from '@/lib/api/commerce'
import { createIdentity } from '@/lib/auth/keygen'
import { putSecretKey } from '@/lib/auth/storage'
import { useSessionStore } from '@/store/session-store'

function BuyerSignupPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setUser = useSessionStore(s => s.setUser)

  // Two ways to arrive here:
  //   ?buyProductId=<id>  → Buy click from /products/[id]; after signup
  //                         we auto-create the order and route to checkout.
  //   ?returnTo=<path>    → generic post-signup redirect.
  // buyProductId takes precedence.
  const buyProductId = searchParams.get('buyProductId')
  const returnTo = searchParams.get('returnTo')

  // Thread the buy intent through the "Already have an account?" link so a
  // returning buyer also lands on checkout after signing in.
  const signinHref = buyProductId
    ? `/signin?buyProductId=${encodeURIComponent(buyProductId)}`
    : returnTo
      ? `/signin?returnTo=${encodeURIComponent(returnTo)}`
      : '/signin'

  const [step, setStep] = useState<'create' | 'save'>('create')

  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameTaken, setNameTaken] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  // Continuation state — covers the auto-buy round-trip from step 2.
  const [isContinuing, setIsContinuing] = useState(false)
  const [continueError, setContinueError] = useState<string | null>(null)

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value)
    if (nameTaken) setNameTaken(false)
    if (errorMessage) setErrorMessage(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName || !password || isSubmitting) return

    setIsSubmitting(true)
    setNameTaken(false)
    setErrorMessage(null)

    try {
      // 1. Generate Nostr keypair, encrypt the 12-word mnemonic under the
      //    password. Server never sees the password or plaintext key.
      const identity = await createIdentity(password)

      // 2. Send the encrypted blob to the server. Slug uniqueness is enforced
      //    at the DB level; the server returns 409 on collision.
      const { user } = await signup({
        username: displayName,
        displayName,
        role: 'BUYER',
        npub: identity.npubHex,
        encryptedKey: identity.encrypted.ciphertext,
        salt: identity.encrypted.salt,
        iv: identity.encrypted.iv,
      })

      // 3. Cache the unlocked nsec locally — needed for NIP-04 shipping
      //    encryption and Nostr event signing later. Best-effort.
      try {
        await putSecretKey(identity.npubHex, identity.secretKey)
      } catch (cacheErr) {
        console.warn('Failed to cache secret key locally', cacheErr)
      }

      // 4. Populate the session store immediately so the next page doesn't
      //    flash a logged-out state while /api/auth/me re-hydrates.
      setUser(user)

      setStep('save')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setNameTaken(true)
      } else if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Could not create your account. Try again.')
      } else {
        setErrorMessage('Connection issue. Check your network and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContinue = async () => {
    if (isContinuing) return

    // Auto-buy: the buyer arrived here mid-purchase. Create the order
    // now (the session is fresh) and route to checkout. If the order
    // can't be created (out of stock, etc.) send them to the product
    // page so they can see why.
    if (buyProductId) {
      setIsContinuing(true)
      setContinueError(null)
      try {
        const order = await createOrder({ productId: buyProductId, quantity: 1 })
        router.push(`/checkout/${order.id}`)
        return
      } catch (err) {
        if (err instanceof ApiError && err.code === 'OUT_OF_STOCK') {
          setContinueError('That piece just sold — heading back to its page.')
        } else {
          setContinueError('Could not create your order. Heading back to the product.')
        }
        // Brief pause so the seller can read the message, then route.
        setTimeout(() => router.push(`/products/${buyProductId}`), 1500)
        return
      }
    }

    // Generic returnTo path. Restricted to in-app paths so a malicious
    // link can't bounce the buyer off-site.
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      router.push(returnTo)
    } else {
      router.push('/marketplace')
    }
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-4 flex items-center justify-start">
          <Link
            href="/"
            className="font-serif text-2xl font-normal hover:opacity-80 transition-opacity"
          >
            Maya
          </Link>
        </div>
      </nav>

      <div className="pt-24 pb-12 sm:pt-32 sm:pb-20 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {step === 'create' ? (
            <div className="space-y-8">
              <div className="space-y-3">
                <h1 className="font-serif text-5xl sm:text-6xl font-normal leading-tight">
                  Create your Maya identity.
                </h1>
                <p className="font-sans text-base text-muted max-w-lg">
                  A name and a password. We never see your password — it encrypts your account on
                  this device.
                </p>
              </div>

              <form onSubmit={handleCreate} className="space-y-8">
                {/* Your name */}
                <div className="space-y-3">
                  <label htmlFor="displayName" className="block font-sans text-base font-medium">
                    Your name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={handleDisplayNameChange}
                    placeholder="Tobi Akinwale"
                    className={`w-full px-4 py-3 font-sans text-base border rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                      nameTaken
                        ? 'border-error focus:ring-error'
                        : 'border-border focus:border-primary'
                    }`}
                    style={{ minHeight: '48px', fontSize: '16px' }}
                  />
                  {nameTaken ? (
                    <p className="font-sans text-sm text-error">
                      That name is taken. Try another.
                    </p>
                  ) : (
                    <p className="font-sans text-sm text-muted">
                      Shown on your orders so sellers know who to thank.
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-3">
                  <label htmlFor="password" className="block font-sans text-base font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Choose a strong password"
                      className="w-full px-4 py-3 pr-12 font-sans text-base border border-border rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:border-primary transition-colors"
                      style={{ minHeight: '48px', fontSize: '16px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="font-sans text-sm text-accent">
                    Write this down. We can&apos;t reset it for you.
                  </p>
                </div>

                {/* Inline error (network / unexpected failures — taken-name
                    surfaces above next to the name field). */}
                {errorMessage && (
                  <p role="alert" className="font-sans text-sm text-error">
                    {errorMessage}
                  </p>
                )}

                {/* Primary action */}
                <button
                  type="submit"
                  disabled={!displayName || !password || nameTaken || isSubmitting}
                  className="w-full h-14 bg-primary text-primary-foreground font-sans text-base font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Creating your account…
                    </>
                  ) : (
                    'Create my account'
                  )}
                </button>
              </form>

              {/* Secondary action */}
              <div className="text-center">
                <Link
                  href={signinHref}
                  className="font-sans text-base text-primary hover:underline transition-colors"
                >
                  Already have an account? Sign in
                </Link>
              </div>

              {/* Open-protocol footnote */}
              <div className="pt-8 border-t border-border">
                <p className="font-sans text-xs text-muted text-center max-w-md mx-auto">
                  This identity works across Maya and any other site that supports the same open
                  identity standard. Your account is yours.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-3">
                <h1 className="font-serif text-5xl sm:text-6xl font-normal leading-tight">
                  Save your password.
                </h1>
                <p className="font-sans text-base text-muted">
                  Maya can never reset this for you. If you lose it, you lose your orders. Take 30
                  seconds to save it somewhere safe.
                </p>
              </div>

              {/* Password card */}
              <div className="space-y-6">
                <div className="bg-white border border-border rounded-lg p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-base sm:text-lg font-medium text-foreground break-all">
                      {password}
                    </p>
                    <button
                      onClick={handleCopyPassword}
                      className="shrink-0 p-3 hover:bg-background rounded transition-colors"
                      aria-label="Copy password"
                    >
                      <Copy className="w-5 h-5 text-muted hover:text-foreground transition-colors" />
                    </button>
                  </div>

                  {copied && (
                    <div className="mt-4 flex items-center gap-2 text-success">
                      <Check className="w-4 h-4" />
                      <span className="font-sans text-sm">Copied to clipboard</span>
                    </div>
                  )}
                </div>

                <p className="font-sans text-sm text-muted">
                  We&apos;ll never show this to you again.
                </p>
              </div>

              {/* Checkbox gate */}
              <div className="space-y-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={passwordSaved}
                    onChange={e => setPasswordSaved(e.target.checked)}
                    className="w-5 h-5 mt-1 accent-primary rounded border border-border cursor-pointer"
                  />
                  <span className="font-sans text-base text-foreground pt-0.5">
                    I&apos;ve saved my password somewhere safe.
                  </span>
                </label>

                <button
                  onClick={handleContinue}
                  disabled={!passwordSaved || isContinuing}
                  className="w-full h-14 bg-primary text-primary-foreground font-sans text-base font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
                >
                  {isContinuing ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      {buyProductId ? 'Creating your order…' : 'Just a moment…'}
                    </>
                  ) : buyProductId ? (
                    'Continue to checkout'
                  ) : (
                    'Continue to browse'
                  )}
                </button>
                {continueError && (
                  <p role="alert" className="font-sans text-sm text-error">
                    {continueError}
                  </p>
                )}
              </div>

              <div className="text-center">
                <button
                  onClick={() => setStep('create')}
                  className="font-sans text-base text-primary hover:underline transition-colors"
                >
                  Back to edit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BuyerSignupPage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <BuyerSignupPageContent />
    </Suspense>
  )
}
