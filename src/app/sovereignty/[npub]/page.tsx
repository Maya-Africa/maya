import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, CheckCircle2, XCircle, Radio, Star, ShieldCheck, Package, MessageSquare } from 'lucide-react';

import { npubToHex } from '@/services/nostr/signing';
import { fetchSovereigntyData } from '@/services/nostr/sovereignty';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ── helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: string }) {
  const n = Math.min(5, Math.max(0, Number(rating) || 0));
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < n ? 'fill-[var(--maya-gold)] text-[var(--maya-gold)]' : 'text-muted'}`}
        />
      ))}
    </span>
  );
}

function NjumpLink({ eventId, label = 'View on Nostr ↗' }: { eventId: string; label?: string }) {
  return (
    <a
      href={`https://njump.me/${eventId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-[var(--maya-primary)] hover:underline"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}

function shortNpub(npub: string) {
  return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
}

function formatTs(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function SovereigntySellerPage({
  params,
}: {
  params: Promise<{ npub: string }>;
}) {
  const { npub } = await params;

  // Decode npub → hex (invalid npub renders an error state, not a 500)
  let hexPubkey: string;
  try {
    hexPubkey = npubToHex(npub);
  } catch {
    return (
      <main className="min-h-screen bg-[var(--maya-background)] flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-[var(--maya-error)]">Invalid npub</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              <code className="break-all">{npub}</code> is not a valid bech32 Nostr public key.
            </p>
            <Link href="/sovereignty" className="text-sm text-[var(--maya-primary)] hover:underline">
              ← Back to Maya on Nostr
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const data = await fetchSovereigntyData(npub, hexPubkey);
  const { reconstructed: r, eventsRetrieved: ev, perKindDurationMs: dur, rawEvents } = data;

  const totalEvents = Object.values(ev).reduce((a, b) => a + b, 0);
  const displayName = r.profile?.name || shortNpub(npub);

  // Empty state — nothing found on relays
  if (totalEvents === 0) {
    return (
      <main className="min-h-screen bg-[var(--maya-background)] flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No events found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No Nostr events were found for this npub on the configured relays. Either
              this is not a Maya seller, or relays are temporarily unreachable.
            </p>
            <div className="font-mono text-xs break-all bg-muted rounded p-2">{npub}</div>
            <p className="text-xs text-muted-foreground">
              Query took {data.queryDurationMs}ms across{' '}
              {data.relays.length} relays.
            </p>
            <Link href="/sovereignty" className="text-sm text-[var(--maya-primary)] hover:underline">
              ← Back to Maya on Nostr
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--maya-background)]">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* ── PART A — Proof header ────────────────────────────────────── */}
        <section className="rounded-xl border-2 border-[var(--maya-primary)] bg-[#EAF2F2] p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Radio className="h-4 w-4 text-[var(--maya-primary)]" />
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--maya-primary)]">
                  Proof artifact — zero database queries
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[var(--maya-text)]">
                {displayName}&apos;s shop — reconstructed from Nostr
              </h1>
              <p className="text-sm text-[var(--maya-muted)] mt-1">
                This page made <strong>zero database queries</strong>. All data below was
                retrieved live from public Nostr relays. Anyone can verify it independently.
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-mono font-bold text-[var(--maya-primary)]">
                {data.queryDurationMs}ms
              </div>
              <div className="text-xs text-[var(--maya-muted)]">total reconstruction time</div>
            </div>
          </div>

          {/* Relay status */}
          <div>
            <p className="text-xs font-medium text-[var(--maya-muted)] uppercase tracking-wide mb-2">
              Relays queried
            </p>
            <div className="flex flex-wrap gap-2">
              {data.relays.map((relay) => (
                <span
                  key={relay.url}
                  className="inline-flex items-center gap-1.5 text-xs bg-white rounded-full px-3 py-1 border border-[var(--maya-primary)]/20"
                >
                  {relay.responded
                    ? <CheckCircle2 className="h-3 w-3 text-[var(--maya-success)]" />
                    : <XCircle className="h-3 w-3 text-[var(--maya-error)]" />
                  }
                  {relay.url.replace('wss://', '')}
                </span>
              ))}
            </div>
          </div>

          {/* Per-kind event counts */}
          <div>
            <p className="text-xs font-medium text-[var(--maya-muted)] uppercase tracking-wide mb-2">
              Events retrieved by kind
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs font-mono">
              {([
                ['Kind 0 — profile',           ev.profile,           dur.profile],
                ['Kind 30017 — stall',         ev.stall,             dur.stall],
                ['Kind 30018 — products',      ev.products,          dur.products],
                ['Kind 30402 — listings',      ev.classifiedListings, dur.classifiedListings],
                ['Kind 30023 — long bio',      ev.longBio,           dur.longBio],
                ['Kind 30052 — badge',         ev.badge,             dur.badge],
                ['Kind 30053 — stall status',  ev.stallStatus,       dur.stallStatus],
                ['Kind 30051 — reviews',       ev.reviews,           dur.reviews],
                ['Kind 9735  — zap receipts',  ev.zapReceipts,       dur.zapReceipts],
                ['Kind 10002 — relay list',    ev.relayList,         dur.relayList],
                ['Kind 30050 — order state',   ev.orderStateEvents,  dur.orderStateEvents],
              ] as [string, number, number][]).map(([label, count, ms]) => (
                <div key={label} className="flex items-center justify-between bg-white rounded px-2 py-1 border border-[var(--border)]">
                  <span className="text-[var(--maya-muted)]">{label}</span>
                  <span className={`font-bold ml-2 ${count > 0 ? 'text-[var(--maya-primary)]' : 'text-[var(--maya-muted)]'}`}>
                    {count} <span className="font-normal text-[10px] text-[var(--maya-muted)]">({ms}ms)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PART B — Reconstructed shop ──────────────────────────────── */}
        <section className="space-y-8">
          <h2 className="text-lg font-semibold text-[var(--maya-text)] flex items-center gap-2">
            <Package className="h-5 w-5 text-[var(--maya-primary)]" />
            Reconstructed shop
          </h2>

          {/* Profile */}
          {r.profile && (
            <Card>
              <CardContent className="pt-6 flex gap-4 items-start">
                {r.profile.picture && (
                  <Image
                    src={r.profile.picture}
                    alt={r.profile.name}
                    width={64}
                    height={64}
                    className="rounded-full object-cover shrink-0"
                  />
                )}
                <div className="space-y-1">
                  <h3 className="font-bold text-[var(--maya-text)]">{r.profile.name}</h3>
                  {r.profile.about && (
                    <p className="text-sm text-[var(--maya-muted)]">{r.profile.about}</p>
                  )}
                  {r.profile.lud16 && (
                    <div className="text-xs text-[var(--maya-muted)]">
                      ⚡ Lightning: <span className="font-mono">{r.profile.lud16}</span>
                    </div>
                  )}
                  {rawEvents.profile && (
                    <div className="pt-1">
                      <NjumpLink eventId={rawEvents.profile.id} label="View kind 0 event ↗" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stall */}
          {r.stall && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Stall: {r.stall.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {r.stall.description && (
                  <p className="text-sm text-[var(--maya-muted)]">{r.stall.description}</p>
                )}
                <p className="text-xs text-[var(--maya-muted)]">Currency: {r.stall.currency}</p>
                {rawEvents.stall && (
                  <div className="pt-1">
                    <NjumpLink eventId={rawEvents.stall.id} label="View kind 30017 event ↗" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stall status banner */}
          {r.stallStatus && r.stallStatus.status !== 'open' && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              r.stallStatus.status === 'vacation'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {r.stallStatus.status === 'vacation' ? '🌴 On vacation' : '🔒 Shop closed'}
              {r.stallStatus.message && ` — ${r.stallStatus.message}`}
            </div>
          )}

          {/* Badge */}
          {r.badge && (
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-5 w-5 text-[var(--maya-success)]" />
              <span className="font-medium text-[var(--maya-success)]">
                Verified seller — {r.badge.totalSales} sale{r.badge.totalSales !== 1 ? 's' : ''}
              </span>
              <span className="text-[var(--maya-muted)]">
                since {formatTs(r.badge.firstSaleAt)}
              </span>
              {rawEvents.badge && (
                <NjumpLink eventId={rawEvents.badge.id} label="kind 30052 ↗" />
              )}
            </div>
          )}

          {/* Long bio */}
          {r.longBio && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">About this seller</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Rendered as pre-wrap until react-markdown is added */}
                <pre className="text-sm text-[var(--maya-text)] whitespace-pre-wrap font-sans">
                  {r.longBio}
                </pre>
                {rawEvents.longBio && (
                  <div className="pt-3">
                    <NjumpLink eventId={rawEvents.longBio.id} label="View kind 30023 event ↗" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Products */}
          {r.products.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-[var(--maya-text)] mb-3">
                Products ({r.products.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {r.products.map((p) => (
                  <Card key={p.eventId} className="overflow-hidden">
                    {p.images[0] && (
                      <div className="relative h-40 w-full bg-muted">
                        <Image
                          src={p.images[0]}
                          alt={p.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      </div>
                    )}
                    <CardContent className="pt-3 space-y-1">
                      <p className="font-medium text-sm text-[var(--maya-text)]">{p.title}</p>
                      <p className="text-xs text-[var(--maya-muted)] line-clamp-2">{p.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {p.priceSats} {p.currency}
                        </Badge>
                        <NjumpLink eventId={p.eventId} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {r.reviews.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-[var(--maya-text)] mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--maya-primary)]" />
                Reviews ({r.reviews.length})
              </h3>
              <div className="space-y-3">
                {r.reviews.map((rev) => (
                  <Card key={rev.eventId}>
                    <CardContent className="pt-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <Stars rating={rev.rating} />
                        <span className="text-xs font-mono text-[var(--maya-muted)]">
                          {shortNpub(rev.reviewerNpub)}
                        </span>
                      </div>
                      {rev.content && (
                        <p className="text-sm text-[var(--maya-text)]">{rev.content}</p>
                      )}
                      <div className="pt-1">
                        <NjumpLink eventId={rev.eventId} label="View kind 30051 event ↗" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {r.totalZapReceipts > 0 && (
            <p className="text-sm text-[var(--maya-muted)]">
              ⚡ {r.totalZapReceipts} Lightning zap receipt{r.totalZapReceipts !== 1 ? 's' : ''} (kind 9735) on relays
            </p>
          )}
        </section>

        <Separator />

        {/* ── PART C — Raw signed events (collapsed) ───────────────────── */}
        <section>
          <details className="group">
            <summary className="cursor-pointer select-none text-sm font-medium text-[var(--maya-primary)] list-none flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Show raw signed events
              <span className="text-xs text-[var(--maya-muted)] font-normal ml-1">
                — proof that nothing is fabricated
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              {(Object.entries(rawEvents) as [string, unknown][])
                .flatMap(([key, val]) =>
                  Array.isArray(val)
                    ? val.map((e, i) => ({ key: `${key}[${i}]`, event: e }))
                    : [{ key, event: val }]
                )
                .filter(({ event }) => event !== null)
                .map(({ key, event }) => (
                  <div key={key}>
                    <p className="text-xs font-mono text-[var(--maya-muted)] mb-1">{key}</p>
                    <pre className="bg-[#1A1A1A] text-[#E5E5E5] text-xs rounded-lg p-4 overflow-x-auto leading-relaxed">
                      {JSON.stringify(event, null, 2)}
                    </pre>
                  </div>
                ))}
            </div>
          </details>
        </section>

        <Separator />

        {/* ── PART D — Footnote ────────────────────────────────────────── */}
        <footer className="space-y-3 pb-10">
          <h3 className="text-sm font-semibold text-[var(--maya-text)]">
            How to verify this yourself
          </h3>
          <p className="text-sm text-[var(--maya-muted)]">
            Paste this npub into{' '}
            <a href={`https://nostr.band/npub/${npub}`} target="_blank" rel="noopener noreferrer"
              className="text-[var(--maya-primary)] hover:underline">nostr.band</a>{' '}
            or{' '}
            <a href={`https://njump.me/${npub}`} target="_blank" rel="noopener noreferrer"
              className="text-[var(--maya-primary)] hover:underline">njump.me</a>.
            You&apos;ll see the same events, signed by the same keys, on the same public relays.
          </p>
          <div className="flex items-center gap-2 font-mono text-xs bg-muted rounded px-3 py-2 max-w-full overflow-x-auto">
            <span className="break-all">{npub}</span>
          </div>
          <p className="text-xs text-[var(--maya-muted)]">
            Custom event kinds 30050–30053 are defined in{' '}
            <Link href="/sovereignty" className="text-[var(--maya-primary)] hover:underline">
              Maya&apos;s Nostr implementation
            </Link>.
            {' '}Queried at {data.queriedAt} in {data.queryDurationMs}ms.
          </p>
        </footer>
      </div>
    </main>
  );
}
