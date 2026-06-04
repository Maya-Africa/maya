/**
 * One-off Nostr backfill script.
 *
 * For every seller whose nsec can be decrypted with DEMO_SEED_PASSWORD,
 * re-publishes their full Nostr presence:
 *   1. Kind 0  — profile (name / about / avatar / lud16)
 *   2. Kind 30017 — stall definition
 *   3. Kind 30018 — each product  +  kind 30402 classified listing (dual)
 *   4. Kind 30023 — long bio (only if User.longBio is set)
 *   5. Kind 10002 — relay list
 *
 * Updates Product.nostrEventId after each kind 30018 publish.
 * Prints a summary on completion.
 *
 * Run:
 *   pnpm tsx scripts/backfill-nostr.ts
 */

// Load .env.local before anything else so DATABASE_URL etc. are available.
// We intentionally bypass src/lib/env.ts (its zod schema requires BREEZ/
// BITNOB vars that are irrelevant here).
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { SimplePool, finalizeEvent } from 'nostr-tools';

import { unlockSellerKey }                     from '@/lib/auth/server-crypto';
import {
  buildProfileEventTemplate,
  buildStallEventTemplate,
  buildProductEventTemplate,
  buildClassifiedListingEventTemplate,
  buildLongFormEventTemplate,
  buildRelayListEventTemplate,
}                                              from '@/services/nostr/events';
import type { SellerInfo }                     from '@/types/shared';

// ── Env ───────────────────────────────────────────────────────────────────────

const DEMO_SEED_PASSWORD = process.env.DEMO_SEED_PASSWORD;
const RELAY_LIST = (process.env.NEXT_PUBLIC_NOSTR_RELAYS ?? '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

if (!DEMO_SEED_PASSWORD) {
  console.error('❌  DEMO_SEED_PASSWORD is not set. Abort.');
  process.exit(1);
}
if (RELAY_LIST.length === 0) {
  console.error('❌  NEXT_PUBLIC_NOSTR_RELAYS is empty. Abort.');
  process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
const pool   = new SimplePool();

// ── Helpers ───────────────────────────────────────────────────────────────────

const PUBLISH_TIMEOUT_MS = 5000;

async function publish(template: ReturnType<typeof buildProfileEventTemplate>, secretKey: Uint8Array): Promise<string> {
  const signed = finalizeEvent(template, secretKey);
  const promises = pool.publish(RELAY_LIST, signed);
  const results  = await Promise.allSettled(
    promises.map((p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), PUBLISH_TIMEOUT_MS))]))
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  if (ok === 0) console.warn(`    ⚠  event ${signed.id.slice(0, 12)}… accepted by 0 relays`);
  return signed.id;
}

function toSellerInfo(u: {
  id: string; username: string; npub: string; lightningAddr: string | null;
  displayName: string | null; avatar: string | null; about: string | null;
  stallStatus: string; stallStatusMessage: string | null;
}): SellerInfo {
  return {
    id: u.id,
    username: u.username,
    npub: u.npub,
    lightningAddress: u.lightningAddr ?? `${u.username}@bitscy.com`,
    displayName: u.displayName,
    avatar: u.avatar,
    about: u.about,
    stallStatus: u.stallStatus,
    stallStatusMessage: u.stallStatusMessage,
  };
}

// ── Counters ──────────────────────────────────────────────────────────────────

