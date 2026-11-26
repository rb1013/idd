// Monthly tutorial quota key ('YYYY-MM'), in California time.
//
// Edge functions run in UTC, so `new Date().toISOString().slice(0, 7)` rolled over to NEXT month at
// 4–5 pm on the last day of the month in California — a tutorial made on Nov 30 evening was charged
// to December, and a failed one could be refunded to the wrong month. Co-Heart is California-only,
// so the quota month follows America/Los_Angeles. The app uses the phone's local month (same thing
// for California users).

const QUOTA_TIME_ZONE = 'America/Los_Angeles';

/** 'YYYY-MM' of `date` (default: now) in California time. */
export function quotaMonth(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: QUOTA_TIME_ZONE, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const year  = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  return `${year}-${month}`;
}
