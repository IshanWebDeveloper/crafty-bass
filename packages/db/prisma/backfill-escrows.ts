/**
 * Backfills a REQUESTED escrow for ASSIGNED jobs that were accepted before every
 * accepted quote started getting an escrow (see quotes.service.accept). Without
 * an escrow row the homeowner has no pay-to-start step, so these jobs are stuck.
 *
 * Scope: only ASSIGNED jobs (work not yet started) with an accepted quote and no
 * existing escrow. IN_PROGRESS/COMPLETED jobs already moved past the payment
 * point without an escrow, so backfilling a "pay to start" for them would be
 * misleading - they are intentionally left alone.
 *
 * The deposit amount mirrors quotes.service.accept exactly: the requested
 * materials deposit if any, else the call-out fee, else the whole total (clamped
 * to the total). Amounts are snapshotted from the accepted quote.
 *
 * Run:  pnpm --filter @repo/db db:backfill:escrows            (dry run - prints a plan)
 *       pnpm --filter @repo/db db:backfill:escrows -- --commit (creates the escrows)
 *
 * Idempotent: jobs that already have an escrow are skipped, and JobEscrow.jobId
 * is unique, so a second --commit run creates nothing.
 */
import { prisma } from '../src/index.js';

const APPLY = process.argv.includes('--commit') || process.env.APPLY === '1';
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const jobs = await prisma.job.findMany({
    where: { status: 'ASSIGNED', acceptedQuoteId: { not: null } },
    select: {
      id: true,
      title: true,
      homeownerId: true,
      acceptedQuote: {
        select: {
          id: true,
          tradesmanId: true,
          amount: true,
          materialsAmount: true,
          depositRequested: true,
          calloutFee: true,
          currency: true,
        },
      },
    },
  });

  const plan: {
    jobId: string;
    title: string;
    homeownerId: string;
    quoteId: string;
    tradesmanId: string;
    currency: string;
    total: number;
    materials: number;
    deposit: number;
    balance: number;
  }[] = [];

  for (const job of jobs) {
    const q = job.acceptedQuote;
    if (!q) continue;

    const existing = await prisma.jobEscrow.findUnique({
      where: { jobId: job.id },
      select: { id: true },
    });
    if (existing) continue;

    const total = Number(q.amount);
    if (!(total > 0)) continue;

    const materials = q.materialsAmount ? Number(q.materialsAmount) : 0;
    const requestedDeposit = q.depositRequested
      ? Number(q.depositRequested)
      : 0;
    const callout = q.calloutFee ? Number(q.calloutFee) : 0;
    const deposit = Math.min(total, requestedDeposit || callout || total);
    const balance = round2(Math.max(0, total - deposit));

    plan.push({
      jobId: job.id,
      title: job.title,
      homeownerId: job.homeownerId,
      quoteId: q.id,
      tradesmanId: q.tradesmanId,
      currency: q.currency,
      total,
      materials,
      deposit,
      balance,
    });
  }

  if (plan.length === 0) {
    console.log('No assigned jobs need an escrow backfill.');
    return;
  }

  console.log(
    `${plan.length} assigned job(s) ${APPLY ? 'to backfill' : 'that would be backfilled'}:`,
  );
  for (const p of plan) {
    console.log(
      ` - "${p.title}" (job ${p.jobId}): total ${p.total} ${p.currency} -> deposit ${p.deposit}, balance ${p.balance}`,
    );
  }

  if (!APPLY) {
    console.log(
      '\nDry run. Re-run with `-- --commit` to create these escrows.',
    );
    return;
  }

  let created = 0;
  for (const p of plan) {
    await prisma.jobEscrow.create({
      data: {
        jobId: p.jobId,
        quoteId: p.quoteId,
        homeownerId: p.homeownerId,
        tradesmanId: p.tradesmanId,
        currency: p.currency,
        quoteTotal: p.total,
        materialsAmount: p.materials,
        depositAmount: p.deposit,
        balanceAmount: p.balance,
      },
    });
    created += 1;
  }
  console.log(`\nCreated ${created} escrow(s) in REQUESTED state.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
