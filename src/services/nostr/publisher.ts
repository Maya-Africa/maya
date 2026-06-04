import { SimplePool, type Event } from 'nostr-tools';
import { NOSTR_RELAY_LIST } from '@/lib/env';

declare global {
  // eslint-disable-next-line no-var
  var __nostrPool: SimplePool | undefined;
}

function getPool(): SimplePool {
  if (!globalThis.__nostrPool) {
    globalThis.__nostrPool = new SimplePool();
  }
  return globalThis.__nostrPool;
}

export interface PublishResult {
  acceptedBy: string[];
  failedRelays: string[];
}

const RELAY_TIMEOUT_MS = 5_000;

export async function publishEvent(event: Event): Promise<PublishResult> {
  const relays = NOSTR_RELAY_LIST;

  if (relays.length === 0) {
    console.warn('No Nostr relays configured. Event not published.', { eventId: event.id });
    return { acceptedBy: [], failedRelays: [] };
  }

  const pool = getPool();
  const promises = pool.publish(relays, event);

  // Race each relay promise against a 5s timeout. Never throws — failures become { ok: false }.
  const tagged = promises.map((p, i) => {
    const relay = relays[i]!;
    return Promise.race([
      p.then(() => ({ relay, ok: true as const })),
      new Promise<{ relay: string; ok: false }>((resolve) =>
        setTimeout(() => resolve({ relay, ok: false }), RELAY_TIMEOUT_MS),
      ),
    ]).catch(() => ({ relay, ok: false as const }));
  });

  const results = await Promise.all(tagged);

  const acceptedBy = results.filter((r) => r.ok).map((r) => r.relay);
  const failedRelays = results.filter((r) => !r.ok).map((r) => r.relay);

  if (acceptedBy.length === 0) {
    console.error('Failed to publish Nostr event to any relay', { eventId: event.id, kind: event.kind });
  } else {
    console.log(`Nostr event ${event.id} accepted by ${acceptedBy.length}/${relays.length} relays`);
  }

  return { acceptedBy, failedRelays };
}
