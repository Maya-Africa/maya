import Link from 'next/link'
import { ChevronRight, Shield, Scissors, Hammer, Gem, Paintbrush, Wrench, Package, Star } from 'lucide-react'
import { prisma } from '@/lib/db'

const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

function satsToNgn(sats: bigint) {
  return Number((sats * NGN_PER_BTC) / SATS_PER_BTC)
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

async function getFeatured() {
  try {
    return await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { seller: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })
  } catch { return [] }
}

export default async function LandingPage() {
  const products = await getFeatured()

  return (
    <div style={{ background: '#FAFAF8', color: '#0F1923', fontFamily: 'var(--font-inter, system-ui, sans-serif)' }}>

      {/* ━━━ NAV ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(250,250,248,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E8E4DE' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#1A2E44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-dm-serif)', color: '#fff', fontSize: 18, lineHeight: 1 }}>M</span>
            </div>
            <span style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 22, color: '#0F1923', letterSpacing: '-0.02em' }}>Maya</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden md:flex">
            {([['Browse', '/marketplace'], ['Sell on Maya', '/sell'], ['Sign in', '/signin']] as [string,string][]).map(([label, href]: [string,string]) => (
              <Link key={label} href={href} style={{ fontFamily: 'inherit', fontSize: 14, color: '#7A7065', textDecoration: 'none' }}
                className="hover:text-[#0F1923] transition-colors">{label}</Link>
            ))}
            <Link href="/sell" style={{ background: '#1A2E44', color: '#fff', padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
              className="hover:opacity-90 transition-opacity">
              Open shop
            </Link>
          </div>

          <Link href="/sell" style={{ background: '#1A2E44', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
            className="md:hidden">Start selling</Link>
        </div>
      </nav>

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '72px 20px 80px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(194,105,47,0.1)', border: '1px solid rgba(194,105,47,0.25)', color: '#C2692F', padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', width: 'fit-content' }}>
              <Shield style={{ width: 13, height: 13 }} />
              ESCROW-PROTECTED PAYMENTS
            </div>

            <div>
              <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 'clamp(52px, 8vw, 80px)', lineHeight: 0.97, letterSpacing: '-0.03em', margin: 0 }}>
                <span style={{ color: '#0F1923' }}>Your craft.</span><br />
                <span style={{ color: '#C2692F' }}>Your price.</span><br />
                <span style={{ color: '#1A2E44' }}>Get paid.</span>
              </h1>
              <p style={{ fontSize: 17, color: '#7A7065', lineHeight: 1.65, marginTop: 20, maxWidth: 440 }}>
                The trusted marketplace for every skilled trade in Nigeria — tailors, carpenters, jewellers, potters, repair specialists. Secure escrow on every order.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Escrow holds buyer money until you deliver',
                'Milestone payments for large projects',
                'Pay and receive in naira via Paystack',
                'No business registration required',
              ].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(194,105,47,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#C2692F', fontSize: 11, fontWeight: 700 }}>✓</span>
                  </div>
                  <span style={{ fontSize: 14, color: '#3A3530' }}>{t}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/sell" style={{ background: '#1A2E44', color: '#fff', padding: '14px 28px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 24px rgba(26,46,68,0.22)' }}
                className="hover:opacity-90 transition-opacity">
                Open your shop — free
              </Link>
              <Link href="/marketplace" style={{ background: '#fff', color: '#0F1923', padding: '14px 28px', borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none', border: '1.5px solid #E8E4DE' }}
                className="hover:border-[#1A2E44] transition-colors">
                Browse marketplace
              </Link>
            </div>
          </div>

          {/* Hero image */}
          <div style={{ position: 'relative' }} className="hidden lg:block">
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(194,105,47,0.08) 0%, rgba(26,46,68,0.06) 100%)', borderRadius: 24, transform: 'translate(12px, 12px)' }} />
            <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', height: 520 }}>
              <img
                src="/hero-artisan.jpg"
                alt="Skilled artisan at work"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Floating escrow card */}
              <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(232,228,222,0.8)', boxShadow: '0 8px 32px rgba(15,25,35,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#7A7065', letterSpacing: '0.06em' }}>ESCROW BALANCE</span>
                  <span style={{ background: 'rgba(194,105,47,0.12)', color: '#C2692F', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>Protected</span>
                </div>
                <div style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 28, color: '#1A2E44', marginBottom: 8 }}>₦127,500</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Design ✓', 'Frame ✓', 'Finish →', 'Delivery'].map((s, i) => (
                    <div key={s} style={{ flex: 1, textAlign: 'center', background: i < 2 ? '#1A2E44' : i === 2 ? '#C2692F' : '#F2EFE9', color: i < 3 ? '#fff' : '#7A7065', fontSize: 10, fontWeight: 600, padding: '5px 0', borderRadius: 6 }}>{s}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ TRUST BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ borderTop: '1px solid #E8E4DE', borderBottom: '1px solid #E8E4DE', background: '#fff' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 32px' }}>
          {[
            ['2%', 'platform fee'],
            ['₦0', 'to list'],
            ['Paystack', 'payments'],
            ['Escrow', 'on every order'],
            ['Naira', 'direct payouts'],
          ].map(([val, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 17, color: '#1A2E44' }}>{val}</span>
              <span style={{ fontSize: 12, color: '#7A7065' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━ CATEGORIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '72px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 'clamp(36px, 4vw, 52px)', margin: 0, color: '#0F1923' }}>Every trade.</h2>
            <p style={{ fontSize: 15, color: '#7A7065', marginTop: 4 }}>One trusted platform.</p>
          </div>
          <Link href="/marketplace" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: '#1A2E44', textDecoration: 'none' }} className="hover:text-accent transition-colors">
            Browse all <ChevronRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'tailoring', label: 'Tailoring & Fashion', Icon: Scissors, img: '/artwork-1.jpg' },
            { key: 'carpentry', label: 'Carpentry & Wood', Icon: Hammer, img: '/artwork-3.jpg' },
            { key: 'jewelry', label: 'Jewellery', Icon: Gem, img: '/artwork-4.jpg' },
            { key: 'art', label: 'Art & Painting', Icon: Paintbrush, img: '/artwork-2.jpg' },
            { key: 'ceramics', label: 'Ceramics', Icon: Package, img: '/artwork-7.jpg' },
            { key: 'repairs', label: 'Repairs & Service', Icon: Wrench, img: '/artwork-5.jpg' },
          ].map(({ key, label, img }) => (
            <Link key={key} href={`/marketplace?category=${key}`} style={{ textDecoration: 'none', borderRadius: 16, overflow: 'hidden', position: 'relative', aspectRatio: '1', display: 'block' }}
              className="group">
              <img src={img} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                className="group-hover:scale-105" />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,25,35,0.72) 0%, transparent 55%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: 0, letterSpacing: '0.01em' }}>{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ━━━ ON MAYA NOW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: '#fff', borderTop: '1px solid #E8E4DE', borderBottom: '1px solid #E8E4DE', padding: '72px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 'clamp(36px, 4vw, 52px)', margin: 0, color: '#0F1923' }}>On Maya now</h2>
              <p style={{ fontSize: 15, color: '#7A7065', marginTop: 4 }}>Latest listings from skilled sellers</p>
            </div>
            <Link href="/marketplace" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: '#1A2E44', textDecoration: 'none' }}>
              See all <ChevronRight style={{ width: 16, height: 16 }} />
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none' }} className="group">
                  <div style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: '1', background: '#F2EFE9', position: 'relative', marginBottom: 12 }}>
                    {p.images[0] ? (
                      <img src={p.images[0]} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }} className="group-hover:scale-105" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package style={{ width: 40, height: 40, color: '#C8C0B5' }} />
                      </div>
                    )}
                    {/* Category pill */}
                    <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, color: '#3A3530', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </div>
                    {/* Escrow shield */}
                    <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(26,46,68,0.88)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999 }}>
                      <Shield style={{ width: 10, height: 10, color: '#fff' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>ESCROW</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#7A7065', margin: '0 0 3px' }}>{p.seller.displayName ?? p.seller.username}</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0F1923', margin: '0 0 5px', lineHeight: 1.3 }} className="group-hover:text-[#1A2E44] transition-colors line-clamp-1">{p.title}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#C2692F', margin: 0 }}>₦{satsToNgn(p.priceSats).toLocaleString('en-NG')}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(26,46,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Package style={{ width: 28, height: 28, color: '#1A2E44' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 24, margin: '0 0 8px', color: '#0F1923' }}>Be one of the first</h3>
              <p style={{ fontSize: 14, color: '#7A7065', margin: '0 0 20px', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>No listings yet. Open your shop and be among the first sellers on Maya.</p>
              <Link href="/sell" style={{ display: 'inline-block', background: '#1A2E44', color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                Open your shop
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ ESCROW FEATURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: '#1A2E44', color: '#fff', padding: '80px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 24 }}>
                <Shield style={{ width: 12, height: 12 }} /> BUILT-IN ESCROW
              </div>
              <h2 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 'clamp(36px, 4vw, 52px)', lineHeight: 1.05, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
                Money is safe<br />for both sides.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: '0 0 32px', maxWidth: 420 }}>
                Buyer pays. Funds locked in escrow. Seller delivers. Buyer confirms. Payment released. No chasing, no losses, no disputes.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Shield, title: 'Buyer protected', desc: 'Pay only when satisfied' },
                  { icon: Star, title: 'Milestones', desc: 'Pay in stages for big jobs' },
                  { icon: Package, title: 'Seller protected', desc: 'Guaranteed payment on delivery' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      <Icon style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.8)' }} />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>{title}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step flow */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { n: '01', label: 'Buyer places order & pays', sub: 'Funds locked via Paystack immediately' },
                { n: '02', label: 'Seller completes the work', sub: 'Progress tracked through milestones' },
                { n: '03', label: 'Buyer confirms receipt', sub: 'One tap to release payment' },
                { n: '04', label: 'Seller receives naira', sub: 'Directly to Nigerian bank account' },
              ].map(({ n, label, sub }, i) => (
                <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', borderRadius: 14, border: `1px solid ${i === 3 ? 'rgba(194,105,47,0.5)' : 'rgba(255,255,255,0.1)'}`, background: i === 3 ? 'rgba(194,105,47,0.15)' : 'rgba(255,255,255,0.04)' }}>
                  <span style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 22, color: 'rgba(255,255,255,0.25)', lineHeight: 1, width: 32, flexShrink: 0 }}>{n}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 3px' }}>{label}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ FOR SELLERS + BUYERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '72px 20px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[
            {
              tag: 'FOR SELLERS',
              img: '/artwork-6.jpg',
              title: 'Sell your skill.\nGet paid fairly.',
              body: 'No vendor application, no business registration, no middleman. Set your prices, list your work, get paid to your Nigerian bank when you deliver.',
              points: ['Your shop at maya.com/shop/your-name', 'Withdraw to any Nigerian bank', 'Set prices in naira', 'Milestone payments for large projects'],
              cta: 'Open your shop',
              href: '/sell',
              accent: '#1A2E44',
            },
            {
              tag: 'FOR BUYERS',
              img: '/artwork-8.jpg',
              title: 'Quality work.\nMoney protected.',
              body: 'Pay securely via Paystack — card, bank transfer, or USSD. Your money goes into escrow. Released to the seller only when you confirm you\'re satisfied.',
              points: ['Browse without signing up', 'Card, bank transfer, or USSD', 'Escrow until you confirm delivery', 'Milestone control for big projects'],
              cta: 'Browse marketplace',
              href: '/marketplace',
              accent: '#C2692F',
            },
          ].map(({ tag, img, title, body, points, cta, href, accent }) => (
            <div key={tag} style={{ background: '#fff', borderRadius: 24, overflow: 'hidden', border: '1px solid #E8E4DE' }}>
              <div style={{ height: 220, overflow: 'hidden' }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
              </div>
              <div style={{ padding: 32 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: accent, display: 'block', marginBottom: 12 }}>{tag}</span>
                <h3 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 32, lineHeight: 1.1, margin: '0 0 14px', whiteSpace: 'pre-line' }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#7A7065', lineHeight: 1.7, margin: '0 0 20px' }}>{body}</p>
                <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {points.map(pt => (
                    <li key={pt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link href={href} style={{ display: 'inline-block', background: accent, color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                  {cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ PAYSTACK BADGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ background: '#fff', borderTop: '1px solid #E8E4DE', padding: '32px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1A2E44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-dm-serif)', color: '#fff', fontSize: 22 }}>₦</span>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>Payments powered by Paystack</p>
            <p style={{ fontSize: 13, color: '#7A7065', margin: 0 }}>Card · Bank transfer · USSD · 100% naira · Trusted by thousands of Nigerian businesses</p>
          </div>
        </div>
      </div>

      {/* ━━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: '#FAFAF8', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#1A2E44', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <span style={{ fontFamily: 'var(--font-dm-serif)', color: '#fff', fontSize: 26 }}>M</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 'clamp(40px, 5vw, 60px)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Start today.</h2>
          <p style={{ fontSize: 15, color: '#7A7065', margin: '0 0 32px' }}>Free to join. Free to list. Maya takes 2% when you sell.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/sell" style={{ background: '#1A2E44', color: '#fff', padding: '14px 32px', borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 24px rgba(26,46,68,0.22)' }}>
              Open your shop
            </Link>
            <Link href="/marketplace" style={{ background: '#fff', color: '#0F1923', padding: '14px 32px', borderRadius: 14, fontWeight: 600, fontSize: 15, textDecoration: 'none', border: '1.5px solid #E8E4DE' }}>
              Browse marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer style={{ borderTop: '1px solid #E8E4DE', background: '#fff', padding: '48px 0 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1A2E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-dm-serif)', color: '#fff', fontSize: 16 }}>M</span>
                </div>
                <span style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 18 }}>Maya</span>
              </div>
              <p style={{ fontSize: 13, color: '#7A7065', maxWidth: 220, lineHeight: 1.6, margin: 0 }}>
                The marketplace for skilled craft businesses. Secure escrow. Naira payments. Zero gatekeeping.
              </p>
            </div>
            {[
              { title: 'Platform', links: [['Marketplace', '/marketplace'], ['Sell on Maya', '/sell'], ['Browse', '/marketplace']] },
              { title: 'Company', links: [['About', '/about'], ['FAQ', '/faq'], ['Contact', '/contact']] },
              { title: 'Legal', links: [['Terms', '/terms'], ['Privacy', '/privacy']] },
            ].map(({ title, links }) => (
              <div key={title}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#7A7065', textTransform: 'uppercase', marginBottom: 16 }}>{title}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(links as [string, string][]).map(([label, href]) => (
                    <Link key={label} href={href} style={{ fontSize: 13, color: '#7A7065', textDecoration: 'none' }} className="hover:text-[#0F1923] transition-colors">{label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #E8E4DE', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: 12, color: '#7A7065', margin: 0 }}>© 2025 Maya. All rights reserved.</p>
            <p style={{ fontSize: 12, color: '#7A7065', margin: 0 }}>Paystack payments · Escrow protection · 2% per sale</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
