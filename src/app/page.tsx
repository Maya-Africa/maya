import Link from 'next/link'
import { ChevronRight, Shield, Clock, Wrench, Scissors, Paintbrush, Hammer, Gem, Package, Star } from 'lucide-react'
import { prisma } from '@/lib/db'

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tailoring: Scissors,
  carpentry: Hammer,
  jewelry: Gem,
  art: Paintbrush,
  ceramics: Package,
  leather: Package,
  repairs: Wrench,
  crafts: Package,
  other: Package,
}

const CATEGORY_LABELS: Record<string, string> = {
  tailoring: 'Tailoring',
  carpentry: 'Carpentry',
  jewelry: 'Jewellery',
  art: 'Art & Painting',
  ceramics: 'Ceramics',
  leather: 'Leather',
  repairs: 'Repairs',
  crafts: 'Crafts',
  other: 'Other',
}

const CATEGORIES = [
  { key: 'tailoring', label: 'Tailoring & Fashion', Icon: Scissors },
  { key: 'carpentry', label: 'Carpentry & Wood', Icon: Hammer },
  { key: 'jewelry', label: 'Jewellery', Icon: Gem },
  { key: 'art', label: 'Art & Painting', Icon: Paintbrush },
  { key: 'ceramics', label: 'Ceramics', Icon: Package },
  { key: 'repairs', label: 'Repairs', Icon: Wrench },
]

// NGN display helper — matches server's DEMO_BTC_NGN_RATE
function satsToNgn(sats: bigint): number {
  return Number((sats * 145_000_000n) / 100_000_000n)
}

