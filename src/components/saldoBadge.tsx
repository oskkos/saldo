import { calculateCurrentSaldo } from '@/services';
import { Settings, Worklog } from '@prisma/client';

export default function SaldoBadge({
  settings,
  worklogs,
}: {
  settings: Settings | null;
  worklogs: Worklog[];
}) {
  return settings
    ? calculateCurrentSaldo(settings, worklogs).toBadge('badge-lg')
    : null;
}
