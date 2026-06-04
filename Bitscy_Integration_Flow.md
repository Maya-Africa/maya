# Bitscy Integration Flow — End-to-End Source of Truth

**Version:** 1.0
**Status:** Authoritative architecture document. CLAUDE.md files and code derive from this.
**Audience:** All three Bitscy engineers, plus any AI assistant working in this codebase.

This document describes exactly how Bitscy works end-to-end — every external system, every data flow, every API boundary. It does not contain implementation code; it describes what must be built. Implementation lives in the codebase; rationale lives here.

If anything in a CLAUDE.md file conflicts with this document, this document is correct and the CLAUDE.md is stale. Update the CLAUDE.md.

---

## 1. The product, in concrete operational terms

A Nigerian artist (Adaeze) lists handmade artwork. A buyer (Tobi, in Toronto) discovers it, pays with Bitcoin Lightning, and the artist withdraws to her Nigerian bank account in naira.

There are exactly five external systems Bitscy depends on. Every one of them must be real on demo day. There are no mocks.

| System | What it does | Network/mode for demo |
|---|---|---|
| **Breez SDK Liquid** | Lightning wallet — sending and receiving Bitcoin via Lightning | Mainnet, real sats, tiny amounts (under 5,000 sats per demo transaction) |
| **Bitnob API** | Lightning-to-NGN off-ramp to Nigerian bank accounts | Sandbox (testnet Lightning, simulated NGN — see Section 7) |
| **Nostr relays** | Public, censorship-resistant catalog and order records | Real public relays: relay.damus.io, nos.lol, relay.primal.net, nostr.wine |
| **CoinGecko API** | Live BTC-to-NGN exchange rate | Real, free tier, no API key needed |
| **Cloudinary** | Image hosting for product photos | Real, free tier, signed uploads |

Plus the database (Supabase Postgres) and hosting (Vercel) which are real infrastructure but not "external integrations" in the same sense.

---

## 2. The Lightning custody decision (the most important choice)

This is the decision that drives everything else. There is no neutral choice; there are tradeoffs.

### The three possible models

**Model A — Per-seller self-custodial Breez wallets.** Every seller has their own Breez SDK wallet. Their mnemonic is generated client-side, stored encrypted in their browser, and never touches Bitscy's servers. Adaeze opens her PWA, her wallet loads, invoices are generated client-side.

- Pros: Truly self-custodial. Aligns with Bitcoin ethos. Aligns with hackathon judging values.
- Cons: Seller must be online to receive a payment. If Adaeze's phone is off and Tobi tries to buy at 2am, the purchase fails. Seller wallet recovery (lost phone, cleared browser) is a hard UX problem. Breez SDK initialization in the browser is slow (5-10 seconds first load).

**Model B — Platform-custodial single Breez wallet.** Bitscy runs one Breez wallet for the whole platform. Its mnemonic lives encrypted on the server. All payments flow into this wallet. Per-seller balances tracked in Postgres ledger.

- Pros: Sellers never need to be online. Simple to operate. Invoices generate in milliseconds. Familiar pattern (this is how Strike, Cash App, OpenNode work).
- Cons: Custodial. Bitscy holds the keys. If the platform mnemonic is compromised, every pending seller balance is at risk. Honest pitch must acknowledge this.

**Model C — Hybrid: platform wallet receives, sellers pull on demand.** Same as Model B, but Adaeze can optionally export her balance to a personal Lightning address (her own wallet, external) at any time. Default behavior is platform-held; user can opt out.

### What we picked, and why

**We pick Model B (platform-custodial) for v1.** Reasoning:

1. The demo flow must work without coordination. We cannot have Adaeze's purchase fail because she's offline. Demo day matters more than ideology in v1.
2. Self-custody is a real product value, but it requires real recovery UX (recovery phrase, encrypted backups, "forgot my passphrase" flow) which is multi-day work we don't have.
3. The honest framing in the pitch: "Sellers' funds are held in a single Bitscy-managed Lightning wallet during v1. Sellers can withdraw to NGN or to their own Lightning Address at any time. In v2 we migrate to per-seller wallets after sellers complete profile setup. This trades temporary custody for instant onboarding."

This framing is true, defensible, and judges will respect it more than a self-custody story that breaks during the live demo.

