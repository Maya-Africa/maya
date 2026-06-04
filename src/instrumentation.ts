/**
 * Next.js instrumentation hook — runs once at server boot before any requests.
 *
 * Paystack payments are handled via webhooks (/api/paystack/webhook) and do not
 * require a boot-time event listener. This hook is kept as a placeholder for any
 * future server-init logic (e.g. warming connection pools, registering cron jobs).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Lightning event handler removed — payments are now handled by Paystack webhooks.
  // If you need to re-enable Lightning support, register the Breez event handler here.
}
