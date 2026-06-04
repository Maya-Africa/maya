import Link from 'next/link'
import { ChevronRight, Shield, Clock, Wrench, Scissors, Paintbrush, Hammer, Gem, Package } from 'lucide-react'

const CATEGORIES = [
  { label: 'Carpentry & Woodwork', icon: 'Hammer' },
  { label: 'Tailoring & Fashion', icon: 'Scissors' },
  { label: 'Art & Painting', icon: 'Paintbrush' },
  { label: 'Jewellery & Accessories', icon: 'Gem' },
  { label: 'Repair & Handiwork', icon: 'Wrench' },
  { label: 'Crafts & Handmade', icon: 'Package' },
]

const PRODUCTS = [
  { id: 1, title: 'Handwoven Fabric Bolt', seller: 'Zainab Studio', price: 25000, category: 'Textiles', image: '/artwork-2.jpg' },
  { id: 2, title: 'Custom Brass Pendant', seller: 'Ama Metalworks', price: 45000, category: 'Jewellery', image: '/artwork-6.jpg' },
  { id: 4, title: 'Hand-thrown Ceramic Vase', seller: 'Fatima Pottery', price: 85000, category: 'Ceramics', image: '/artwork-3.jpg' },
  { id: 6, title: 'Gold-fill Filigree Earrings', seller: 'Zainab Studio', price: 35000, category: 'Jewellery', image: '/artwork-4.jpg' },
]

