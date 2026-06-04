/**
 * One-time script: migrate old product categories to the new Maya taxonomy.
 * Run: npx ts-node -r tsconfig-paths/register scripts/fix-categories.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MAP: Record<string, string> = {
  paintings: 'art',
  textiles: 'tailoring',
  sculpture: 'crafts',
  prints_digital: 'crafts',
  pottery: 'ceramics',
  // jewelry and leather stay the same
}

async function main() {
  for (const [oldCat, newCat] of Object.entries(MAP)) {
    const result = await prisma.product.updateMany({
      where: { category: oldCat },
      data: { category: newCat },
    })
    if (result.count > 0) {
      console.log(`  ${oldCat} → ${newCat}: updated ${result.count} products`)
    }
  }
  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
