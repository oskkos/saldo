'use client';
import { Line } from 'react-chartjs-2';
import { Chart } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';

import { toDayMonthYear } from '@/util/dateFormatter';
import { TooltipItem } from 'chart.js/auto';

Chart.register(zoomPlugin);

export const options = {
  responsive: true,
  maintainAspectRatio: false,

  plugins: {
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      callbacks: {
        title: function (x: TooltipItem<'line'>[]) {
          return toDayMonthYear(new Date(x[0].parsed.x));
        },
      },
    },
    zoom: {
      zoom: {
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: true,
        },
        mode: 'xy' as const,
      },
      pan: {
        enabled: true,
        mode: 'xy' as const,
      },
    },
  },
  scales: {
    x: {
      type: 'time' as const,
      time: {
        unit: 'day' as const,
        displayFormats: {
          day: 'D.M.YYYY',
        },
      },
    },
  },
};

export default function WorkMinutesPerDayChart({
  workMinutesPerDay,
}: {
  workMinutesPerDay: Map<string, number>;
}) {
  const workMinsSorted = new Map([...workMinutesPerDay].sort());

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
    <div className="pt-4 w-10/12 h-96">
      <Line options={options} data={data} />
    </div>
  );
}