const MILESTONE_STEPS = [
  { step: '1', label: 'Buyer places order & pays', sub: 'Funds go into escrow immediately', highlight: false },
  { step: '2', label: 'Seller completes the work', sub: 'Milestones tracked in real-time', highlight: false },
  { step: '3', label: 'Buyer confirms delivery', sub: 'One tap to release payment', highlight: false },
  { step: '4', label: 'Seller receives naira', sub: 'Directly to Nigerian bank account', highlight: true },
]

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-normal tracking-tight">Maya</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Browse</Link>
            <Link href="/sell" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Sell on Maya</Link>
            <Link href="/signin" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/sell" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-sans text-sm font-medium hover:bg-primary/90 transition-colors">
              Open your shop
            </Link>
          </div>
          <Link href="/sell" className="md:hidden bg-primary text-primary-foreground px-4 py-2 rounded-md font-sans text-sm font-medium">
            Get started
          </Link>
        </div>
      </nav>

      {/* 1. HERO */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-3 py-1.5 rounded-full font-sans text-xs font-medium">
                  <Shield className="w-3.5 h-3.5" /> Secure escrow on every order
                </div>
                <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-normal leading-[1.1]">
                  Your craft.<br />Your business.<br />Get paid.
                </h1>
                <p className="font-sans text-base sm:text-lg text-muted max-w-lg leading-relaxed">
                  Maya is the marketplace for every skilled trade — tailors, carpenters, jewellers, potters, repair specialists, and more. List your work, get paid securely in naira, and grow your business.
                </p>
              </div>

              <ul className="font-sans text-sm space-y-3">
                {[
                  'Escrow protection — funds released only when you deliver',
                  'Milestone payments for big projects',
                  'Pay & get paid in naira via Paystack',
                  'No business registration required',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-3.5 rounded-md font-sans font-medium hover:bg-primary/90 transition-colors">
                  Open your shop — free
                </Link>
                <Link href="/marketplace" className="inline-flex items-center justify-center border border-border text-foreground px-8 py-3.5 rounded-md font-sans font-medium hover:bg-card transition-colors">
                  Browse marketplace
                </Link>
              </div>
            </div>

            {/* Escrow flow mockup */}
            <div className="relative h-[480px] rounded-2xl bg-card border border-border p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-sm font-medium">Order #2847 — Custom Dining Table</span>
                <span className="bg-accent/15 text-accent text-xs font-sans px-2.5 py-1 rounded-full font-medium">In Escrow</span>
              </div>
              <div className="space-y-3 flex-1">
                {[
                  { label: 'Design approval', amount: '₦15,000', done: true, active: false },
                  { label: 'Frame complete', amount: '₦25,000', done: true, active: false },
                  { label: 'Surface finish', amount: '₦20,000', done: false, active: true },
                  { label: 'Final delivery', amount: '₦30,000', done: false, active: false },
                ].map((m, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${m.active ? 'border-accent/40 bg-accent/5' : m.done ? 'border-border bg-card' : 'border-border bg-background'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${m.done ? 'bg-success text-white' : m.active ? 'bg-accent text-white' : 'bg-border text-muted'}`}>
                      {m.done ? '✓' : i + 1}
                    </div>
                    <span className={`font-sans text-sm flex-1 ${m.done ? 'line-through text-muted' : ''}`}>{m.label}</span>
                    <span className="font-sans text-sm font-medium">{m.amount}</span>
                    {m.active && (
                      <span className="bg-accent text-white text-xs px-3 py-1 rounded font-sans font-medium">Release</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 flex justify-between items-center">
                <div>
                  <p className="font-sans text-xs text-muted">Total in escrow</p>
                  <p className="font-serif text-2xl font-normal text-primary">₦90,000</p>
                </div>
                <div className="flex items-center gap-1.5 text-muted">
                  <Shield className="w-4 h-4 text-success" />
                  <span className="font-sans text-xs">Buyer protected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORIES */}
      <section className="py-14 sm:py-20 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl sm:text-4xl font-normal mb-10 text-center">Every trade. One platform.</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Carpentry & Woodwork', Icon: Hammer },
              { label: 'Tailoring & Fashion', Icon: Scissors },
              { label: 'Art & Painting', Icon: Paintbrush },
              { label: 'Jewellery', Icon: Gem },
              { label: 'Repair & Handiwork', Icon: Wrench },
              { label: 'Crafts & Handmade', Icon: Package },
            ].map(({ label, Icon }) => (
              <Link key={label} href="/marketplace" className="flex flex-col items-center gap-3 p-5 rounded-xl bg-background border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group text-center">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <span className="font-sans text-xs font-medium leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FEATURED PRODUCTS */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-10">
            <h2 className="font-serif text-4xl sm:text-5xl font-normal">On Maya now</h2>
            <Link href="/marketplace" className="font-sans text-sm text-primary hover:text-accent font-medium flex items-center gap-1 transition-colors">
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {PRODUCTS.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`} className="group cursor-pointer">
                <div className="relative overflow-hidden rounded-xl bg-card border border-border mb-3 h-48 sm:h-56 lg:h-64">
                  <img src={product.image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <span className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm text-xs font-sans px-2 py-1 rounded-full">
                    {product.category}
                  </span>
                </div>
                <h3 className="font-serif text-base sm:text-lg font-normal mb-0.5">{product.title}</h3>
                <p className="font-sans text-sm text-muted mb-1.5">{product.seller}</p>
                <p className="font-sans text-base font-semibold text-accent">₦{product.price.toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ESCROW SECTION */}
      <section className="py-16 sm:py-24 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 px-3 py-1.5 rounded-full font-sans text-xs font-medium">
                <Shield className="w-3.5 h-3.5" /> Built-in escrow
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
                Every order is protected — for both sides.
              </h2>
              <p className="font-sans text-base text-white/70 leading-relaxed">
                Buyers pay into escrow. Money is held securely until the work is done. Sellers get paid when they deliver. No more disputes about money going missing or work not being delivered.
              </p>
              <div className="space-y-4">
                {[
                  { Icon: Clock, title: 'Milestone payments', desc: 'Break big projects into stages. Get paid at each milestone.' },
                  { Icon: Shield, title: 'Funds held securely', desc: 'Money sits in escrow until buyer confirms delivery.' },
                  { Icon: ChevronRight, title: 'One-click release', desc: 'Buyer releases funds with a tap. Paid in minutes.' },
                ].map(({ Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white/80" />
                    </div>
                    <div>
                      <p className="font-sans text-sm font-semibold">{title}</p>
                      <p className="font-sans text-sm text-white/60">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {MILESTONE_STEPS.map(({ step, label, sub, highlight }) => (
                <div key={step} className={`flex items-center gap-4 p-4 rounded-xl border ${highlight ? 'bg-accent/20 border-accent/40' : 'bg-white/10 border-white/20'}`}>
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 font-serif text-lg font-normal">{step}</div>
                  <div>
                    <p className="font-sans text-sm font-medium">{label}</p>
                    <p className="font-sans text-xs text-white/60">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. VALUE PROPS */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card rounded-2xl p-8 sm:p-10 space-y-6 border border-border">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif text-3xl sm:text-4xl font-normal">For craftspeople: sell your skill, get paid fairly.</h3>
              <p className="font-sans text-base text-muted leading-relaxed">
                No vendor application, no business registration, no middleman cutting your margin. You set your prices, list your services or products, and receive naira directly to your bank when you deliver.
              </p>
              <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-3.5 rounded-md font-sans font-medium hover:bg-primary/90 transition-colors">
                Open your shop
              </Link>
            </div>
            <div className="bg-card rounded-2xl p-8 sm:p-10 space-y-6 border border-border">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-serif text-3xl sm:text-4xl font-normal">For buyers: quality work, money protected.</h3>
              <p className="font-sans text-base text-muted leading-relaxed">
                Pay securely via Paystack — card, bank transfer, or USSD. Your money goes into escrow. Released to the seller only when you confirm you are satisfied. For large projects, pay in milestones.
              </p>
              <Link href="/marketplace" className="inline-flex items-center justify-center border border-border text-foreground px-8 py-3.5 rounded-md font-sans font-medium hover:bg-background transition-colors">
                Browse the marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS */}
      <section className="py-16 sm:py-24 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-4">From listing to paid — in 3 steps</h2>
            <p className="font-sans text-base text-muted mb-14">No technical knowledge needed. Works on the phone you already have.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { n: '1', title: 'List your work', desc: 'Add photos, set your price, describe what you do. Your shop goes live at maya.com/shop/your-name in minutes.' },
                { n: '2', title: 'Buyer pays into escrow', desc: 'Buyer pays via Paystack (card, bank transfer, USSD). Funds are held securely until you deliver.' },
                { n: '3', title: 'Deliver & get paid', desc: 'Mark the order done. Buyer confirms. Funds release instantly to your Nigerian bank account.' },
              ].map(({ n, title, desc }) => (
                <div key={n} className="space-y-4">
                  <div className="font-serif text-5xl font-normal text-accent">{n}</div>
                  <h3 className="font-serif text-xl font-normal">{title}</h3>
                  <p className="font-sans text-sm text-muted leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-12">
              <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-3.5 rounded-md font-sans font-medium hover:bg-primary/90 transition-colors">
                Open your shop — free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PAYSTACK TRUST BADGE */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 p-8 rounded-2xl bg-card border border-border">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="font-sans font-bold text-2xl text-primary">₦</span>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-serif text-2xl font-normal mb-1">Payments powered by Paystack</h3>
              <p className="font-sans text-sm text-muted">Pay by card, bank transfer, or USSD. Fully naira. Trusted by thousands of Nigerian businesses. Buyers pay in. Sellers get paid out directly to their bank.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CTA */}
      <section className="py-16 sm:py-24 bg-card border-t border-border">
        <div className="mx-auto max-w-2xl px-5 sm:px-6 text-center">
          <h2 className="font-serif text-5xl sm:text-6xl font-normal mb-6">Ready to start?</h2>
          <p className="font-sans text-base text-muted mb-10">Free to join. Free to list. Maya takes 2% when you sell.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sell" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-4 rounded-md font-sans font-medium text-lg hover:bg-primary/90 transition-colors">
              Open your shop
            </Link>
            <Link href="/marketplace" className="inline-flex items-center justify-center border border-border text-foreground px-8 py-4 rounded-md font-sans font-medium text-lg hover:bg-background transition-colors">
              Browse marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-8 mb-10">
            <div className="sm:col-span-3 lg:col-span-2">
              <div className="font-serif text-2xl font-normal mb-2">Maya</div>
              <p className="font-sans text-sm text-muted max-w-xs">The marketplace for skilled craft businesses. Secure escrow. Naira payments. Zero gatekeeping.</p>
            </div>
            <div>
              <h4 className="font-sans font-semibold text-sm mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><Link href="/marketplace" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Marketplace</Link></li>
                <li><Link href="/sell" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Sell on Maya</Link></li>
                <li><Link href="/marketplace" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Browse</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-sans font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="font-sans text-sm text-muted hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/faq" className="font-sans text-sm text-muted hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href="/contact" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-sans font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="/terms" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="/privacy" className="font-sans text-sm text-muted hover:text-foreground transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="font-sans text-xs text-muted">© 2025 Maya. All rights reserved.</p>
            <p className="font-sans text-xs text-muted">Payments by Paystack · Secure escrow · 2% per sale</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
