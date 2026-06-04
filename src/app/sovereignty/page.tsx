import Link from 'next/link';
import { nip19, getPublicKey } from 'nostr-tools';

import { listSellers } from '@/services/catalog/service';
import { fetchEventsByAuthorAndKinds, fetchEventsByKind } from '@/services/nostr/client';
import { NOSTR_KINDS } from '@/types/nostr';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExternalLink } from 'lucide-react';

// ── Derive platform system pubkey from SYSTEM_NSEC at server runtime ─────────
function getSystemHexPubkey(): string | null {
  const nsec = process.env.SYSTEM_NSEC;
  if (!nsec) return null;
  try {
    const { type, data } = nip19.decode(nsec);
    if (type !== 'nsec') return null;
    return getPublicKey(data);
  } catch {
    return null;
  }
}

// ── NIP reference data ────────────────────────────────────────────────────────
const STANDARD_NIPS = [
  { nip: '01', kind: 'core', title: 'Basic Protocol', where: 'Event creation, Schnorr signing, relay publishing' },
  { nip: '06', kind: '—', title: 'Mnemonic Key Derivation', where: '12-word BIP39 → Nostr secret key at signup' },
  { nip: '15', kind: '30017, 30018', title: 'Marketplace', where: 'Stalls and product listings' },
  { nip: '19', kind: '—', title: 'Bech32 Encoding', where: 'npub / nsec encoding throughout auth and display' },
  { nip: '23', kind: '30023', title: 'Long-form Content', where: 'Seller bios published as addressable articles' },
  { nip: '44', kind: '—', title: 'Versioned Encryption (v2)', where: 'Buyer shipping address encrypted to seller pubkey' },
  { nip: '57', kind: '9735', title: 'Lightning Zaps', where: 'Zap receipts on every payment settlement; lud16 in kind 0' },
  { nip: '65', kind: '10002', title: 'Relay List Metadata', where: 'Each user advertises preferred read/write relays' },
  { nip: '98', kind: '27235', title: 'HTTP Auth', where: 'Login challenge-response via signed events' },
  { nip: '99', kind: '30402', title: 'Classified Listings', where: 'Products dual-published for ecosystem interop' },
] as const;

const CUSTOM_KINDS = [
  {
    kind: '30050',
    name: 'order:state',
    description: 'Current state of an order. Replaces itself as the order progresses (shipped → delivered → refunded). References the order receipt via e tag. Latest state wins.',
    signer: 'Seller / Buyer / System',
    type: 'Param. Replaceable',
  },
  {
    kind: '30051',
    name: 'product:review',
    description: 'Buyer feedback on a completed order. 1–5 star rating in tag; markdown body in content. References the order via e tag and the product via a tag. Updatable once per buyer per order.',
    signer: 'Buyer',
    type: 'Param. Replaceable',
  },
  {
    kind: '30052',
    name: 'seller:badge',
    description: "Maya-issued attestation. Carries firstSaleAt and totalSales derived from the ledger. Auto-published on first sale, re-published on each subsequent sale. No manual ops required.",
    signer: 'System',
    type: 'Param. Replaceable',
  },
  {
    kind: '30053',
    name: 'stall:status',
    description: 'Lightweight operational overlay on a stall (open / vacation / closed) without re-publishing the full kind 30017 stall definition.',
    signer: 'Seller',
    type: 'Param. Replaceable',
  },
] as const;