**Tobi (the buyer) is different.** She always pays from her own Lightning wallet — either an existing one she has (Phoenix, Wallet of Satoshi, etc.) or a Bitscy-embedded Breez wallet she creates on first purchase. The buyer-side wallet IS self-custodial. The Breez SDK runs in her browser, her mnemonic stays in her IndexedDB, Bitscy never sees her keys.

So the architecture is:
- **Seller side (Adaeze):** Platform-custodial. One Breez wallet, run by Bitscy, encrypted mnemonic in server env.
- **Buyer side (Tobi):** Self-custodial. Breez SDK runs client-side. Buyer's keys stay in her browser.

This is the central architectural decision. Everything below derives from it.

---

## 3. The platform Breez wallet — operational details

### Setup

A single Breez SDK Liquid wallet exists for the Bitscy platform. It is created once, before launch, by running a Breez SDK initialization script with a freshly generated 12-word mnemonic. The mnemonic is:

- Generated using a hardware-backed entropy source (not Math.random, not a weak generator).
- Stored as `PLATFORM_BREEZ_MNEMONIC` in Vercel's encrypted environment variables. Never committed to git.
- Backed up by the team lead in 1Password (encrypted vault) AND on a paper backup in a physical safe location. If the env var is lost, all pending seller balances are lost.
- Rotated only if there is reason to believe it has been compromised. Rotation requires manual sat sweep to a fresh wallet.

### What it does

The platform wallet is a receive-and-forward intermediary:

1. **Receives** incoming Lightning payments from buyers.
2. **Holds** sats temporarily while Bitscy's internal ledger tracks which seller each payment belongs to.
3. **Forwards** sats out when a seller withdraws to NGN (via Bitnob) or to a personal Lightning Address.

The platform wallet does NOT accumulate large balances. A sweep process runs daily to keep the operating balance below 100,000 sats (~$60 USD). Excess sweeps to cold storage (separate hardware-backed Breez wallet, offline).

### What about real custody risk

Acknowledged. The platform wallet is a security-sensitive piece of infrastructure. Mitigations:

- Encrypted at rest (Vercel env vars, encrypted).
- Never logged. Add code to redact `PLATFORM_BREEZ_MNEMONIC` from all log output.
- Operating balance capped via the daily sweep.
- Access to the mnemonic restricted to the team lead. (For the hackathon: only Sandra has it.)

In a real production deployment, this would be HSM-backed and require multi-sig for sweeps. For the hackathon, encrypted env var + capped balance is acceptable.

---

## 4. The internal ledger

Because Model B pools all seller funds in one wallet, Bitscy tracks per-seller balances in Postgres. This is the ledger.

### Schema (Prisma)

```
model LedgerEntry {
  id          String   @id @default(cuid())
  userId      String                       // the seller this entry affects
  amountSats  BigInt                       // positive = credit, negative = debit
  type        LedgerEntryType              // SALE, WITHDRAWAL, REFUND, ADJUSTMENT
  refId       String?                      // OrderId for SALE, PayoutId for WITHDRAWAL, etc.
  description String                       // human-readable, for audit
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
}

enum LedgerEntryType {
  SALE          // sats credited to seller from a buyer payment
  WITHDRAWAL    // sats debited when seller withdraws to NGN or Lightning
  REFUND        // sats debited when a refund is issued (v2)
  ADJUSTMENT    // manual correction (audit trail required)
}
```

### Invariants

- A seller's current balance is `SUM(amountSats)` for their user ID. Never stored as a denormalized field — always computed from ledger entries.
- Every Lightning settlement creates exactly one `SALE` ledger entry.
- Every successful withdrawal creates exactly one `WITHDRAWAL` ledger entry.
- Ledger entries are immutable. Errors are corrected by adding a new `ADJUSTMENT` entry, never by editing.

### The platform wallet balance must always equal the sum of all positive ledger entries minus the sum of all negative ones, minus the operating sweep amount.

In production, a reconciliation cron job verifies this nightly. For the hackathon, we add an admin endpoint `/api/admin/reconcile` that a team member can hit manually before the demo to verify integrity.

---

## 5. The Lightning Address routing

Every seller gets a Lightning Address: `<username>@bitscy.com`.

When a buyer's wallet pays this address, the LNURL-pay flow runs:

