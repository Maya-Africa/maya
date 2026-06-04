'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, Copy } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { signup } from '@/lib/api/auth'
import { createIdentity } from '@/lib/auth/keygen'
import { putSecretKey } from '@/lib/auth/storage'
import { useSessionStore } from '@/store/session-store'

export default function SignupPage() {
  const router = useRouter()
  const setUser = useSessionStore(s => s.setUser)
  const [step, setStep] = useState<'create' | 'save'>('create')
  const [shopName, setShopName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlTaken, setUrlTaken] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  // Slugify shop name to URL
  const slugifyShopName = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  const shopUrl = shopName ? `maya.com/shop/${slugifyShopName(shopName)}` : ''

  const handleShopNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShopName(e.target.value)
    // Clear stale errors as the user edits — the real uniqueness check
    // happens server-side at submit time.
    if (urlTaken) setUrlTaken(false)
    if (errorMessage) setErrorMessage(null)
  }

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopName || !password || isSubmitting) return

    setIsSubmitting(true)
    setUrlTaken(false)
    setErrorMessage(null)

    try {
      // 1. Generate Nostr keypair and encrypt the recovery mnemonic with
      //    the user's password — all in the browser. Server never sees
      //    the password or plaintext key.
      const identity = await createIdentity(password)

      // 2. Persist the encrypted blob server-side. Server derives the
      //    URL-safe slug from `username`, enforces uniqueness, and sets
      //    the session cookie.
      const { user } = await signup({
        username: shopName,
        displayName: shopName,
        role: 'SELLER',
        npub: identity.npubHex,
        encryptedKey: identity.encrypted.ciphertext,
        salt: identity.encrypted.salt,
        iv: identity.encrypted.iv,
      })

      // 3. Cache the unlocked secret key locally so product creates and
      //    profile updates don't re-prompt for the password. Best-effort —
      //    a private-mode browser or IndexedDB quota issue isn't fatal.
      try {
        await putSecretKey(identity.npubHex, identity.secretKey)
      } catch (cacheErr) {
        console.warn('Failed to cache secret key locally', cacheErr)
      }

      // 4. Hydrate the session store so subsequent pages see the user
      //    without round-tripping /api/auth/me.
      setUser(user)

      setStep('save')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setUrlTaken(true)
      } else if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Could not create your shop. Try again.')
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

  const handleContinueToShop = () => {
    router.push('/seller')
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-4 flex items-center justify-start">
          <Link href="/" className="font-serif text-2xl font-normal hover:opacity-80 transition-opacity">
            Maya
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 sm:pt-32 sm:pb-20 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {step === 'create' ? (
            // STEP 1: CREATE ACCOUNT
            <div className="space-y-8">
              <div className="space-y-3">
                <h1 className="font-serif text-5xl sm:text-6xl font-normal leading-tight">
                  Open your shop
                </h1>
                <p className="font-sans text-base text-muted">
                  Two minutes. Free to start.
                </p>
              </div>

              <form onSubmit={handleCreateShop} className="space-y-8">
                {/* Shop Name Field */}
                <div className="space-y-3">
                  <label htmlFor="shopName" className="block font-sans text-base font-medium">
                    Shop name
                  </label>
                  <input
                    id="shopName"
                    type="text"
                    value={shopName}
                    onChange={handleShopNameChange}
                    placeholder="Adaeze Studio"
                    className={`w-full px-4 py-3 font-sans text-base border rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                      urlTaken
                        ? 'border-error focus:ring-error'
                        : 'border-border focus:border-primary'
                    }`}
                  />

                  {/* URL Preview */}
                  <div className="pt-2">
                    {shopName ? (
                      <div className="space-y-1">
                        <p className="font-sans text-sm text-muted">Your shop URL:</p>
                        <p className="font-sans text-base font-medium text-foreground">
                          {shopUrl}
                        </p>
                        {urlTaken && (
                          <p className="font-sans text-sm text-error mt-2">
                            That URL is taken. Try another shop name.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="font-sans text-sm text-muted">
                        Your shop URL will appear here
                      </p>
                    )}
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-3">
                  <label htmlFor="password" className="block font-sans text-base font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a strong password"
                      className="w-full px-4 py-3 pr-12 font-sans text-base border border-border rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Password Warning */}
                  <p className="font-sans text-sm text-accent">
                    Write this down. We can&apos;t reset it for you.
                  </p>
                </div>

                {/* Inline error (network / unexpected failures — URL-taken
                    surfaces above next to the shop URL preview). */}
                {errorMessage && (
                  <p
                    role="alert"
                    className="font-sans text-sm text-error"
                  >
                    {errorMessage}
                  </p>
                )}

                {/* Primary Action */}
                <button
                  type="submit"
                  disabled={!shopName || !password || urlTaken || isSubmitting}
                  className="w-full h-14 bg-primary text-primary-foreground font-sans text-base font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Creating your shop…
                    </>
                  ) : (
                    'Create my shop'
                  )}
                </button>
              </form>

              {/* Secondary Action */}
              <div className="text-center">
                <Link
                  href="/signin"
                  className="font-sans text-base text-primary hover:underline transition-colors"
                >
                  Already have a shop? Sign in
                </Link>
              </div>

              {/* Footer Text */}
              <div className="pt-8 border-t border-border">
                <p className="font-sans text-sm text-muted text-center">
                  Free to join. No fees to list. Maya takes 2% when you sell.
                </p>
              </div>
            </div>
          ) : (
            // STEP 2: SAVE PASSWORD
            <div className="space-y-8">
              <div className="space-y-3">
                <h1 className="font-serif text-5xl sm:text-6xl font-normal leading-tight">
                  Save your password
                </h1>
                <p className="font-sans text-base text-muted">
                  Maya can never reset this for you. If you lose it, you lose your shop. Take 30
                  seconds to save it somewhere safe.
                </p>
              </div>

              {/* Password Display Card */}
              <div className="space-y-6">
                <div className="bg-white border border-border rounded-lg p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-base sm:text-lg font-medium text-foreground break-all">
                      {password}
                    </p>
                    <button
                      onClick={handleCopyPassword}
                      className="flex-shrink-0 p-3 hover:bg-background rounded transition-colors"
                      aria-label="Copy password"
                    >
                      <Copy className="w-5 h-5 text-muted hover:text-foreground transition-colors" />
                    </button>
                  </div>

                  {/* Copy Confirmation */}
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

              {/* Checkbox Gate */}
              <div className="space-y-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={passwordSaved}
                    onChange={(e) => setPasswordSaved(e.target.checked)}
                    className="w-5 h-5 mt-1 accent-primary rounded border border-border cursor-pointer"
                  />
                  <span className="font-sans text-base text-foreground pt-0.5">
                    I&apos;ve saved my password somewhere safe.
                  </span>
                </label>

                {/* Primary Action - Continue */}
                <button
                  onClick={handleContinueToShop}
                  disabled={!passwordSaved}
                  className="w-full h-14 bg-primary text-primary-foreground font-sans text-base font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                >
                  Continue to my shop
                </button>
              </div>

              {/* Back Link */}
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
