import MiniCalendar from '@/app/components/miniCalendar';

export default function Home() {
  return (
    <div className="flex flex-wrap justify-center mt-3">
      <MiniCalendar />
      <div className="ml-4">
        <h2 className="text-xl">Current balance</h2>
        <div>+25,00h (mock for now)</div>
      </div>
    </div>
  );
}