1. Buyer's wallet does `GET https://bitscy.com/.well-known/lnurlp/<username>`
2. Bitscy's server responds with LNURL-pay metadata: callback URL, min/max sendable, metadata description.
3. Buyer's wallet does `GET <callback>?amount=<msats>`
4. Bitscy's server calls the platform Breez wallet's `receivePayment()` with the requested amount, gets back a BOLT-11 invoice.
5. Bitscy stores `{ paymentHash, sellerId, amount }` in a `PendingPayment` table (so when settlement fires, we know who to credit).
6. Bitscy returns the BOLT-11 invoice to the buyer's wallet.
7. Buyer's wallet pays the invoice.
8. Breez SDK fires `paymentSucceeded` event on the platform wallet.
9. Bitscy's event handler looks up the `PendingPayment` by `paymentHash`, creates a `SALE` ledger entry for that seller, deletes the `PendingPayment`.

### The PendingPayment table

```
model PendingPayment {
  paymentHash String   @id
  sellerId    String
  amountSats  BigInt
  orderId     String?              // null if this is a direct LNURL pay outside the marketplace flow
  description String
  createdAt   DateTime @default(now())
  expiresAt   DateTime              // BOLT-11 expiry, typically 1 hour

  @@index([orderId])
}
```

This table is short-lived. Entries get created when invoice is generated, deleted when payment settles, or cleaned up by a cron when they expire.

---

## 6. The internal checkout flow (when Tobi buys from inside Bitscy)

When the buyer is inside the Bitscy PWA (not paying from an external wallet via Lightning Address), the flow is direct:

1. Tobi taps "Buy with Lightning" on a product page.
2. Bitscy frontend POSTs to `/api/orders` with `{ productId, encryptedShippingAddress }`.
3. Bitscy backend:
   - Creates `Order` record, status `PENDING`.
   - Locks the product stock atomically.
   - Calls platform Breez wallet `receivePayment({ amountSats, description })` to generate a BOLT-11 invoice.
   - Stores `{ paymentHash, sellerId, amount, orderId }` in `PendingPayment`.
   - Returns `{ bolt11, paymentHash, expiresAt }` to the frontend.
4. Frontend displays QR code of the bolt11 invoice.
5. Tobi either:
   - Scans with an external Lightning wallet (Phoenix, Wallet of Satoshi, etc.) and pays.
   - Pays from her Bitscy-embedded Breez wallet (see Section 9).
6. When the payment settles, the platform Breez wallet fires `paymentSucceeded` event.
7. Bitscy backend handler:
   - Looks up `PendingPayment` by `paymentHash`.
   - Atomically updates `Order` from `PENDING` to `PAID` (using `WHERE status = 'PENDING'` clause).
   - Creates `SALE` ledger entry for the seller (positive amountSats).
   - Decrements product stock.
   - Constructs Nostr kind 30019 order event with NIP-04 encrypted shipping address.
   - Publishes to configured Nostr relays.
   - Sends Web Push notification to seller.
   - Deletes `PendingPayment`.
8. Frontend, polling `/api/lightning/verify/<paymentHash>`, sees `PAID` status and shows success.

### Race condition handling

Both the Breez webhook AND the frontend polling can trigger the "mark as paid" handler for the same payment. The atomic update `WHERE status = 'PENDING'` ensures only one wins. The other returns idempotently. This is implemented once in `markOrderPaid()` service function.

### Frontend polling

Every 2 seconds, the frontend hits `GET /api/lightning/verify/<paymentHash>`. Returns `{ settled: boolean, settledAt: string | null }`. Polling stops on either: (a) `settled: true` or (b) invoice expiry.

---

## 7. The Bitnob off-ramp flow (this is where Bitnob fits)

When Adaeze wants to convert her sats balance to naira and have it land in her Nigerian bank account, she uses Bitnob.

### What Bitnob actually does

Bitnob is a Nigerian fintech that provides API access to Bitcoin Lightning ↔ local fiat conversions. They take Lightning sats on one side, deposit NGN to a Nigerian bank account on the other side. They handle compliance, banking partnerships, FX.

### Bitnob sandbox vs. production

- **Sandbox** (`https://sandboxapi.bitnob.co/api/v1/`): Real API. Real Lightning testnet. Real responses. NGN amounts displayed but no real naira moves. Free, requires sandbox signup.
- **Production** (`https://api.bitnob.co/api/v1/`): Real API. Real Lightning mainnet. Real NGN to real bank accounts. Requires KYB approval which takes weeks.

