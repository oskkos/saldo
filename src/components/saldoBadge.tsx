import { calculateCurrentSaldo } from '@/services';
import { getExpectedHoursOverrides } from '@/repository/expectedHoursOverrideRepository';
import { Settings, Worklog } from '@/types';
import * as Sentry from '@sentry/nextjs';

export default async function SaldoBadge({
  settings,
  worklogs,
}: {
  settings: Settings;
  worklogs: Worklog[];
}) {
  const overrides = await getExpectedHoursOverrides();
  // Span the saldo computation (beginDate→today accrual) so its render cost is
  // attributed in traces — this is where the O(days) holiday work lived.
  const saldo = Sentry.startSpan(
    { name: 'calculateCurrentSaldo', op: 'function' },
    () => calculateCurrentSaldo(settings, worklogs, overrides),
  );
  return saldo.toBadge('badge-lg');
}
