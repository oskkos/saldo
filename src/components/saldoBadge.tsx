import { calculateCurrentSaldo } from '@/services';
import { Settings, Worklog } from '@/types';

export default function SaldoBadge({
  settings,
  worklogs,
}: {
  settings: Settings;
  worklogs: Worklog[];
}) {
  return calculateCurrentSaldo(settings, worklogs).toBadge('badge-lg');
}