**For the hackathon: sandbox.** All API calls are real, all responses are real, the only "not-real" piece is that the final NGN does not appear in an actual bank account.

### How we frame this in the pitch

> "Bitscy integrates with Bitnob — a Nigerian fintech that provides the Lightning-to-naira off-ramp. In production, this routes real naira from a seller's sats balance to her Nigerian bank account in under 60 seconds. For this demo, we're on Bitnob's sandbox — every API call is real, the Lightning routing is real, the response is real. We've completed the integration; production access requires KYB approval which we'll start post-hackathon."

This is true. It demonstrates real integration work. It explains why no real naira moves on stage. Judges respect this far more than a mock that pretends to be real.

### The withdrawal flow

1. Adaeze logs into her Bitscy dashboard. Her balance reads `SUM(LedgerEntry.amountSats WHERE userId = adaeze.id)` in sats, displayed in NGN at the live CoinGecko rate.
2. She taps "Withdraw to bank."
3. She picks a saved bank account or adds a new one (stored in the `BankAccount` table).
4. She enters an amount (defaults to full balance).
5. Bitscy backend validates: amount ≤ current balance, amount ≥ Bitnob minimum, valid bank account.
6. Bitscy backend initiates the withdrawal:
   - Generates a Bitnob payout request via `POST https://sandboxapi.bitnob.co/api/v1/payments/initiate`. Sends `{ amount, currency: 'NGN', customer, bankDetails }`.
   - Bitnob returns a Lightning invoice that Bitscy must pay.
   - Bitscy calls the platform Breez wallet's `sendPayment({ destination: bitnob_invoice })`.
   - Breez pays the invoice. Sats leave the platform wallet.
   - Bitnob detects payment, processes the NGN payout to the bank account, returns a payout ID and status.
7. Bitscy creates a `WITHDRAWAL` ledger entry (negative amountSats) for Adaeze.
8. Bitscy creates a `Payout` record with the Bitnob payout ID and status `PENDING`.
9. UI shows "Withdrawal initiated. ₦142,500 to GTBank ****1234. Tracking..."
10. Bitnob's webhook fires when the NGN payout completes (sandbox: usually 5-30 seconds).
11. Bitscy webhook handler updates the `Payout` record to `COMPLETED`.
12. UI updates: "Withdrawal complete."

### Failure modes

- **Bitnob payment fails (network, Bitnob downtime):** Show error to user. Do NOT debit the ledger. Retry button.
- **Platform Breez wallet has insufficient funds:** This shouldn't happen because the ledger says we have the sats — but if Breez itself has a routing failure, mark the Payout as `FAILED`, log the discrepancy, page the team. Do NOT debit the ledger until Breez payment confirms.
- **Bitnob NGN payout fails after Lightning succeeds:** This is the worst case. The sats are gone but the seller didn't get naira. Bitnob's API should refund the Lightning payment. We listen for refund events, credit the seller back via an `ADJUSTMENT` ledger entry.

### What about Bitnob's Lightning Address feature

Bitnob also offers their own Lightning Address service (`<username>@bitnob.io`). We do NOT use this. Bitscy operates its own Lightning Addresses on its own domain. Bitnob is exclusively the off-ramp.

---

## 8. The exchange rate service

We use CoinGecko's free API for live BTC/NGN exchange rates.

### Endpoint

`GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn`

Returns:
```json
{ "bitcoin": { "ngn": 145723000 } }
```

This means 1 BTC = ₦145,723,000. Therefore 1 sat = ₦1.45723.

### Caching

We cache the response for 60 seconds in Redis (Vercel KV) or in-memory if Redis is unavailable. CoinGecko's free tier allows 30 calls/minute, which is far more than 1 call/minute. Cache key: `btc_ngn_rate`.

### Where it's used

- Displaying NGN-equivalent of every product price on browse and detail pages.
- Computing the displayed NGN amount in the seller dashboard balance.
- Computing the displayed NGN amount before a buyer pays (so they see "≈ ₦4,200" next to the QR code).
- Computing the displayed NGN amount in the withdrawal flow.

### What if CoinGecko is down

Fall back to the most recently cached rate, even if stale. Show a small warning indicator if the rate is older than 5 minutes. Never block the user flow because of a stale rate.

