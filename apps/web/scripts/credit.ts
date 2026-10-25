// Manual wallet top-up until online recharge exists: pnpm --filter @wa/web credit <email> <rupees> [note]
import { prisma } from '@wa/db';
import { formatRupees, rupees } from '@wa/billing';
import { creditWallet } from '../src/lib/wallet';

const [email, amount, note = 'Manual top-up'] = process.argv.slice(2);
if (!email || !amount) {
  console.error('Usage: pnpm --filter @wa/web credit <email> <rupees> [note]');
  process.exit(1);
}

const user = await prisma.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
const wallet = await creditWallet(user.orgId, rupees(amount), 'cash', note);
console.log(`Credited ${formatRupees(rupees(amount))} to ${email}. Balance: ${formatRupees(wallet.balance)}`);
await prisma.$disconnect();
