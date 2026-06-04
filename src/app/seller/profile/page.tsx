'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Plus, X, Loader2, ExternalLink } from 'lucide-react'
import { nip19 } from 'nostr-tools'

import { ApiError } from '@/lib/api-error'
import { updateProfile, type SignedChallengeEvent } from '@/lib/api/auth'
import { updateLongBio } from '@/lib/api/seller'
import { uploadImage } from '@/lib/api/upload'
import { signNostrEvent } from '@/lib/auth/sign'
import { getSecretKey } from '@/lib/auth/storage'
import { useSession } from '@/lib/auth/use-session'
import { useSessionStore } from '@/store/session-store'

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?incomplete=1 = the "Complete your shop" entry path from the dashboard
  // banner. Drives copy variation only — the form behaves the same.
  const isFirstTime = searchParams.get('incomplete') === '1'

  const { user, isLoading: isSessionLoading } = useSession()
  const setUser = useSessionStore(s => s.setUser)

  // Auth guard.
  useEffect(() => {
    if (!isSessionLoading && !user) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  // Form state — hydrated from the session user once it loads.
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarState, setAvatarState] = useState<'empty' | 'uploading' | 'uploaded'>('empty')
  const [location, setLocation] = useState('')
  const [about, setAbout] = useState('')
  const [lightningAddress, setLightningAddress] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Long bio (NIP-23 kind 30023). Its own form / endpoint so the main
  // profile save isn't blocked on writing a 10K-char essay.
  const [longBio, setLongBio] = useState('')
  const [isSavingBio, setIsSavingBio] = useState(false)
  const [bioError, setBioError] = useState<string | null>(null)
  const [bioSaved, setBioSaved] = useState(false)

  // Pre-fill the form from the authenticated user. Re-runs when the
  // session store changes (e.g., after /api/auth/me hydrate completes).
  useEffect(() => {
    if (!user) return
    setDisplayName(user.displayName ?? '')
    setAbout(user.about ?? '')
    setLightningAddress(user.lightningAddr ?? '')
    setLongBio(user.longBio ?? '')
    if (user.avatar) {
      setAvatarUrl(user.avatar)
      setAvatarState('uploaded')
    }
    // `location` is in the schema but not yet on the shared User type —
    // read it via index access so we pick it up once the type is updated.
    const maybeLocation = (user as unknown as Record<string, unknown>).location
    if (typeof maybeLocation === 'string') setLocation(maybeLocation)
  }, [user])

  // Avatar upload — server issues a signed Cloudinary URL, browser POSTs
  // the file direct to Cloudinary. The file bytes never pass through us.
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so re-selecting the same file fires a fresh change.
    e.target.value = ''
    if (!file) return

    setAvatarState('uploading')
    setErrorMessage(null)
    try {
      const url = await uploadImage(file)
      setAvatarUrl(url)
      setAvatarState('uploaded')
    } catch (err) {
      setAvatarState(avatarUrl ? 'uploaded' : 'empty')
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'Upload failed. Check your connection and try again.',
      )
    }
  }

  const handleAvatarRemove = () => {
    setAvatarUrl(null)
    setAvatarState('empty')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving || !user) return
    setIsSaving(true)
    setErrorMessage(null)

    try {
      // Build signed kind 0 (profile) + kind 10002 (relay list) Nostr events
      // so the profile mirrors to public relays AND clients reading it can
      // discover where the rest of this seller's Nostr presence lives.
      // If the unlocked nsec isn't in IndexedDB (storage cleared / different
      // device), skip the Nostr piece — Postgres still updates and the user
      // can republish after re-auth.
      let nostrEvent: SignedChallengeEvent | undefined
      let nostrRelayListEvent: SignedChallengeEvent | undefined
      try {
        const secretKey = await getSecretKey(user.npub)
        if (secretKey) {
          // Kind 0 — profile metadata.
          const content = JSON.stringify({
            name: displayName || undefined,
            about: about || undefined,
            picture: avatarUrl || undefined,
            lud16: lightningAddress || user.lightningAddr || undefined,
          })
          const signedProfile = signNostrEvent(
            {
              kind: 0,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content,
            },
            secretKey,
          )
          // VerifiedEvent is structurally a SignedChallengeEvent.
          nostrEvent = {
            id: signedProfile.id,
            pubkey: signedProfile.pubkey,
            created_at: signedProfile.created_at,
            kind: signedProfile.kind,
            tags: signedProfile.tags as string[][],
            content: signedProfile.content,
            sig: signedProfile.sig,
          }

          // Kind 10002 — relay list. Tags are ['r', <relay url>] per NIP-65.
          // Read the same relay set the server uses so seller-side and
          // server-side publishes target the same network.
          const relays = (process.env.NEXT_PUBLIC_NOSTR_RELAYS ?? '')
            .split(',')
            .map(r => r.trim())
            .filter(Boolean)
          if (relays.length > 0) {
            const signedRelayList = signNostrEvent(
              {
                kind: 10002,
                created_at: Math.floor(Date.now() / 1000),
                tags: relays.map(url => ['r', url]),
                content: '',
              },
              secretKey,
            )
            nostrRelayListEvent = {
              id: signedRelayList.id,
              pubkey: signedRelayList.pubkey,
              created_at: signedRelayList.created_at,
              kind: signedRelayList.kind,
              tags: signedRelayList.tags as string[][],
              content: signedRelayList.content,
              sig: signedRelayList.sig,
            }
          }
        }
      } catch (err) {
        console.warn('Failed to sign Nostr profile events', err)
      }

      const { user: updated } = await updateProfile({
        displayName: displayName || undefined,
        about: about || undefined,
        location: location || undefined,
        avatar: avatarUrl || undefined,
        // Personal lightningAddr stays out of this slice — it interacts
        // with the auto-set Maya address and needs a dedicated UX.
        nostrEvent,
        nostrRelayListEvent,
      })

      // Refresh the session store so the dashboard reflects the new
      // displayName immediately on navigate-back.
      setUser(updated)

      router.push('/seller')
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message || 'Could not save your profile. Try again.'
          : 'Connection issue. Check your network and try again.',
      )
      setIsSaving(false)
    }
  }

  const handleSaveLongBio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSavingBio || !user) return
    const trimmed = longBio.trim()
    if (trimmed.length === 0) {
      setBioError('Write a few sentences before saving.')
      return
    }
    setIsSavingBio(true)
    setBioError(null)
    setBioSaved(false)
    try {
      const res = await updateLongBio(trimmed)
      // Reflect the saved value back into the session store so other pages
      // (storefront, sovereignty page) pick it up immediately.
      setUser(res.user)
      setLongBio(res.user.longBio ?? '')
      setBioSaved(true)
      setTimeout(() => setBioSaved(false), 4000)
    } catch (err) {
      setBioError(
        err instanceof ApiError
          ? err.message
          : 'Could not publish your bio. Try again.',
      )
    } finally {
      setIsSavingBio(false)
    }
  }

  // Copy variations by mode
  const headline = isFirstTime ? 'Tell us about your craft.' : 'Edit your profile.'
  const subtitle = isFirstTime
    ? 'A few details so buyers know who you are. You can change these anytime.'
    : ''
  const ctaLabel = isFirstTime ? 'Continue to my shop' : 'Save changes'
  const ctaSaving = isFirstTime ? 'Saving…' : 'Saving…'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link
            href="/seller"
            className="flex items-center justify-center w-11 h-11 hover:bg-border rounded transition-colors"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Title */}
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-foreground mb-3">
          {headline}
        </h1>
        {subtitle && (
          <p className="font-sans text-base text-muted mb-8 max-w-lg">{subtitle}</p>
        )}
        {!subtitle && <div className="mb-8" />}

        {/* 1. Profile photo */}
        <div className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-1">Profile photo.</h2>
          <p className="text-sm text-muted mb-5">A photo of you or your work. Optional.</p>

          <div className="flex items-center gap-5">
            {avatarState === 'empty' && (
              <label
                className="w-24 h-24 rounded-full bg-white border border-dashed border-border flex flex-col items-center justify-center hover:bg-border/10 transition-colors shrink-0 cursor-pointer"
                aria-label="Add profile photo"
              >
                <Plus className="w-5 h-5 text-muted mb-1" />
                <span className="text-xs text-muted">Add</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleAvatarFileChange}
                  className="sr-only"
                />
              </label>
            )}

            {avatarState === 'uploading' && (
              <div className="w-24 h-24 rounded-full bg-gray-100 border border-border flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 text-muted animate-spin" />
              </div>
            )}

            {avatarState === 'uploaded' && avatarUrl && (
              <div className="w-24 h-24 rounded-full relative overflow-hidden shrink-0">
                <img
                  src={avatarUrl}
                  alt="Profile photo"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  className="absolute top-0 right-0 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                  aria-label="Remove profile photo"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
            )}

            <div className="text-sm text-muted">
              <p className="text-foreground font-medium">Maya will resize</p>
              <p>your photo. Square works best.</p>
            </div>
          </div>
        </div>

        {/* 2. Display name */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Your name.</h2>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="As you'd like buyers to see it"
            className="w-full px-4 py-3 bg-white rounded border border-border text-base font-normal text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            style={{ minHeight: '48px', fontSize: '16px' }}
          />
          <p className="text-xs text-muted mt-2">
            This appears on your shop page next to your work.
          </p>
        </div>

        {/* 3. Location */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Where you&apos;re based.</h2>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Lagos, Nigeria"
            className="w-full px-4 py-3 bg-white rounded border border-border text-base font-normal text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            style={{ minHeight: '48px', fontSize: '16px' }}
          />
          <p className="text-xs text-muted mt-2">
            City and country. Shown to buyers so they know where pieces ship from.
          </p>
        </div>

        {/* 4. About */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">About your work.</h2>
          <textarea
            value={about}
            onChange={e => setAbout(e.target.value)}
            placeholder="A sentence or two about what you make and why."
            className="w-full px-4 py-3 bg-white rounded border border-border text-base font-normal text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
            rows={4}
            style={{ fontSize: '16px' }}
            maxLength={280}
          />
          <p className="text-xs text-muted mt-2 tabular-nums">
            {about.length} / 280
          </p>
        </div>

        {/* 5. Lightning address (optional) */}
        <div className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-3">Lightning address (optional).</h2>
          <input
            type="text"
            value={lightningAddress}
            onChange={e => setLightningAddress(e.target.value)}
            placeholder="you@yourwallet.com"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-4 py-3 bg-white rounded border border-border text-base font-normal text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            style={{ minHeight: '48px', fontSize: '16px' }}
          />
          <p className="text-xs text-muted mt-2">
            If you have a personal Lightning address, buyers can pay directly to it.
            You can always withdraw to your bank instead.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gold mb-8" />

        {/* Inline error */}
        {errorMessage && (
          <p
            role="alert"
            className="font-sans text-sm text-error mb-4"
          >
            {errorMessage}
          </p>
        )}

        {/* Save / Continue */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-primary text-primary-foreground py-4 px-6 rounded font-sans text-base font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ minHeight: '56px' }}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {ctaSaving}
            </>
          ) : (
            ctaLabel
          )}
        </button>

        {/* Skip (first-time only) OR Cancel */}
        <div className="text-center mt-4">
          {isFirstTime ? (
            <Link
              href="/seller"
              className="font-sans text-sm text-muted hover:text-foreground transition-colors"
            >
              Skip for now
            </Link>
          ) : (
            <Link
              href="/seller"
              className="font-sans text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
          )}
        </div>

        {/* Sovereignty link — verify this seller's Nostr presence */}
        {user && (() => {
          let npub = user.npub
          try { npub = nip19.npubEncode(user.npub) } catch { /* keep hex */ }
          return (
            <div className="text-center mt-6 pt-6 border-t border-border">
              <Link
                href={`/sovereignty/${npub}`}
                className="inline-flex items-center gap-1.5 font-sans text-xs text-muted hover:text-accent transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View this seller&apos;s full Nostr presence
              </Link>
            </div>
          )
        })()}
      </form>

      {/* About your shop — NIP-23 kind 30023 long bio. Separate form
          because the underlying endpoint differs from the main profile
          save and publishing a long article shouldn't gate the quick
          edits above. Also, the existing form auto-navigates away on
          success which we don't want here. */}
      <section className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 pb-24">
        <div className="h-px bg-gold opacity-60 mb-8" />
        <form onSubmit={handleSaveLongBio} className="space-y-4">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal mb-2">
              About your shop.
            </h2>
            <p className="font-sans text-sm text-muted">
              Tell buyers the story behind your craft. Markdown is supported,
              published as a NIP-23 article on Nostr.
            </p>
          </div>

          <div>
            <label htmlFor="longBio" className="sr-only">
              About your shop
            </label>
            <textarea
              id="longBio"
              value={longBio}
              onChange={e => setLongBio(e.target.value)}
              maxLength={10000}
              rows={10}
              placeholder="A short essay about your work, your process, where the materials come from..."
              disabled={isSavingBio}
              className="w-full px-4 py-3 bg-white border border-border rounded font-sans text-base leading-relaxed placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ fontSize: '16px' }}
            />
            <p className="font-sans text-xs text-muted mt-1 tabular-nums">
              {longBio.length}/10,000
            </p>
          </div>

          {bioError && (
            <p className="font-sans text-sm text-error">{bioError}</p>
          )}
          {bioSaved && (
            <p className="font-sans text-sm text-success">
              Bio saved and published to Nostr ✓
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={isSavingBio || longBio.trim().length === 0}
              className="bg-primary text-primary-foreground py-3 px-6 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              style={{ minHeight: '48px' }}
            >
              {isSavingBio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                'Save & publish'
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function SellerProfilePage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <ProfilePageContent />
    </Suspense>
  )
}