### What rate gets recorded permanently

The rate at which a payment was made is captured at the moment of the Lightning settlement (`SALE` ledger entry has a `recordedNgnRate` field). This way, even if rates change later, we know what the buyer effectively paid in NGN-equivalent terms.

---

## 9. The buyer-side embedded Breez wallet (optional, real Breez moment)

When Tobi tries to pay and doesn't have a Lightning wallet, Bitscy offers to create one for her, in the browser, using Breez SDK Liquid (WASM build).

### Flow

1. On the checkout page, the QR code is displayed but underneath there's a button: "I don't have a Lightning wallet."
2. She taps it.
3. Bitscy generates a fresh 12-word mnemonic client-side using `nostr-tools` random secret or a dedicated mnemonic generator.
4. UI walks her through backup: shows the 12 words, asks her to write them down, confirms by asking her to retype two random words.
5. Bitscy initializes Breez SDK in the browser using `@breeztech/breez-sdk-liquid/web`. WASM module loads.
6. Mnemonic is encrypted in IndexedDB using AES-GCM with a key derived from her passphrase (PBKDF2). Passphrase never leaves the client.
7. UI shows: "Your wallet is ready, but it's empty. Fund it by sending Bitcoin or Lightning to..." and displays a Bitcoin/Lightning receive address from her new wallet.
8. She funds it from an external source (her own off-ramp, a friend, etc.). For the demo, the team funds it during setup.
9. Once funded, she can pay invoices using `prepareSendPayment` + `sendPayment` from her embedded wallet.

### What this demonstrates in the pitch

This is the "embedded Bitcoin" moment. Tobi never leaves Bitscy. She gets a real, self-custodial Lightning wallet inside the app. She pays Adaeze with it. The whole flow is in-browser, in-app, end-to-end Bitcoin. This is the dramatic moment that uses Breez most prominently.

### Honest scope caveat

The embedded wallet is "stretch but achievable" — if time runs out, we drop it and require buyers to use external wallets. The demo still works either way. But the embedded wallet is the most Breez-forward beat in the pitch and should be a priority for the Experience Engineer in week 2.

---

## 10. The Nostr layer

Nostr is used for catalog and order canonical records. The pattern is "Postgres-first, Nostr-as-publish-target."

### What gets published to Nostr

