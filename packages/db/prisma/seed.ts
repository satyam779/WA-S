import { PrismaClient, type BillingMode, type MessageCategory } from '@prisma/client';
import { rupees } from '@wa/billing';

const prisma = new PrismaClient();
const effectiveFrom = new Date('2026-01-01T00:00:00+05:30');

// Our prices. DIRECT_META = platform fee only (Meta bills the seller's card).
// CREDIT_LINE = Meta's India rate + markup, used once we are a Solution Partner.
const rates: [MessageCategory, BillingMode, country: string, price: string, metaCost: string][] = [
  ['AUTHENTICATION', 'DIRECT_META', '*', '0.05', '0'],
  ['AUTHENTICATION_INTERNATIONAL', 'DIRECT_META', '*', '0.05', '0'],
  ['UTILITY', 'DIRECT_META', '*', '0.05', '0'],
  ['MARKETING', 'DIRECT_META', '*', '0.10', '0'],
  ['SERVICE', 'DIRECT_META', '*', '0', '0'],
  ['AUTHENTICATION', 'CREDIT_LINE', 'IN', '0.15', '0.115'],
  ['AUTHENTICATION_INTERNATIONAL', 'CREDIT_LINE', 'IN', '2.60', '2.4971'],
  ['UTILITY', 'CREDIT_LINE', 'IN', '0.15', '0.115'],
  ['MARKETING', 'CREDIT_LINE', 'IN', '0.95', '0.8631'],
  ['SERVICE', 'CREDIT_LINE', 'IN', '0.15', '0.115'],
];

for (const [category, billingMode, country, price, metaCost] of rates) {
  const data = { priceMicros: BigInt(rupees(price)), metaCostMicros: BigInt(rupees(metaCost)) };
  await prisma.rate.upsert({
    where: { plan_category_country_billingMode_effectiveFrom: { plan: 'starter', category, country, billingMode, effectiveFrom } },
    create: { plan: 'starter', category, country, billingMode, effectiveFrom, ...data },
    update: data,
  });
}
console.log(`Seeded ${rates.length} rates`);
await prisma.$disconnect();
