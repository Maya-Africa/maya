# Maya

A marketplace for skilled craft businesses. Tailors, carpenters, jewellers, potters, repair specialists — list your work, collect payment securely via escrow, and get paid in naira to your Nigerian bank account.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license) [![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC)](https://tailwindcss.com/) [![Paystack](https://img.shields.io/badge/Payments-Paystack-00C3F7)](https://paystack.com/) [![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](https://web.dev/progressive-web-apps/)

---

## What Maya solves

Skilled tradespeople across Nigeria lose money to three problems:

1. **Payment friction.** Global platforms (Etsy, Stripe, PayPal) block or throttle Nigerian sellers. Maya uses Paystack — built for Nigeria, trusted by thousands of Nigerian businesses.
2. **No trust layer.** Buyers fear paying upfront and getting nothing. Sellers fear delivering work and not getting paid. Maya's built-in escrow holds funds until both sides are satisfied.
3. **Platform fees.** Most marketplaces take 10–15% per sale plus processing fees. Maya takes **2%**. That's it.

---

## Features

### For sellers

- **Open a shop in 2 minutes** — shop name, password, done. No KYC, no business registration, no tax ID.
- **List products and services** — title, description, up to 5 photos (Cloudinary), price in naira, category.
- **Receive payments via Paystack** — card, bank transfer, USSD. Funds go into escrow on payment.
- **Milestone-based projects** — break large jobs (furniture, tailoring commissions, renovations) into stages. Get paid at each milestone.
- **Order management** — view buyer details, mark work as done, trigger milestone release requests.
- **NGN bank payouts** — withdraw your released balance to any Nigerian bank account.
- **Public storefront** — shareable URL at `maya.com/shop/your-name`.

### For buyers

- **Browse without signing up** — `/marketplace` is fully public.
- **Pay securely with Paystack** — card, bank transfer, or USSD. Funds go into escrow, not straight to the seller.
- **Escrow protection** — money is only released when you confirm satisfaction. For large orders, approve milestone by milestone.
- **Order tracking** — view all orders, release payments, raise disputes from `/buyer/orders`.

### Escrow & milestones

```
Buyer pays → Escrow FUNDED → (milestones) → Buyer releases → Seller receives naira
                ↓                               ↑
         All funds held                  Per-milestone or
         by platform                     full release
```

- Simple orders: single escrow, buyer releases all funds on delivery.
- Project orders: seller and buyer agree on milestones upfront. Each milestone has a title and a naira amount. Seller marks work done → buyer releases that milestone's funds → repeat.
- Dispute window: if buyer or seller disagrees, either party can flag the order for manual review.

---

## How it works — end to end

### Seller workflow

```
1. Sign up at /signup
      ↓
2. Add a product or service listing
      ↓
3. Share your shop link (maya.com/shop/<slug>)
      ↓
4. Buyer places order → Paystack checkout opens
      ↓
5. Buyer pays → funds held in escrow
      ↓
6. Complete the work / deliver the item
      ↓
7. Buyer releases payment (or milestone release for phased jobs)
      ↓
8. Withdraw naira to your bank account
```

### Buyer workflow

```
1. Browse /marketplace — no account needed
      ↓
2. Tap a listing → product detail
      ↓
3. Sign in or create a buyer account
      ↓
4. Place order → Paystack payment page
      ↓
5. Pay by card / bank transfer / USSD
      ↓
6. Funds held in escrow — seller can see order but cannot withdraw yet
      ↓
7. Seller delivers → you confirm → release payment
      ↓
8. Order complete — review the seller
```

### Payment & escrow flow (technical)

```
POST /api/escrow            ← create escrow record (buyer + seller + amount + milestones)
POST /api/paystack/initialize  ← generate Paystack authorization URL
    ↓ redirect buyer to Paystack
Paystack charge.success webhook → POST /api/paystack/webhook
    ↓ escrow.status = FUNDED
PATCH /api/escrow/:id/milestones/:mId  ← seller marks milestone SUBMITTED
POST /api/escrow/:id/milestones/:mId/release  ← buyer releases milestone
    ↓ escrow.status = PARTIAL | RELEASED
POST /api/escrow/:id/release  ← buyer releases all remaining funds
    ↓ escrow.status = RELEASED
POST /api/payout            ← seller withdraws released balance to bank
```

---

## Quick start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 22 |
| pnpm | 9 |
| PostgreSQL | Any (Supabase / Neon / local) |
| Cloudinary | Free tier |
| Paystack | Test account (free) |

### Installation

```bash
# 1. Clone
git clone <repo-url>
cd maya

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Fill in the values below

# 4. Apply database schema
pnpm db:push

# 5. (Optional) seed demo data
pnpm db:seed

# 6. Start dev server
pnpm dev
```

App runs at `http://localhost:3000`.

### Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled Postgres URL |
| `DIRECT_URL` | Direct Postgres URL (for migrations) |
| `SESSION_SECRET` | Random 32-byte hex — `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL (e.g. `https://maya.example.com`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Same cloud name (public) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (`sk_test_...` for dev, `sk_live_...` for prod) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key (`pk_test_...` or `pk_live_...`) |
| `PAYSTACK_WEBHOOK_SECRET` | HMAC secret — set in your Paystack dashboard and copy here |
| `PLATFORM_FEE_PERCENT` | Maya's cut per sale (default `2`) |

Optional (legacy Lightning / Nostr — not required for Paystack flow):

| Variable | Description |
|----------|-------------|
| `SYSTEM_NSEC` | Server-side Nostr signing key |
| `NEXT_PUBLIC_NOSTR_RELAYS` | Nostr relay URLs |
| `BREEZ_API_KEY`, `BREEZ_NETWORK`, `BREEZ_STORAGE_DIR` | Breez Lightning SDK |
| `USE_MOCK_LIGHTNING` | `true` to skip Lightning entirely |
| `BITNOB_CLIENT_ID`, `BITNOB_CLIENT_SECRET` | Legacy NGN off-ramp |
| `WEB_PUSH_VAPID_PUBLIC/PRIVATE/SUBJECT` | Push notifications |

### Generating secrets

```bash
# SESSION_SECRET
openssl rand -hex 32

# PAYSTACK_WEBHOOK_SECRET — generate then paste into Paystack dashboard
openssl rand -hex 32
```

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│ PWA client                                                  │
│ Installable on Android & iOS. Mobile-first design.         │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ Frontend — Next.js 14 App Router + React 19                 │
│ Pages, components, Zustand stores, client-side crypto      │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ Backend — Next.js API routes                               │
│ Auth · Products · Orders · Escrow · Paystack · Payouts     │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ External services                                          │
│ Paystack · PostgreSQL (Supabase) · Cloudinary · Web Push  │
└────────────────────────────────────────────────────────────┘
```

### Escrow state machine

```
PENDING → FUNDED → PARTIAL → RELEASED
                ↓               ↓
           REFUNDED         REFUNDED
                ↓
           DISPUTED
```

- `PENDING`: escrow created, buyer hasn't paid yet
- `FUNDED`: Paystack `charge.success` received — all funds locked
- `PARTIAL`: at least one milestone released, others still locked
- `RELEASED`: all funds released to seller
- `REFUNDED`: funds returned to buyer
- `DISPUTED`: under manual review

### Milestone state machine

```
PENDING → IN_PROGRESS → SUBMITTED → RELEASED
                                  ↓
                               DISPUTED
```

---

## Project structure

```
maya/
├── prisma/
│   └── schema.prisma          # User, Product, Order, Escrow, Milestone,
│                              # PaystackPayment, BankAccount, LedgerEntry, Payout
├── public/
│   ├── manifest.json          # PWA manifest
│   └── artwork-*.jpg          # Demo product images
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # Signup, login, logout, me
│   │   │   ├── products/      # Product CRUD
│   │   │   ├── orders/        # Order state machine (ship, deliver, dispute, refund)
│   │   │   ├── escrow/        # Escrow create/list + release routes
│   │   │   ├── paystack/      # initialize, verify, webhook
│   │   │   ├── payout/        # NGN bank payout (Bitnob legacy)
│   │   │   ├── seller/        # Bank accounts, stall status
│   │   │   ├── shop/          # Public storefront endpoints
│   │   │   ├── upload/        # Cloudinary signed upload
│   │   │   └── notifications/ # Web Push subscriptions
│   │   ├── marketplace/       # Public browse
│   │   ├── products/[id]/     # Product detail
│   │   ├── seller/            # Seller dashboard (orders, products, wallet, profile)
│   │   ├── buyer/             # Buyer orders + settings
│   │   ├── shop/[username]/   # Public seller storefront
│   │   ├── sell/              # Marketing + signup funnel
│   │   ├── signup, signin/    # Auth pages
│   │   ├── checkout/          # Paystack redirect + verify
│   │   ├── globals.css        # Tailwind 4 design tokens (Maya palette)
│   │   └── layout.tsx
│   ├── components/            # Shared UI (shadcn + composed components)
│   ├── services/
│   │   ├── auth/              # Signup, login, session
│   │   ├── catalog/           # Products, storefronts, reviews
│   │   ├── commerce/          # Orders, ledger, state machine
│   │   ├── paystack/          # Paystack API client
│   │   ├── payout/            # Bitnob NGN transfer (legacy)
│   │   ├── pricing/           # Exchange rate helpers
│   │   ├── lightning/         # Legacy Lightning support (Breez)
│   │   └── nostr/             # Nostr event publishing
│   ├── lib/
│   │   ├── session.ts         # HMAC-signed cookie sessions
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── api-error.ts       # Typed API error class
│   │   └── auth/              # Client-side crypto (keygen, sign, storage)
│   ├── store/                 # Zustand (session store)
│   ├── types/                 # Shared TypeScript types
│   └── validators/            # Zod schemas for API boundaries
├── .env.example
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## API routes

### Auth

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/signup` | POST | Create account (client-side-encrypted key blob) |
| `/api/auth/login` | POST | Login with signed Nostr challenge |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/auth/me` | GET / PATCH | Read or update authenticated user |

### Products

| Route | Method | Description |
|-------|--------|-------------|
| `/api/products` | GET / POST | List + create products |
| `/api/products/[id]` | GET / PATCH / DELETE | Read, update, soft-delete |
| `/api/shop/[username]` | GET | Public seller storefront |
| `/api/upload` | POST | Cloudinary signed-upload params |

### Orders & escrow

| Route | Method | Description |
|-------|--------|-------------|
| `/api/orders` | GET / POST | List + create orders |
| `/api/orders/[id]` | GET | Order detail (role-differentiated) |
| `/api/orders/[id]/ship` | PATCH | Seller marks shipped |
| `/api/orders/[id]/deliver` | PATCH | Buyer confirms receipt |
| `/api/orders/[id]/dispute` | PATCH | Raise dispute |
| `/api/escrow` | GET / POST | List / create escrows |
| `/api/escrow/[id]/release` | POST | Buyer releases all funds |
| `/api/escrow/[id]/milestones/[mId]` | PATCH | Seller marks milestone IN_PROGRESS / SUBMITTED |
| `/api/escrow/[id]/milestones/[mId]/release` | POST | Buyer releases one milestone |

### Paystack

| Route | Method | Description |
|-------|--------|-------------|
| `/api/paystack/initialize` | POST | Create Paystack charge → returns authorization URL |
| `/api/paystack/verify` | GET | Verify a payment by reference (frontend polling) |
| `/api/paystack/webhook` | POST | Receive `charge.success` events from Paystack |

### Payouts & wallet

| Route | Method | Description |
|-------|--------|-------------|
| `/api/wallet/balance` | GET | Seller's current available balance |
| `/api/wallet/activity` | GET | Seller ledger feed |
| `/api/payout` | POST | Initiate NGN payout to bank account |
| `/api/seller/bank-accounts` | GET / POST | List + add bank accounts |
| `/api/seller/bank-accounts/[id]` | DELETE | Remove a bank account |

---

## Development

### Scripts

```bash
pnpm dev              # Dev server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest unit + integration
pnpm db:push          # Apply schema without migration file
pnpm db:migrate       # Create + apply tracked migration
pnpm db:studio        # Prisma Studio
pnpm db:seed          # Seed demo data
```

### Adding Paystack test keys

1. Create a free account at [dashboard.paystack.com](https://dashboard.paystack.com)
2. Go to **Settings → API Keys** and copy your test keys
3. Add to `.env.local`:
   ```
   PAYSTACK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
   ```
4. For webhooks locally, use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/pages/how-to/preview-with-cloudflare-tunnel/):
   ```bash
   ngrok http 3000
   # paste https://xxxx.ngrok.io/api/paystack/webhook into Paystack dashboard
   ```

### Schema migrations

```bash
# Fast path (dev only — no migration history)
pnpm db:push

# Tracked migration (staging/production)
pnpm db:migrate
# → prompts for a migration name, e.g. "escrow-paystack"
```

---

## Deployment

### Vercel (recommended)

1. Connect repo to a Vercel project
2. Set all required environment variables in the Vercel dashboard
3. Set the build command to `prisma generate && next build`
4. Push to `main` — Vercel deploys automatically

### Paystack webhook setup (production)

1. In [Paystack dashboard](https://dashboard.paystack.com/#/settings/developer) → **API Keys & Webhooks**
2. Set webhook URL to `https://yourdomain.com/api/paystack/webhook`
3. Copy the webhook secret and set `PAYSTACK_WEBHOOK_SECRET` in your environment

### Other platforms

Any Node 22+ host with a Postgres connection works. The app is stateless — no in-memory caches that need to survive restarts.

---

## Contributing

Three vertical ownership areas:

| Area | Owns | Code |
|------|------|------|
| **Catalog** | Products, seller profiles, auth, uploads | `src/services/{catalog,auth}/`, `src/app/api/{products,shop,upload,auth}/` |
| **Commerce** | Orders, escrow, Paystack, ledger, payouts | `src/services/{commerce,paystack,payout,pricing}/`, `src/app/api/{orders,escrow,paystack,payout,wallet}/` |
| **Experience** | Pages, components, PWA, design system | `src/app/` (non-API), `src/components/`, `src/lib/`, `src/store/` |

Conventions:
- Branch: `feat/<description>`, `fix/<description>`, `chore/<description>`
- Commits: imperative, lowercase first word
- Every PR must pass `pnpm typecheck` and `pnpm lint`

---

## License

MIT — see [`LICENSE`](LICENSE).

---

## Acknowledgements

- [Paystack](https://paystack.com) — Nigerian payment infrastructure
- [Cloudinary](https://cloudinary.com) — image hosting and upload
- [Supabase](https://supabase.com) — managed Postgres
- [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) — the foundation
- [Prisma](https://prisma.io) — database ORM
