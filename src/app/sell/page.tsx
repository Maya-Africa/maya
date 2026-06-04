'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Menu } from 'lucide-react'

export default function SellerPage() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index)
  }

  const faqItems = [
    {
      q: 'How do I actually get my money out?',
      a: 'You withdraw to your Nigerian bank account. Maya converts to naira at the live exchange rate and sends it via our payment partner. Withdrawals usually arrive within 30 minutes during banking hours.',
    },
    {
      q: 'What if a buyer wants a refund?',
      a: 'You and the buyer work it out directly. If you both agree to a refund, Maya reverses the transaction. We\'ll add formal dispute resolution later as we learn what sellers and buyers actually need.',
    },
    {
      q: 'Do I need to declare this on taxes?',
      a: 'That depends on your situation and the tax laws where you live. Maya doesn\'t withhold taxes or report your sales to anyone — you\'re a sole proprietor selling your own work. Talk to a local accountant for specifics.',
    },
    {
      q: 'Is this legal in Nigeria?',
      a: 'Yes. Selling your craft and your art is legal. You\'re paid in naira to your bank account like any other sale. Maya handles all the technical complexity in the background so you don\'t have to think about it.',
    },
    {
      q: 'What if Maya disappears one day?',
      a: 'Your shop data and order history are yours. We\'re building export tools so you can take everything with you. We built it this way deliberately — your livelihood shouldn\'t depend on any single platform staying around.',
    },
  ]

  return (
    <div className="bg-background text-foreground">
      {/* Top Navigation */}
      <nav className="fixed top-0 z-50 w-full transition-all duration-300 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-normal">Maya</Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="font-sans text-sm hover:text-accent transition-colors">Marketplace</Link>
            <Link href="/sell" className="font-sans text-sm hover:text-accent transition-colors font-medium">Sell on Maya</Link>
            <Link href="/signin" className="font-sans text-sm hover:text-accent transition-colors">Sign in</Link>
            <Link href="/signup" className="bg-primary text-primary-foreground px-6 py-2.5 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity">
              Open your shop
            </Link>
          </div>

          <button className="md:hidden p-2" aria-label="Open menu">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* 1. HERO SECTION */}
      <section className="relative pt-24 pb-12 sm:pt-32 sm:pb-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 items-center">
            {/* Hero Text */}
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-4">
                <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-normal leading-tight text-pretty">
                  Your craft. Your prices. Your bank account.
                </h1>
                <p className="font-sans text-base sm:text-lg text-muted max-w-md">
                  Most platforms take 10-15% of every sale, demand business registration, and won't even let Nigerian sellers in. Maya takes 2%, asks for none of that, and pays you directly to your Nigerian bank account.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/signup" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-4 rounded font-sans font-medium text-lg hover:opacity-90 transition-opacity">
                  Open your shop
                </Link>
              </div>

              <p className="font-sans text-xs text-muted pt-4">Free to start. 2 minutes. No credit card.</p>
            </div>

            {/* Wireframe Mockup */}
            <div className="relative h-80 sm:h-96 lg:h-[500px] bg-card rounded-lg border border-border p-6 flex flex-col justify-between">
              {/* Balance Card */}
              <div className="space-y-4">
                <div className="bg-primary/10 rounded border border-primary p-4">
                  <div className="font-sans text-xs text-muted mb-2">Available Balance</div>
                  <div className="font-serif text-3xl font-normal text-primary">₦127,500</div>
                </div>

                {/* Recent Sales */}
                <div className="space-y-2">
                  <div className="font-sans text-sm font-medium">Recent Sales</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                      <div className="w-12 h-12 bg-accent/20 rounded"></div>
                      <div className="flex-1 px-3">
                        <div className="font-sans text-xs font-medium">Indigo Fabric</div>
                        <div className="font-sans text-xs text-muted">Today</div>
                      </div>
                      <div className="font-sans text-sm">₦25,000</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="w-12 h-12 bg-accent/20 rounded"></div>
                      <div className="flex-1 px-3">
                        <div className="font-sans text-xs font-medium">Pendant</div>
                        <div className="font-sans text-xs text-muted">Yesterday</div>
                      </div>
                      <div className="font-sans text-sm">₦45,000</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Withdraw Button */}
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-sans text-sm font-medium w-full hover:opacity-90 transition-opacity">
                Withdraw to GTBank
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WHAT YOU GET */}
      <section className="py-10 sm:py-16 bg-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-12">What you get</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="text-accent font-serif text-2xl font-normal mt-1">✓</div>
              <div>
                <p className="font-sans text-base font-medium">Your own shop URL: maya.com/shop/your-name</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-accent font-serif text-2xl font-normal mt-1">✓</div>
              <div>
                <p className="font-sans text-base font-medium">Withdraw to any Nigerian bank, instantly</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-accent font-serif text-2xl font-normal mt-1">✓</div>
              <div>
                <p className="font-sans text-base font-medium">Set your own prices in naira</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-accent font-serif text-2xl font-normal mt-1">✓</div>
              <div>
                <p className="font-sans text-base font-medium">Get paid even when you&apos;re sleeping</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-accent font-serif text-2xl font-normal mt-1">✓</div>
              <div>
                <p className="font-sans text-base font-medium">Tools that work on the phone you already have</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-accent font-serif text-2xl font-normal mt-1">✓</div>
              <div>
                <p className="font-sans text-base font-medium">No business registration, no tax ID required</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHAT IT ACTUALLY COSTS */}
      <section className="py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div>
              <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-4">What it actually costs</h2>
              <p className="font-sans text-base text-muted">Other platforms take a cut at every step. Maya doesn't.</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-4 px-4 font-sans font-semibold text-base border-b border-border">Cost</th>
                    <th className="text-left py-4 px-4 font-sans font-semibold text-base border-b border-border border-l-2 border-l-accent bg-accent/5">Maya</th>
                    <th className="text-left py-4 px-4 font-sans font-semibold text-base border-b border-border">Other platforms</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">Listing your work</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border border-l-2 border-l-accent bg-accent/5">Free</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">Often per-listing fees, or a monthly subscription</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">When you sell</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border border-l-2 border-l-accent bg-accent/5">2% transaction fee</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">Typically 6-12% commission</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">Getting paid</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border border-l-2 border-l-accent bg-accent/5">Included</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">Additional 3-4% processing fees</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">Converting currency</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border border-l-2 border-l-accent bg-accent/5">None for naira</td>
                    <td className="py-4 px-4 font-sans text-sm border-b border-border">Usually 2-3% conversion charge</td>
                  </tr>
                  <tr className="bg-accent/10">
                    <td className="py-4 px-4 font-sans font-medium text-sm">Bottom line on a ₦25,000 sale</td>
                    <td className="py-4 px-4 font-sans font-medium text-sm border-l-2 border-l-accent bg-accent/5">You keep ₦24,500</td>
                    <td className="py-4 px-4 font-sans font-medium text-sm">You might keep ₦19,000-21,000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="font-sans text-sm text-muted text-center">
              We made this comparison honest because you deserve to see the numbers.
            </p>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-10 sm:py-16 bg-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-12">From signup to first sale</h2>

          <div className="space-y-12 sm:space-y-16">
            {/* Step 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-4">
                <div className="font-serif text-5xl font-normal text-accent">1</div>
                <h3 className="font-serif text-2xl font-normal">Sign up in 2 minutes</h3>
                <p className="font-sans text-base text-muted">Just email, password, and your shop name. That's it. No verification calls, no document uploads.</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-6 h-80 flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-sans text-muted">Email</div>
                  <div className="h-10 bg-input rounded border border-border"></div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-sans text-muted">Password</div>
                  <div className="h-10 bg-input rounded border border-border"></div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-sans text-muted">Shop name</div>
                  <div className="h-10 bg-input rounded border border-border"></div>
                </div>
                <div className="h-10 bg-primary rounded"></div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-4 lg:order-2">
                <div className="font-serif text-5xl font-normal text-accent">2</div>
                <h3 className="font-serif text-2xl font-normal">Tell us about your craft</h3>
                <p className="font-sans text-base text-muted">Add a profile photo, write a sentence or two about what you make, and where you're based.</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-6 h-80 flex flex-col items-center justify-center space-y-4 lg:order-1">
                <div className="w-24 h-24 bg-accent/20 rounded-full"></div>
                <div className="w-32 h-6 bg-input rounded"></div>
                <div className="w-full space-y-2">
                  <div className="h-4 bg-input rounded"></div>
                  <div className="h-4 bg-input rounded w-3/4"></div>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <div className="w-4 h-4 bg-input rounded"></div>
                  <div className="h-4 bg-input rounded w-20"></div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-4">
                <div className="font-serif text-5xl font-normal text-accent">3</div>
                <h3 className="font-serif text-2xl font-normal">List your first piece</h3>
                <p className="font-sans text-base text-muted">Upload up to 5 photos, set your price in naira, write a short description. You can have your first product live in 5 minutes.</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-6 h-80 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="aspect-square bg-input rounded"></div>
                  <div className="aspect-square bg-input rounded"></div>
                  <div className="aspect-square bg-input rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-sans text-muted">Price (₦)</div>
                  <div className="h-10 bg-input rounded border border-border"></div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-sans text-muted">Description</div>
                  <div className="h-16 bg-input rounded border border-border"></div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-4 lg:order-2">
                <div className="font-serif text-5xl font-normal text-accent">4</div>
                <h3 className="font-serif text-2xl font-normal">Share your shop</h3>
                <p className="font-sans text-base text-muted">Your shop has its own link: maya.com/shop/your-name. Share it on Instagram, WhatsApp, anywhere. Buyers worldwide can visit and buy.</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 h-80 flex flex-col justify-start space-y-4 lg:order-1">
                <div className="bg-primary/10 rounded p-3 space-y-2">
                  <div className="h-6 bg-primary rounded w-2/3"></div>
                  <div className="h-4 bg-primary/20 rounded w-1/2"></div>
                </div>
                <div className="space-y-3">
                  <div className="bg-input rounded h-20"></div>
                  <div className="bg-input rounded h-20"></div>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-4">
                <div className="font-serif text-5xl font-normal text-accent">5</div>
                <h3 className="font-serif text-2xl font-normal">Get paid, withdraw, repeat</h3>
                <p className="font-sans text-base text-muted">When someone buys, the money goes to your Maya balance. Withdraw to your Nigerian bank anytime, in any amount. The exchange rate is live.</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-6 h-80 flex flex-col justify-between">
                <div>
                  <div className="font-sans text-xs text-muted mb-2">Available Balance</div>
                  <div className="font-serif text-4xl font-normal text-primary">₦127,500</div>
                </div>
                <button className="bg-primary text-primary-foreground px-4 py-3 rounded font-sans text-sm font-medium w-full hover:opacity-90 transition-opacity">
                  Withdraw to Bank
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. REAL NUMBERS */}
      <section className="py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-12">Currently on Maya</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mb-8">
            <div>
              <div className="font-serif text-5xl sm:text-6xl font-normal text-primary mb-2">14</div>
              <p className="font-sans text-base text-muted">sellers</p>
            </div>
            <div>
              <div className="font-serif text-5xl sm:text-6xl font-normal text-primary mb-2">47</div>
              <p className="font-sans text-base text-muted">products</p>
            </div>
            <div>
              <div className="font-serif text-5xl sm:text-6xl font-normal text-primary mb-2">8</div>
              <p className="font-sans text-base text-muted">cities across Nigeria and Ghana</p>
            </div>
          </div>

          <p className="font-sans text-sm text-muted text-center">Growing every week.</p>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="py-10 sm:py-16 bg-white">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-12">Honest answers to real questions</h2>

          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/5 transition-colors"
                  aria-expanded={expandedFAQ === index}
                >
                  <h3 className="font-sans font-medium text-left">{item.q}</h3>
                  {expandedFAQ === index ? (
                    <ChevronUp className="w-5 h-5 flex-shrink-0 text-primary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 flex-shrink-0 text-muted" />
                  )}
                </button>
                {expandedFAQ === index && (
                  <div className="px-6 py-4 border-t border-border bg-card">
                    <p className="font-sans text-base text-muted leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. OPEN SOURCE */}
      <section className="py-10 sm:py-16">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal mb-6">Built to outlast us</h2>
          <p className="font-sans text-base text-muted leading-relaxed">
            Maya is built to be fair to the people who use it. Low fees, transparent pricing, and payments that actually work for Nigerian sellers and buyers. Whether you're a tailor, carpenter, jeweller, or any other skilled trade — you deserve a platform that pays you properly and protects your customers. We take 2%. That's it.
          </p>
        </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="py-10 sm:py-24 bg-white">
        <div className="mx-auto max-w-2xl px-5 sm:px-6 text-center">
          <h2 className="font-serif text-5xl sm:text-6xl font-normal mb-8">Ready to open your shop?</h2>

          <Link href="/signup" className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-4 rounded font-sans font-medium text-lg hover:opacity-90 transition-opacity mb-6">
            Open your shop
          </Link>

          <p className="font-sans text-sm text-muted">Free to start. 2 minutes. No credit card.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-8">
            <div className="sm:col-span-3 lg:col-span-1">
              <div className="font-serif text-2xl font-normal mb-2">Maya</div>
              <p className="font-sans text-xs text-muted">Skilled crafts. Secure escrow. Naira payments.</p>
            </div>

            <div>
              <h4 className="font-sans font-semibold text-sm mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><Link href="/marketplace" className="font-sans text-sm text-muted hover:text-accent transition-colors">Marketplace</Link></li>
                <li><Link href="/sell" className="font-sans text-sm text-muted hover:text-accent transition-colors">Sell on Maya</Link></li>
                <li><Link href="/marketplace" className="font-sans text-sm text-muted hover:text-accent transition-colors">Browse</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-sans font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="font-sans text-sm text-muted hover:text-accent transition-colors">About</Link></li>
                <li><Link href="/faq" className="font-sans text-sm text-muted hover:text-accent transition-colors">FAQ</Link></li>
                <li><Link href="/contact" className="font-sans text-sm text-muted hover:text-accent transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-sans font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="/terms" className="font-sans text-sm text-muted hover:text-accent transition-colors">Terms</Link></li>
                <li><Link href="/privacy" className="font-sans text-sm text-muted hover:text-accent transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