- **Seller profile** (kind 0): name, bio, picture. Published when the seller creates/updates their profile.
- **Product** (kind 30018, replaceable): all product details, signed by the seller. Published when seller creates/updates a product. Re-signed and re-published with the same `d` tag on update.
- **Order** (kind 30019): order details including NIP-04 encrypted shipping address. Published when the buyer commits to purchase. Signed by the buyer (or by `SYSTEM_NSEC` if buyer doesn't have NIP-07).

### What this means in practice

If Bitscy disappears tomorrow, the catalog of products and seller profiles is still on Nostr. Buyers and sellers can verify their orders existed via Nostr events. This is the "sovereignty" angle of the pitch.

### What does NOT go to Nostr

- Lightning invoices (these are private, ephemeral).
- The internal ledger (Bitscy's internal accounting).
- Payouts.
- Plaintext shipping addresses (NIP-04 encrypted before publishing).

### Relays

Three to four public relays: `relay.damus.io`, `nos.lol`, `relay.primal.net`, `nostr.wine`. Publish to all. Best-effort: if one relay is down, others still receive the event. Postgres copy is always the canonical reference for Bitscy's UI.

---

## 11. Identity and authentication

### Sellers

Sellers have a Nostr keypair. Two paths:

- **NIP-07 (advanced):** Seller has a Nostr browser extension (Alby, nos2x). They sign in by signing a challenge with their existing identity. Bitscy verifies the signature.
- **Generated (default):** Bitscy generates a Nostr keypair for them server-side on signup. The private key is encrypted with the seller's password (Argon2) and stored encrypted in the User row. On login, the password decrypts the key.

For the demo, we default to the generated path. NIP-07 is a stretch feature.

### Buyers

Buyers have an optional Nostr keypair. Two paths:

- **Anonymous (default):** Buyer's order events are signed by `SYSTEM_NSEC` on Bitscy's behalf. The order is still a real Nostr event with verifiable content; it's just that Bitscy is the signer, not the buyer.
- **Generated (opt-in):** When the buyer chooses to create an account, Bitscy generates a Nostr keypair for them, stored in IndexedDB encrypted with their passphrase. From then on, their order events are signed by their own key.

The `SYSTEM_NSEC` is generated once, stored in Vercel env vars, backed up identically to the platform Breez mnemonic.

### Sessions

HTTP-only session cookies, 7-day expiry. JWT-style payload includes user ID and role. Refreshed on each authenticated request.

---

## 12. Environment variables

The complete list. Every entry is real; nothing is placeholder.

```
# Database
DATABASE_URL                            # Supabase pooler connection string
DIRECT_URL                              # Supabase direct connection (for migrations)

# Hosting
NEXT_PUBLIC_APP_URL                     # The Vercel deployment URL

# Cloudinary (real, configured)
CLOUDINARY_CLOUD_NAME                   # dbx8nta1v
CLOUDINARY_API_KEY                      # 175994191732954
CLOUDINARY_API_SECRET                   # real, in 1Password
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME       # dbx8nta1v (browser-visible duplicate)

# Breez SDK Liquid (real, mainnet)
BREEZ_API_KEY                           # obtained from breez.technology/request-api-key
PLATFORM_BREEZ_MNEMONIC                 # 12-word mnemonic for platform wallet (encrypted)
BREEZ_NETWORK                           # "mainnet" for production demo

# Bitnob (real sandbox)
BITNOB_API_KEY                          # obtained from sandbox.bitnob.co signup
BITNOB_API_BASE                         # https://sandboxapi.bitnob.co/api/v1
BITNOB_WEBHOOK_SECRET                   # for verifying webhook signatures from Bitnob

# CoinGecko (no key needed for free tier)
COINGECKO_API_BASE                      # https://api.coingecko.com/api/v3

# Nostr
SYSTEM_NSEC                             # platform's Nostr key for buyer-anonymous events
NEXT_PUBLIC_NOSTR_RELAYS                # comma-separated relay URLs

# Web Push
WEB_PUSH_VAPID_PUBLIC
WEB_PUSH_VAPID_PRIVATE
WEB_PUSH_VAPID_SUBJECT                  # mailto:team@bitscy.com
NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC

# Session
SESSION_SECRET                          # 32+ random bytes

# Platform fee
PLATFORM_FEE_PERCENT                    # 2 — applied to each sale
```

Notably removed: `DEMO_BTC_NGN_RATE` (was a hardcoded mock rate; replaced with live CoinGecko).

---

## 13. The data model — full Prisma schema overview

The complete tables required for the architecture above:

- **User** — seller and buyer accounts. Includes encrypted Nostr key for the generated path.
- **Product** — listings. Soft-delete via status field.
- **Order** — purchases. Lifecycle: PENDING → PAID → SHIPPED → DELIVERED → (or CANCELLED).
- **OrderItem** — line items in an order. v1 always has exactly one.
- **PendingPayment** — short-lived invoice tracking. Maps paymentHash → sellerId, orderId.
- **LedgerEntry** — append-only seller balance ledger. SALE, WITHDRAWAL, REFUND, ADJUSTMENT types.
- **BankAccount** — seller's saved Nigerian bank accounts for withdrawals.
- **Payout** — withdrawal records, tied to Bitnob payout IDs.
- **PushSubscription** — Web Push subscription endpoints per user.

All inter-role data flow happens through Postgres reads (with shared types in `src/types/shared.ts`). The Catalog Engineer never imports from Commerce code; the Commerce Engineer never imports from Catalog code. They share data via the database and via shared types.

---

## 14. The role boundaries — who owns which integration

| Integration | Owner role | Code lives in |
|---|---|---|
| Breez SDK (platform wallet) | Commerce | `src/services/lightning/breez-platform.ts` |
| Breez SDK (buyer embedded wallet) | Experience | `src/services/lightning/breez-buyer.ts` (client-side) |
| Bitnob API client | Commerce | `src/services/payout/bitnob-client.ts` |
| CoinGecko pricing | Commerce (it's used by both, but the canonical service lives here) | `src/services/pricing/coingecko.ts` |
| Nostr publishing | Catalog (sellers + products); Commerce (orders) | `src/services/nostr/` (shared) |
| Cloudinary | Catalog | `src/services/catalog/upload.ts` |
| Ledger management | Commerce | `src/services/commerce/ledger.ts` |
| Order state machine | Commerce | `src/services/commerce/orders.ts` |
| Web Push dispatch | Commerce | `src/services/commerce/notifications.ts` |
| Auth | Catalog (server-side); Experience (client-side keys) | `src/services/catalog/auth.ts` + `src/lib/buyer-keys.ts` |

If a role finds itself reaching for code in another role's directory, that's the signal to stop and coordinate.

---

## 15. Demo day flow (what the judges see)

The 60-second demo, beat by beat:

**Setup (before demo):**
- Adaeze (team member or persona) has a Bitscy seller account.
- Two products are listed: a real piece of artwork, photo of it on the page.
- Tobi (team member or persona) has a small Lightning balance in either an external wallet OR a pre-funded Bitscy embedded wallet.
- The platform Breez wallet has been pre-funded with a small reserve so payments route smoothly.

**The demo:**
1. (0:00) Open Bitscy on a phone. Show the browse page. Pan through products.
2. (0:10) Tap into Adaeze's product. Show price in NGN with sats underneath. Show "Buy with Lightning."
3. (0:15) Tap Buy. QR appears. Note: NGN equivalent displayed. Caption: "Tobi in Toronto pays a Nigerian artist directly. No Etsy, no PayPal, no bank crossing borders."
4. (0:25) Pay the invoice (from Tobi's wallet). 2-3 seconds.
5. (0:30) Adaeze's phone lights up with push notification: "Sale on Bitscy!"
6. (0:35) Switch to Adaeze's seller dashboard. Show balance increased.
7. (0:40) Tap "Withdraw to bank." Pick GTBank. Confirm.
8. (0:50) UI shows "₦42,300 sent to GTBank ****1234. Tracking..." Then "Complete."
9. (1:00) Caption: "Lightning paid in. Naira paid out. Bitscy lives where banking refuses to."

Total: 60 seconds, end-to-end real money flowing through real infrastructure (sandbox naira, real Lightning).

---

## 16. What's explicitly out of scope for v1

To prevent scope creep:

- Multi-item cart (single item per purchase in v1)
- Reviews, ratings
- Direct buyer-seller messaging
- Real Bitnob production credentials and KYB (v2)
- Per-seller self-custody Breez wallets (v2)
- Dispute resolution, refunds (v2)
- Shipping logistics, tracking integrations
- Discount codes, promotions
- Wishlists, favorites
- Multi-language (English only)
- Search beyond chronological browse + category filter
- Native iOS or Android apps (PWA only)
- BIP-353 / BOLT-12 (using LNURL-pay + BOLT-11 only)
- Multi-image carousels beyond 5 images
- Real-time order tracking
- Inventory management beyond simple stock count

If anyone — human or AI — finds themselves designing one of these, they're out of scope. Stop and check.

---

## 17. Open dependencies — what the team must obtain

These are external dependencies that must be in place before the relevant engineer can build. Track ownership:

| Dependency | Owner | Status | Blocks |
|---|---|---|---|
| Breez API key | Commerce Engineer | Pending | All Lightning work |
| Platform Breez mnemonic + initial funding | Team lead | Pending | Payment flow demo |
| Bitnob sandbox account + API key | Commerce Engineer | Pending | All withdrawal work |
| Bitnob webhook URL configured | Commerce Engineer | Pending | Withdrawal status updates |
| Supabase project | Done | ✅ | — |
| Cloudinary account + signed preset | Done | ✅ | — |
| Vercel deployment | Done | ✅ | — |
| Nostr relay list verified live | Catalog Engineer | Pending | Publishing |
| CoinGecko endpoint smoke-tested | Commerce Engineer | Pending | Display rates |

The Commerce Engineer has the most external dependencies and should obtain them on Day 1.

---

## 18. How this document gets used

- **Engineers** read this before opening any code file. CLAUDE.md files derive from this; this is the source.
- **AI assistants** (Claude Code, etc.) read this when working in the repo. Treat conflicts between CLAUDE.md and this document by trusting this document.
- **Updates** happen when an architecture decision changes. Update this document FIRST, then propagate changes to CLAUDE.md and code. Never the other way around.
- **Approval** required from team lead (Sandra) before merging changes to this document.

---

*End of Integration Flow document. Last updated: May 22, 2026.*