const EXAMPLE_FILTERS = [
  {
    label: 'All products from a seller',
    filter: `{ "kinds": [30018], "authors": ["<seller hex pubkey>"] }`,
  },
  {
    label: 'Classified listings (NIP-99)',
    filter: `{ "kinds": [30402], "authors": ["<seller hex pubkey>"] }`,
  },
  {
    label: 'Current order state',
    filter: `{ "kinds": [30050], "#d": ["<orderId>"] }`,
  },
  {
    label: 'Reviews about a seller',
    filter: `{ "kinds": [30051], "#p": ["<seller hex pubkey>"] }`,
  },
  {
    label: 'Seller badge',
    filter: `{ "kinds": [30052], "#d": ["<seller hex pubkey>"] }`,
  },
  {
    label: 'Stall status',
    filter: `{ "kinds": [30053], "authors": ["<seller hex pubkey>"] }`,
  },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SovereigntyIndexPage() {
  const systemHexPubkey = getSystemHexPubkey();

  // Fetch seller directory from Postgres (allowed on this page).
  // Wrapped in try-catch — the sovereignty surface must render even if the
  // DB is temporarily unreachable. The seller directory is supplementary.
  let sellers: Awaited<ReturnType<typeof listSellers>> = [];
  let sellersDbError: string | null = null;
  try {
    sellers = await listSellers();
  } catch (err) {
    sellersDbError = err instanceof Error ? err.message : 'Database unavailable';
    console.warn('[sovereignty] listSellers failed — showing relay data only:', sellersDbError);
  }

  // Best-effort live event counts from relays (3-second window each).
  const [badgeEvents, zapEvents, productEvents] = await Promise.allSettled([
    systemHexPubkey
      ? fetchEventsByAuthorAndKinds(systemHexPubkey, [NOSTR_KINDS.SELLER_BADGE])
      : Promise.resolve([]),
    systemHexPubkey
      ? fetchEventsByAuthorAndKinds(systemHexPubkey, [NOSTR_KINDS.ZAP_RECEIPT])
      : Promise.resolve([]),
    fetchEventsByKind([NOSTR_KINDS.PRODUCT], 100),
  ]);

  const badgeCount  = badgeEvents.status  === 'fulfilled' ? badgeEvents.value.length  : null;
  const zapCount    = zapEvents.status    === 'fulfilled' ? zapEvents.value.length    : null;
  const productCount = productEvents.status === 'fulfilled' ? productEvents.value.length : null;

  return (
    <main className="min-h-screen bg-[var(--maya-background)]">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">

        {/* ── 1. Hero ─────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--maya-primary)]">
              Nostr Layer
            </span>
          </div>
          <h1 className="text-4xl font-bold text-[var(--maya-text)]">Maya on Nostr</h1>
          <p className="text-base text-[var(--maya-muted)] max-w-2xl leading-relaxed">
            Every product, profile, order state, and review on Maya is also a signed event on
            public Nostr relays. If Maya disappeared tomorrow, the catalog would still exist on
            relays, verifiable by anyone. This page documents exactly how — and lets you
            verify any seller's shop directly from relays, with zero database queries.
          </p>
        </section>

        {/* ── 2. Standard NIPs ────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--maya-text)]">Standard NIPs implemented</h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">NIP</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">Kind(s)</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)] hidden md:table-cell">Where it shows up</th>
                </tr>
              </thead>
              <tbody>
                {STANDARD_NIPS.map((row, i) => (
                  <tr key={row.nip} className={i % 2 === 0 ? 'bg-white' : 'bg-[var(--maya-background)]'}>
                    <td className="px-4 py-3 font-mono font-bold text-[var(--maya-primary)]">
                      <a
                        href={`https://github.com/nostr-protocol/nips/blob/master/${row.nip}.md`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        NIP-{row.nip}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--maya-muted)]">{row.kind}</td>
                    <td className="px-4 py-3 font-medium text-[var(--maya-text)]">{row.title}</td>
                    <td className="px-4 py-3 text-[var(--maya-muted)] hidden md:table-cell">{row.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 3. Custom kinds ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--maya-text)]">Custom event kinds defined by Maya</h2>
            <p className="text-sm text-[var(--maya-muted)] mt-1">
              NIP-15 and NIP-99 cover product listings. These four kinds cover the
              post-listing lifecycle. All are in the unassigned{' '}
              <code className="text-xs bg-muted px-1 rounded">30050–30053</code> range.
              Kinds 30054–30059 are reserved for future use.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">Kind</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">Signer</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--maya-muted)]">Type</th>
                </tr>
              </thead>
              <tbody>
                {CUSTOM_KINDS.map((row, i) => (
                  <tr key={row.kind} className={i % 2 === 0 ? 'bg-white' : 'bg-[var(--maya-background)]'}>
                    <td className="px-4 py-3 font-mono font-bold text-[var(--maya-accent)]">{row.kind}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--maya-primary)]">{row.name}</td>
                    <td className="px-4 py-3 text-[var(--maya-muted)] text-xs max-w-xs">{row.description}</td>
                    <td className="px-4 py-3 text-[var(--maya-muted)] text-xs whitespace-nowrap">{row.signer}</td>
                    <td className="px-4 py-3 text-xs"><Badge variant="secondary">{row.type}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--maya-muted)]">
            Full spec, rationale, tag schemas, and example events:{' '}
            <a
              href="https://github.com/Maya/maya_app/blob/main/docs/maya-custom-nips.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--maya-primary)] hover:underline inline-flex items-center gap-1"
            >
              docs/maya-custom-nips.md <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </section>

        {/* ── 4. Live event counts ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--maya-text)]">Live event counts</h2>
          <p className="text-sm text-[var(--maya-muted)]">
            Queried from relays at page load. Best-effort — shows <code>—</code> if relays
            don&apos;t respond within 4 seconds.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Seller badges issued', value: badgeCount, kind: '30052' },
              { label: 'Zap receipts', value: zapCount, kind: '9735' },
              { label: 'Products on relays', value: productCount, kind: '30018' },
            ].map((stat) => (
              <Card key={stat.kind} className="text-center">
                <CardContent className="pt-5 pb-4">
                  <div className="text-3xl font-mono font-bold text-[var(--maya-primary)]">
                    {stat.value === null ? '—' : stat.value}
                    {stat.value !== null && stat.value >= 100 && '+'}
                  </div>
                  <div className="text-xs text-[var(--maya-muted)] mt-1">{stat.label}</div>
                  <div className="text-xs font-mono text-[var(--maya-muted)]/60 mt-0.5">kind {stat.kind}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* ── 5. Seller directory ──────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--maya-text)]">Verify any Maya seller</h2>
            <p className="text-sm text-[var(--maya-muted)] mt-1">
              Click a seller to reconstruct their full shop from Nostr relays only — no database
              queries on the destination page.{' '}
              <span className="italic">
                Seller directory below is sourced from Maya&apos;s database for convenience.
                The individual proof pages query relays only.
              </span>
            </p>
          </div>
          {sellersDbError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Database temporarily unreachable — seller directory unavailable.
              <span className="block text-xs font-mono mt-1 opacity-70">{sellersDbError}</span>
              <span className="block text-xs mt-1">
                You can still verify any seller by pasting their npub directly into{' '}
                <code>/sovereignty/npub1...</code>
              </span>
            </div>
          ) : sellers.length === 0 ? (
            <p className="text-sm text-[var(--maya-muted)]">No sellers found in the database.</p>
          ) : (
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              {sellers.map((seller, i) => {
                let npub = seller.npub;
                try { npub = nip19.npubEncode(seller.npub); } catch { /* keep hex */ }
                return (
                  <Link
                    key={seller.id}
                    href={`/sovereignty/${npub}`}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--maya-primary)]/5 transition-colors ${
                      i < sellers.length - 1 ? 'border-b border-[var(--border)]' : ''
                    }`}
                  >
                    <div>
                      <span className="font-medium text-sm text-[var(--maya-text)]">
                        {seller.displayName ?? seller.username}
                      </span>
                      <span className="text-xs text-[var(--maya-muted)] ml-2">@{seller.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--maya-muted)] hidden sm:block">
                        {npub.slice(0, 16)}…
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-[var(--maya-primary)]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 6. Query code blocks ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--maya-text)]">Query Maya&apos;s events yourself</h2>
          <p className="text-sm text-[var(--maya-muted)]">
            Paste any of these filters into{' '}
            <a href="https://nostr.band" target="_blank" rel="noopener noreferrer"
              className="text-[var(--maya-primary)] hover:underline">nostr.band</a>,{' '}
            <a href="https://nostrdebug.com" target="_blank" rel="noopener noreferrer"
              className="text-[var(--maya-primary)] hover:underline">nostrdebug.com</a>,
            or any Nostr client that supports raw filter queries.
            Replace placeholders with a seller&apos;s hex pubkey from the directory above.
          </p>
          <div className="space-y-3">
            {EXAMPLE_FILTERS.map((ex) => (
              <div key={ex.label}>
                <p className="text-xs font-medium text-[var(--maya-muted)] mb-1">{ex.label}</p>
                <pre className="bg-[#1A1A1A] text-[#E5E5E5] text-xs rounded-lg px-4 py-3 overflow-x-auto">
                  {ex.filter}
                </pre>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. What's NOT visible ────────────────────────────────────── */}
        <section className="rounded-lg border border-[var(--border)] bg-muted/30 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--maya-text)]">
            What&apos;s NOT visible in these relay queries
          </h3>
          <ul className="text-sm text-[var(--maya-muted)] space-y-1.5 list-disc list-inside">
            <li>
              <strong>NIP-06</strong> (BIP39 key derivation) and <strong>NIP-98</strong> (HTTP auth)
              are implemented but don&apos;t produce queryable relay events — they operate at signup
              and login respectively.
            </li>
            <li>
              <strong>Kind 30050 order:state</strong> events are tied to specific orders. Each order
              detail page will link to its Nostr state event once Commerce wires the order detail view.
            </li>
            <li>
              <strong>NIP-44</strong> encryption is used on kind 30019 order events — the ciphertext
              visible in the raw event view IS the proof that shipping addresses are never published
              in plaintext. Only the seller&apos;s key can decrypt it.
            </li>
          </ul>
        </section>

        <Separator />

        <footer className="text-xs text-[var(--maya-muted)] pb-10">
          Built on{' '}
          <a href="https://nostr.com" target="_blank" rel="noopener noreferrer"
            className="text-[var(--maya-primary)] hover:underline">Nostr</a>.
          {' '}Default relays: wss://relay.damus.io · wss://nos.lol · wss://relay.primal.net · wss://nostr.wine.
          {' '}Configurable via <code>NEXT_PUBLIC_NOSTR_RELAYS</code>.
        </footer>
      </div>
    </main>
  );
}