const counts = {
  sellersProcessed: 0,
  sellersSkipped:   0,
  kind0:    0,
  kind30017: 0,
  kind30018: 0,
  kind30402: 0,
  kind30023: 0,
  kind10002: 0,
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startMs = Date.now();

  const sellers = await prisma.user.findMany({
    where: { role: 'SELLER', encryptedKey: { not: null } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n🔄  Bitscy Nostr backfill`);
  console.log(`    Relays  : ${RELAY_LIST.join(', ')}`);
  console.log(`    Sellers : ${sellers.length} found with stored keys`);
  console.log('');

  for (const seller of sellers) {
    console.log(`  👤  @${seller.username} (${seller.id})`);

    // ── Decrypt nsec ────────────────────────────────────────────────────────
    if (!seller.encryptedKey || !seller.salt || !seller.iv) {
      console.log(`      ⛔  Missing encryptedKey/salt/iv — skipping`);
      counts.sellersSkipped++;
      continue;
    }

    let secretKey: Uint8Array;
    try {
      secretKey = await unlockSellerKey(
        seller.encryptedKey,
        seller.salt,
        seller.iv,
        DEMO_SEED_PASSWORD!,
      );
    } catch (err) {
      console.log(`      ⛔  Decryption failed (wrong password or corrupted blob) — skipping`);
      if (err instanceof Error) console.log(`         ${err.message}`);
      counts.sellersSkipped++;
      continue;
    }

    // ── Kind 0 — profile ────────────────────────────────────────────────────
    try {
      const template = buildProfileEventTemplate({
        displayName: seller.displayName,
        about:       seller.about,
        avatar:      seller.avatar,
        lightningAddr: seller.lightningAddr,
      });
      const id = await publish(template, secretKey);
      console.log(`      ✅  kind 0 (profile)     ${id.slice(0, 16)}…`);
      counts.kind0++;
    } catch (err) {
      console.warn(`      ❌  kind 0 failed: ${err instanceof Error ? err.message : err}`);
    }

    // ── Kind 30017 — stall ──────────────────────────────────────────────────
    try {
      const template = buildStallEventTemplate(toSellerInfo(seller));
      const id = await publish(template, secretKey);
      console.log(`      ✅  kind 30017 (stall)   ${id.slice(0, 16)}…`);
      counts.kind30017++;
    } catch (err) {
      console.warn(`      ❌  kind 30017 failed: ${err instanceof Error ? err.message : err}`);
    }

    // ── Kind 10002 — relay list ─────────────────────────────────────────────
    try {
      const template = buildRelayListEventTemplate(RELAY_LIST);
      const id = await publish(template, secretKey);
      console.log(`      ✅  kind 10002 (relays)  ${id.slice(0, 16)}…`);
      counts.kind10002++;
    } catch (err) {
      console.warn(`      ❌  kind 10002 failed: ${err instanceof Error ? err.message : err}`);
    }

    // ── Kind 30023 — long bio ───────────────────────────────────────────────
    if (seller.longBio) {
      try {
        const template = buildLongFormEventTemplate({
          userId:      seller.id,
          displayName: seller.displayName,
          longBio:     seller.longBio,
        });
        const id = await publish(template, secretKey);
        console.log(`      ✅  kind 30023 (bio)     ${id.slice(0, 16)}…`);
        counts.kind30023++;
      } catch (err) {
        console.warn(`      ❌  kind 30023 failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    // ── Products — kind 30018 + 30402 ───────────────────────────────────────
    const products = await prisma.product.findMany({
      where: { sellerId: seller.id, status: { not: 'UNLISTED' } },
      include: { seller: { select: { username: true, displayName: true } } },
    });

    for (const p of products) {
      const productForBuilder = {
        id:                  p.id,
        sellerId:            p.sellerId,
        sellerUsername:      p.seller.username,
        sellerDisplayName:   p.seller.displayName,
        title:               p.title,
        description:         p.description,
        priceSats:           p.priceSats.toString(),
        priceNgnDisplay:     '',
        shippingSats:        p.shippingSats.toString(),
        category:            p.category as Parameters<typeof buildProductEventTemplate>[0]['category'],
        images:              p.images,
        isDigital:           p.isDigital,
        stock:               p.stock,
        status:              p.status as Parameters<typeof buildProductEventTemplate>[0]['status'],
        nostrEventId:        p.nostrEventId,
        createdAt:           p.createdAt.toISOString(),
      };

      let kind30018Id: string | null = null;

      // kind 30018
      try {
        const template = buildProductEventTemplate(productForBuilder);
        kind30018Id = await publish(template, secretKey);
        await prisma.product.update({
          where: { id: p.id },
          data:  { nostrEventId: kind30018Id },
        });
        console.log(`      ✅  kind 30018 "${p.title.slice(0, 30)}"  ${kind30018Id.slice(0, 12)}…`);
        counts.kind30018++;
      } catch (err) {
        console.warn(`      ❌  kind 30018 "${p.title.slice(0, 30)}" failed: ${err instanceof Error ? err.message : err}`);
      }

      // kind 30402 — dual publish (best-effort, doesn't block kind 30018)
      try {
        const template = buildClassifiedListingEventTemplate(productForBuilder);
        const id30402 = await publish(template, secretKey);
        console.log(`      ✅  kind 30402 "${p.title.slice(0, 30)}"  ${id30402.slice(0, 12)}…`);
        counts.kind30402++;
      } catch (err) {
        console.warn(`      ❌  kind 30402 "${p.title.slice(0, 30)}" failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    counts.sellersProcessed++;
    console.log('');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalMs = Date.now() - startMs;
  const totalEvents =
    counts.kind0 + counts.kind30017 + counts.kind30018 +
    counts.kind30402 + counts.kind30023 + counts.kind10002;

  console.log('══════════════════════════════════════════════════════════');
  console.log('  Backfill complete');
  console.log('──────────────────────────────────────────────────────────');
  console.log(`  Sellers processed : ${counts.sellersProcessed}`);
  console.log(`  Sellers skipped   : ${counts.sellersSkipped} (wrong password / corrupted blob)`);
  console.log('');
  console.log(`  Events published  : ${totalEvents}`);
  console.log(`    kind 0   profile         : ${counts.kind0}`);
  console.log(`    kind 30017 stall         : ${counts.kind30017}`);
  console.log(`    kind 30018 products      : ${counts.kind30018}`);
  console.log(`    kind 30402 listings      : ${counts.kind30402}`);
  console.log(`    kind 30023 long bio      : ${counts.kind30023}`);
  console.log(`    kind 10002 relay list    : ${counts.kind10002}`);
  console.log('');
  console.log(`  Total time : ${(totalMs / 1000).toFixed(1)}s`);
  console.log('══════════════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    pool.close(RELAY_LIST);
    await prisma.$disconnect();
  });
