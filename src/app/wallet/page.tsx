'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ArrowDownLeft, ArrowUpRight, Copy, Check, Loader2 } from 'lucide-react'

type Tab = 'receive' | 'send' | null

const EXCHANGE_RATE = 294 // ₦/sat — same placeholder as elsewhere

// Mock wallet state. Real wallet reads balance via Breez SDK / WASM.
const WALLET = {
  balanceSats: 95200,
  address: 'bc1qadaeze...wpu7gx5d3v4mz9',
}

interface WalletActivity {
  id: string
  type: 'RECEIVED' | 'SENT'
  amountSats: number
  description: string
  relative: string
}

const RECENT_ACTIVITY: WalletActivity[] = [
  {
    id: 'tx-1',
    type: 'RECEIVED',
    amountSats: 50000,
    description: 'From external wallet',
    relative: '2 minutes ago',
  },
  {
    id: 'tx-2',
    type: 'RECEIVED',
    amountSats: 45200,
    description: 'From external wallet',
    relative: '8 minutes ago',
  },
]

export default function WalletHomePage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(null)

  // Receive panel state
  const [addressCopied, setAddressCopied] = useState(false)

  // Send panel state
  const [invoice, setInvoice] = useState('')
  const [parsedAmount, setParsedAmount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sentSuccessfully, setSentSuccessfully] = useState(false)

  // Forget-wallet destructive zone
  const [showForgetConfirm, setShowForgetConfirm] = useState(false)
  const [forgetting, setForgetting] = useState(false)

  const balanceNgn = Math.round((WALLET.balanceSats * EXCHANGE_RATE) / 100) * 100 // approx

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(WALLET.address)
    setAddressCopied(true)
    setTimeout(() => setAddressCopied(false), 2000)
  }

  const handleInvoiceChange = (value: string) => {
    setInvoice(value)
    // Mock: any non-empty value "parses" to 8,500 sats. Real parser
    // decodes the BOLT-11 string.
    if (value.trim().length > 10) {
      setParsedAmount(8500)
    } else {
      setParsedAmount(null)
    }
  }

  const handlePay = async () => {
    if (!parsedAmount) return
    setSending(true)
    await new Promise(r => setTimeout(r, 1800))
    setSending(false)
    setSentSuccessfully(true)
    setTimeout(() => {
      setSentSuccessfully(false)
      setInvoice('')
      setParsedAmount(null)
      setTab(null)
    }, 2500)
  }

  const handleForget = async () => {
    setForgetting(true)
    await new Promise(r => setTimeout(r, 1200))
    router.push('/')
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Back-arrow header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-5 py-3 flex items-center">
          <Link
            href="/"
            className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
            aria-label="Back home"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-24">
        <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-2">Wallet.</h1>
        <p className="font-sans text-sm text-muted mb-8">
          On this device. Not on Maya&apos;s servers.
        </p>

        {/* Balance card */}
        <section className="bg-white border border-border rounded-lg p-6 mb-6">
          <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">
            Balance
          </p>
          <p className="font-serif text-5xl sm:text-6xl font-normal tabular-nums mb-1">
            ₦{balanceNgn.toLocaleString('en-NG')}
          </p>
          <p className="font-sans text-sm text-muted mb-1 tabular-nums">
            ≈ {WALLET.balanceSats.toLocaleString('en-NG')} sats
          </p>
          <p className="font-sans text-xs text-muted">Updated just now</p>
        </section>

        {/* Send / Receive action buttons */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            type="button"
            onClick={() => setTab(tab === 'send' ? null : 'send')}
            className={`flex items-center justify-center gap-2 py-3 rounded font-sans text-base font-medium transition-colors ${
              tab === 'send'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white border border-border text-foreground hover:bg-input/30'
            }`}
            style={{ minHeight: '52px' }}
          >
            <ArrowUpRight size={18} />
            Send
          </button>
          <button
            type="button"
            onClick={() => setTab(tab === 'receive' ? null : 'receive')}
            className={`flex items-center justify-center gap-2 py-3 rounded font-sans text-base font-medium transition-colors ${
              tab === 'receive'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white border border-border text-foreground hover:bg-input/30'
            }`}
            style={{ minHeight: '52px' }}
          >
            <ArrowDownLeft size={18} />
            Receive
          </button>
        </div>

        {/* SEND panel */}
        {tab === 'send' && (
          <section className="bg-white border border-border rounded-lg p-5 mb-6 space-y-4">
            <h2 className="font-serif text-xl font-normal">Pay an invoice</h2>

            {sentSuccessfully ? (
              <div className="bg-success/10 rounded-lg p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="font-sans text-base text-foreground font-medium">Sent.</p>
                  <p className="font-sans text-sm text-muted mt-1">
                    Payment confirmed. Your balance is updated.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="invoice" className="block font-sans text-sm font-medium">
                    Paste invoice
                  </label>
                  <textarea
                    id="invoice"
                    value={invoice}
                    onChange={e => handleInvoiceChange(e.target.value)}
                    placeholder="lnbc..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white rounded border border-border font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    style={{ fontSize: '14px' }}
                  />
                  <p className="font-sans text-xs text-muted">
                    Paste a Lightning invoice from the seller, or scan a QR code.
                  </p>
                </div>

                {parsedAmount !== null && (
                  <div className="bg-[#F5EFE3] rounded p-3 space-y-1">
                    <p className="font-sans text-xs text-muted">You&apos;re sending</p>
                    <p className="font-serif text-2xl text-accent tabular-nums">
                      ₦{(parsedAmount * EXCHANGE_RATE).toLocaleString('en-NG')}
                    </p>
                    <p className="font-sans text-xs text-muted tabular-nums">
                      {parsedAmount.toLocaleString('en-NG')} sats
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={!parsedAmount || sending}
                  className="w-full bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : parsedAmount ? (
                    `Pay ₦${(parsedAmount * EXCHANGE_RATE).toLocaleString('en-NG')}`
                  ) : (
                    'Paste an invoice'
                  )}
                </button>
              </>
            )}
          </section>
        )}

        {/* RECEIVE panel */}
        {tab === 'receive' && (
          <section className="bg-white border border-border rounded-lg p-5 mb-6 space-y-4">
            <h2 className="font-serif text-xl font-normal">Your wallet address</h2>

            {/* QR placeholder */}
            <div className="bg-white rounded flex items-center justify-center text-center mx-auto"
                 style={{ width: 200, height: 200 }}>
              <div className="text-xs text-muted font-sans">QR code</div>
            </div>

            <div className="bg-[#F5EFE3] rounded p-3">
              <p className="font-mono text-sm text-foreground break-all">{WALLET.address}</p>
            </div>

            <button
              type="button"
              onClick={handleCopyAddress}
              className="w-full bg-transparent border border-primary text-primary py-2.5 rounded font-sans text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
            >
              {addressCopied ? (
                <>
                  <Check className="w-4 h-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy address
                </>
              )}
            </button>

            <p className="font-sans text-xs text-muted">
              Send Bitcoin or Lightning to this address from any wallet or exchange. Funds usually
              show up in under a minute.
            </p>
          </section>
        )}

        {/* Recent activity */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-normal mb-4">Recent activity</h2>

          {RECENT_ACTIVITY.length === 0 ? (
            <div className="bg-white border border-border rounded-lg p-6 text-center">
              <p className="font-sans text-sm text-muted">No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {RECENT_ACTIVITY.map(item => (
                <div
                  key={item.id}
                  className="bg-white border border-border rounded-lg p-4 flex items-center gap-4"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      item.type === 'RECEIVED' ? 'bg-success/10' : 'bg-input'
                    }`}
                  >
                    {item.type === 'RECEIVED' ? (
                      <ArrowDownLeft className="w-4 h-4 text-success" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-base text-foreground">
                      {item.description}
                    </p>
                    <p className="font-sans text-xs text-muted">{item.relative}</p>
                  </div>
                  <p
                    className={`font-sans text-base font-medium tabular-nums shrink-0 ${
                      item.type === 'RECEIVED' ? 'text-success' : 'text-foreground'
                    }`}
                  >
                    {item.type === 'RECEIVED' ? '+' : '−'}{item.amountSats.toLocaleString('en-NG')} sats
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Forget wallet — destructive */}
        <div className="h-px bg-border mb-6" />
        <section>
          <h2 className="font-serif text-lg font-normal mb-3 text-error">Forget this wallet</h2>
          {!showForgetConfirm ? (
            <div className="space-y-3">
              <p className="font-sans text-sm text-muted">
                Removes the wallet from this device. As long as you have your 12-word backup
                phrase, you can restore it later.
              </p>
              <button
                type="button"
                onClick={() => setShowForgetConfirm(true)}
                className="w-full bg-white border border-error text-error py-3 rounded font-sans font-medium hover:bg-error/5 transition-colors"
              >
                Forget this wallet
              </button>
            </div>
          ) : (
            <div className="bg-[#F5EFE3] rounded-lg p-4 space-y-4">
              <p className="font-sans text-sm text-foreground">
                Forget this wallet on this device? You&apos;ll need your backup phrase to access it
                again.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleForget}
                  disabled={forgetting}
                  className="flex-1 bg-error text-primary-foreground py-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {forgetting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Forgetting…
                    </>
                  ) : (
                    'Yes, forget it'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgetConfirm(false)}
                  disabled={forgetting}
                  className="flex-1 bg-transparent text-foreground py-3 rounded font-sans text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
