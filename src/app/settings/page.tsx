import { getSettings } from '@/repository/settingsRepository';
import { getExpectedHoursOverrides } from '@/repository/expectedHoursOverrideRepository';
import Settings from './settings';
import ExpectedHoursOverrides from './expectedHoursOverrides';
import { assertExists } from '@/util/assertionFunctions';

export default async function SettingsPage() {
  const settings = await getSettings();
  assertExists(settings);
  const overrides = await getExpectedHoursOverrides();
  return (
    <div className="flex flex-col items-center">
      <Settings settings={settings} />
      <ExpectedHoursOverrides overrides={overrides} />
    </div>
  );
}
