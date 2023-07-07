import MiniCalendar from '@/app/components/miniCalendar';

export default function Home() {
  return (
    <div>
      <MiniCalendar />
      <div className="m-4">
        <h2 className="text-xl">Current balance</h2>
        <div>+25,00h (just a mock for now)</div>
      </div>
    </div>
  );
}
