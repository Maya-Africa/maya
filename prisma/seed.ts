import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed the database with demo data.
 * Run with: pnpm db:seed
 *
 * Owned by the Catalog Engineer. Update this with real artist data
 * (e.g., the founder teammate's actual artwork) as the project develops.
 */
async function main() {
  console.warn('Seeding database…');

  // Clear existing data (dev only)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.user.deleteMany();

  // Sample sellers — replace with real artist data
  const adaeze = await prisma.user.create({
    data: {
      npub: 'demo_npub_adaeze_001',
      username: 'adaeze',
      displayName: 'Adaeze',
      about: 'Visual artist. Working between motherhood and the canvas.',
      role: 'SELLER',
      lightningAddr: 'adaeze@maya.com',
    },
  });

  await prisma.product.createMany({
    data: [
      {
        sellerId: adaeze.id,
        title: 'Lagos Sunset — Acrylic on canvas',
        description:
          'Acrylic on stretched canvas. 60x80cm. Captures the gold-orange Lagos sky at dusk.',
        priceSats: 250000n,
        shippingSats: 50000n,
        category: 'paintings',
        images: ['https://picsum.photos/seed/sunset/800/800'],
        isDigital: false,
        stock: 1,
      },
      {
        sellerId: adaeze.id,
        title: 'Yemoja Series I — Print',
        description: 'Limited edition digital print. Pay once, download instantly.',
        priceSats: 50000n,
        shippingSats: 0n,
        category: 'prints_digital',
        images: ['https://picsum.photos/seed/yemoja/800/800'],
        isDigital: true,
        digitalUrl: 'https://example.com/yemoja-print.pdf',
        stock: 100,
      },
    ],
  });

  console.warn('Seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
