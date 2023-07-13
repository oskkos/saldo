import MiniCalendar from '@/app/components/miniCalendar';

export default function Home() {
  return (
    <div className="flex flex-wrap justify-center mt-4">
      <MiniCalendar date={new Date()} />
    </div>
  );
}
