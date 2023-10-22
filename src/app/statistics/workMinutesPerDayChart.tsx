'use client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

export const options = {
  responsive: true,
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
  },
};

export default function WorkMinutesPerDayChart({
  workMinutesPerDay,
}: {
  workMinutesPerDay: Map<string, number>;
}) {
  const workMinsSorted = new Map([...workMinutesPerDay].sort());

  console.log(workMinsSorted.keys());
  console.log(workMinsSorted.values());

  const data = {
    labels: Array.from(workMinsSorted.keys()),
    datasets: [
      {
        label: 'Work hours',
        data: Array.from(workMinsSorted.values()).map((min) => min / 60),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };
  return (
    <div className="pt-4 w-10/12">
      <Line options={options} data={data} />
    </div>
  );
}
