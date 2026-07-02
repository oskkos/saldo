import { calculateCurrentSaldo } from '@/services';
import { getExpectedHoursOverrides } from '@/repository/expectedHoursOverrideRepository';
import { Settings, Worklog } from '@/types';

export default async function SaldoBadge({
  settings,
  worklogs,
}: {
  settings: Settings;
  worklogs: Worklog[];
}) {
  const overrides = await getExpectedHoursOverrides();
  return calculateCurrentSaldo(settings, worklogs, overrides).toBadge(
    'badge-lg',
  );
}