async function getFeaturedProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { seller: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })
    return products
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const featuredProducts = await getFeaturedProducts()
  const hasProducts = featuredProducts.length > 0

  return (
    <div className="bg-background text-foreground">

      {/* ── NAVIGATION ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-0 flex items-center justify-between h-16">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="font-serif text-primary-foreground text-lg font-normal leading-none">M</span>
            </div>
            <span className="font-serif text-xl font-normal tracking-tight">Maya</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/marketplace" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Browse</Link>
            <Link href="/sell" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Sell</Link>
            <Link href="/signin" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/sell" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-sans text-sm font-medium hover:bg-primary/90 transition-colors">
              Open shop
            </Link>
          </div>

          <Link href="/sell" className="md:hidden bg-primary text-primary-foreground px-3.5 py-2 rounded-lg font-sans text-sm font-medium">
            Start selling
          </Link>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="pt-16 min-h-[90vh] flex items-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-accent/5 rounded-full -translate-y-1/4 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 px-3.5 py-1.5 rounded-full font-sans text-xs font-semibold tracking-wide uppercase">
                <Shield className="w-3 h-3" /> Escrow-protected payments
              </div>

              <div className="space-y-4">
                <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl font-normal leading-[0.95] tracking-tight">
                  <span className="text-foreground">Your craft.</span><br />
                  <span className="text-primary">Your price.</span><br />
                  <span className="text-foreground">Get paid.</span>
                </h1>
                <p className="font-sans text-lg text-muted max-w-md leading-relaxed">
                  The marketplace for every skilled trade in Nigeria — tailors, carpenters, jewellers, potters, repair specialists, and more.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Shield, text: 'Escrow holds buyer money until you deliver' },
                  { icon: Clock, text: 'Milestone payments for big projects' },
                  { icon: Wrench, text: 'Pay & receive in naira via Paystack' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3 h-3 text-primary" />
                    </div>
                    <span className="font-sans text-sm text-foreground">{text}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-7 py-3.5 rounded-xl font-sans font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Open your shop — free
                </Link>
                <Link href="/marketplace" className="inline-flex items-center justify-center bg-card border border-border text-foreground px-7 py-3.5 rounded-xl font-sans font-semibold text-sm hover:bg-border/40 transition-colors">
                  Browse marketplace
                </Link>
              </div>

              <p className="font-sans text-xs text-muted">No registration fee · 2% per sale · Naira payouts</p>
            </div>

            {/* Right — escrow mockup card */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Shadow card behind */}
                <div className="absolute inset-0 bg-primary/10 rounded-2xl translate-x-3 translate-y-3" />
                <div className="relative bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-sans text-xs text-muted uppercase tracking-wide font-medium mb-0.5">Active order</p>
                      <p className="font-sans text-sm font-semibold">Custom wardrobe — Abuja</p>
                    </div>
                    <span className="bg-accent/15 text-accent text-xs font-sans px-2.5 py-1 rounded-full font-semibold">In Escrow</span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs font-sans text-muted mb-1.5">
                      <span>2 of 4 milestones done</span>
                      <span>₦90,000 total</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full w-1/2 bg-primary rounded-full" />
                    </div>
                  </div>

                  {/* Milestones */}
                  <div className="space-y-2.5">
                    {[
                      { label: 'Measurements & deposit', amount: '₦15,000', done: true },
                      { label: 'Frame & lining', amount: '₦25,000', done: true },
                      { label: 'Fitting session', amount: '₦20,000', done: false, active: true },
                      { label: 'Final delivery', amount: '₦30,000', done: false },
                    ].map((m, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
                        m.active ? 'border-accent/40 bg-accent/5' :
                        m.done ? 'border-border/40 bg-border/10' :
                        'border-border/20 opacity-50'
                      }`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                          m.done ? 'bg-primary text-primary-foreground' :
                          m.active ? 'bg-accent text-white' :
                          'bg-border text-muted'
                        }`}>
                          {m.done ? '✓' : i + 1}
                        </div>
                        <span className={`font-sans flex-1 ${m.done ? 'text-muted line-through' : 'text-foreground'}`}>{m.label}</span>
                        <span className="font-sans font-semibold text-foreground">{m.amount}</span>
                        {m.active && (
                          <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-sans font-semibold">Release →</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <p className="font-sans text-[11px] text-muted">Released so far</p>
                      <p className="font-serif text-2xl text-primary font-normal">₦40,000</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="w-3 h-3 text-primary" />
                      </div>
                      <span className="font-sans text-xs text-muted font-medium">Both sides protected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ──────────────────────────────────────────────────────── */}
      <div className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {[
              { value: '2%', label: 'platform fee' },
              { value: '₦0', label: 'to list' },
              { value: 'Paystack', label: 'payments' },
              { value: 'Escrow', label: 'protection' },
              { value: 'Naira', label: 'payouts' },
            ].map(({ value, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="font-serif text-lg text-primary font-normal">{value}</span>
                <span className="font-sans text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CATEGORIES ─────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <h2 className="font-serif text-4xl sm:text-5xl font-normal">Every trade.</h2>
              <p className="font-sans text-base text-muted mt-1">One trusted platform.</p>
            </div>
            <Link href="/marketplace" className="font-sans text-sm text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all">
              Browse all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {CATEGORIES.map(({ key, label, Icon }) => (
              <Link
                key={key}
                href={`/marketplace?category=${key}`}
                className="group flex flex-col items-center gap-3 p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-sans text-[11px] sm:text-xs font-medium text-center leading-tight text-muted group-hover:text-foreground transition-colors">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ON MAYA NOW ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <h2 className="font-serif text-4xl sm:text-5xl font-normal">On Maya now</h2>
              <p className="font-sans text-sm text-muted mt-1">Latest listings from skilled sellers</p>
            </div>
            <Link href="/marketplace" className="font-sans text-sm text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all">
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {hasProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {featuredProducts.map((product) => (
                <Link key={product.id} href={`/products/${product.id}`} className="group">
                  <div className="relative overflow-hidden rounded-2xl bg-border/30 aspect-square mb-3">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-border/40">
                        <Package className="w-10 h-10 text-muted/30" />
                      </div>
                    )}
                    {/* Category badge */}
                    <span className="absolute top-2.5 left-2.5 bg-background/90 backdrop-blur-sm text-[10px] font-sans font-semibold px-2 py-1 rounded-full text-muted uppercase tracking-wide">
                      {CATEGORY_LABELS[product.category] ?? product.category}
                    </span>
                  </div>
                  <div className="px-0.5">
                    <h3 className="font-sans text-sm font-semibold leading-snug mb-0.5 text-foreground group-hover:text-primary transition-colors line-clamp-1">{product.title}</h3>
                    <p className="font-sans text-xs text-muted mb-2">{product.seller.displayName ?? product.seller.username}</p>
                    <p className="font-sans text-sm font-bold text-accent">₦{satsToNgn(product.priceSats).toLocaleString('en-NG')}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* Empty state — encourage first sellers */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Package className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-serif text-2xl font-normal mb-2">Be one of the first</h3>
              <p className="font-sans text-sm text-muted max-w-sm mb-6">No listings yet. Open your shop and be among the first sellers on Maya.</p>
              <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-6 py-3 rounded-xl font-sans text-sm font-semibold hover:bg-primary/90 transition-colors">
                Open your shop
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── ESCROW EXPLAINED ───────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-primary text-primary-foreground overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 border border-white/15 px-3.5 py-1.5 rounded-full font-sans text-xs font-semibold uppercase tracking-wide">
                <Shield className="w-3 h-3" /> Built-in escrow
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
                Money is safe<br/>for both sides.
              </h2>
              <p className="font-sans text-base text-white/70 leading-relaxed">
                Buyer pays. Money is locked in escrow. Seller works. Buyer approves. Money is released. No chasing payments, no lost work.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { Icon: Shield, title: 'Buyer protected', desc: 'Pay only when satisfied' },
                  { Icon: Clock, title: 'Milestones', desc: 'Pay in stages for big jobs' },
                  { Icon: Star, title: 'Seller protected', desc: 'Get paid for every delivery' },
                ].map(({ Icon, title, desc }) => (
                  <div key={title} className="bg-white/8 border border-white/10 rounded-xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-white/80" />
                    </div>
                    <p className="font-sans text-sm font-semibold">{title}</p>
                    <p className="font-sans text-xs text-white/60">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Flow steps */}
            <div className="space-y-3">
              {[
                { n: '01', label: 'Buyer places order & pays', sub: 'Funds locked in escrow immediately via Paystack' },
                { n: '02', label: 'Seller completes the work', sub: 'Progress tracked through milestones' },
                { n: '03', label: 'Buyer confirms & releases', sub: 'One tap to approve each milestone' },
                { n: '04', label: 'Seller receives naira', sub: 'Directly to any Nigerian bank account' },
              ].map(({ n, label, sub }, i) => (
                <div key={n} className={`flex items-start gap-4 p-4 rounded-xl border ${i === 3 ? 'border-accent/50 bg-accent/15' : 'border-white/10 bg-white/5'}`}>
                  <span className="font-serif text-2xl text-white/30 font-normal leading-none mt-0.5 w-8 flex-shrink-0">{n}</span>
                  <div>
                    <p className="font-sans text-sm font-semibold">{label}</p>
                    <p className="font-sans text-xs text-white/55 mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR SELLERS / BUYERS ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-2xl p-8 sm:p-10 border border-border space-y-5">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-serif text-3xl sm:text-4xl font-normal mb-3">For sellers</h3>
                <p className="font-sans text-sm text-muted leading-relaxed">No vendor application, no business registration, no middleman cutting your margin. Set your prices, list your work, and get paid to your bank account when you deliver.</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Your shop at maya.com/shop/your-name',
                  'Withdraw to any Nigerian bank',
                  'Set prices in naira',
                  'Milestone payments for large projects',
                ].map(t => (
                  <li key={t} className="flex items-center gap-2.5 font-sans text-sm">
                    <span className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-7 py-3 rounded-xl font-sans text-sm font-semibold hover:bg-primary/90 transition-colors">
                Open your shop
              </Link>
            </div>

            <div className="bg-card rounded-2xl p-8 sm:p-10 border border-border space-y-5">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-serif text-3xl sm:text-4xl font-normal mb-3">For buyers</h3>
                <p className="font-sans text-sm text-muted leading-relaxed">Pay securely with Paystack — card, bank transfer, or USSD. Your money goes into escrow. Released to the seller only when you confirm you're happy.</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Browse without signing up',
                  'Pay by card, bank transfer, or USSD',
                  'Escrow holds funds until delivery',
                  'Milestone-by-milestone control',
                ].map(t => (
                  <li key={t} className="flex items-center gap-2.5 font-sans text-sm">
                    <span className="w-4 h-4 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[9px] font-bold flex-shrink-0">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/marketplace" className="inline-flex items-center justify-center bg-card border border-border text-foreground px-7 py-3 rounded-xl font-sans text-sm font-semibold hover:bg-border/40 transition-colors">
                Browse marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-3">From listing to paid</h2>
            <p className="font-sans text-sm text-muted">Works on the phone you already have. No technical setup.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: '1', title: 'List your work', desc: 'Add photos, set your naira price, describe what you do. Shop goes live at maya.com/shop/your-name in minutes.' },
              { n: '2', title: 'Buyer pays into escrow', desc: 'Buyer pays via Paystack — card, bank transfer, or USSD. Funds held securely. You can see the order immediately.' },
              { n: '3', title: 'Deliver & get paid', desc: 'Complete the work. Buyer confirms. Funds release to your Maya balance. Withdraw to your Nigerian bank anytime.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="relative pl-14">
                <div className="absolute left-0 top-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="font-serif text-xl text-primary font-normal">{n}</span>
                </div>
                <h3 className="font-sans text-base font-semibold mb-2">{title}</h3>
                <p className="font-sans text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-sans text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Open your shop — free
            </Link>
          </div>
        </div>
      </section>

      {/* ── PAYSTACK BADGE ─────────────────────────────────────────────────── */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-8 rounded-2xl bg-card border border-border">
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <span className="font-serif text-primary-foreground text-2xl font-normal">₦</span>
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="font-sans text-base font-semibold mb-1">Payments powered by Paystack</h3>
              <p className="font-sans text-sm text-muted">Pay by card, bank transfer, or USSD. 100% naira. Trusted by thousands of Nigerian businesses. Sellers receive payouts directly to their bank account.</p>
            </div>
            <Link href="/sell" className="flex-shrink-0 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-sans text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap">
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-card border-t border-border">
        <div className="mx-auto max-w-xl px-5 sm:px-6 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <span className="font-serif text-primary-foreground text-2xl font-normal">M</span>
          </div>
          <h2 className="font-serif text-5xl sm:text-6xl font-normal">Start today.</h2>
          <p className="font-sans text-sm text-muted">Free to join. Free to list. Maya takes 2% when you sell.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-4 rounded-xl font-sans font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Open your shop
            </Link>
            <Link href="/marketplace" className="inline-flex items-center justify-center bg-background border border-border text-foreground px-8 py-4 rounded-xl font-sans font-semibold hover:bg-border/30 transition-colors">
              Browse marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-10">
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="font-serif text-primary-foreground text-sm font-normal">M</span>
                </div>
                <span className="font-serif text-lg font-normal">Maya</span>
              </div>
              <p className="font-sans text-xs text-muted leading-relaxed max-w-[200px]">Skilled craft marketplace. Secure escrow. Naira payments.</p>
            </div>
            <div>
              <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-muted mb-4">Platform</h4>
              <ul className="space-y-2.5">
                {([['Marketplace', '/marketplace'], ['Sell on Maya', '/sell'], ['How it works', '/sell#how']] as [string, string][]).map(([label, href]: [string, string]) => (
                  <li key={label}><Link href={href} className="font-sans text-sm text-muted hover:text-foreground transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-muted mb-4">Company</h4>
              <ul className="space-y-2.5">
                {([['About', '/about'], ['FAQ', '/faq'], ['Contact', '/contact']] as [string, string][]).map(([label, href]: [string, string]) => (
                  <li key={label}><Link href={href} className="font-sans text-sm text-muted hover:text-foreground transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-muted mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {([['Terms', '/terms'], ['Privacy', '/privacy']] as [string, string][]).map(([label, href]: [string, string]) => (
                  <li key={label}><Link href={href} className="font-sans text-sm text-muted hover:text-foreground transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="font-sans text-xs text-muted">© 2025 Maya. All rights reserved.</p>
            <p className="font-sans text-xs text-muted">Paystack payments · Escrow protection · 2% per sale</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
