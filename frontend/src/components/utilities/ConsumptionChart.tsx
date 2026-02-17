import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface MeterReading {
  id: string;
  readingDate: string;
  value: number;
  consumption: number | null;
  unit: string;
}

interface ConsumptionChartProps {
  readings: MeterReading[];
  unit: string;
  meterType: string;
}

const BAR_COLORS: Record<string, string> = {
  STROM: '#f59e0b',
  GAS: '#f97316',
  WASSER_WARM: '#3b82f6',
};

export function ConsumptionChart({ readings, unit, meterType }: ConsumptionChartProps) {
  const chartData = useMemo(() => {
    return readings
      .filter((r) => r.consumption !== null)
      .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime())
      .map((r) => ({
        date: format(new Date(r.readingDate), 'dd.MM.yy'),
        fullDate: format(new Date(r.readingDate), 'dd.MM.yyyy'),
        consumption: r.consumption,
      }));
  }, [readings]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/50">
        <p>Noch nicht genug Daten f&uuml;r Verbrauchsdiagramm.</p>
      </div>
    );
  }

  const barColor = BAR_COLORS[meterType] || '#6366f1';
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#404040' : '#f3f4f6'} />
          <XAxis
            dataKey="date"
            tick={{ fill: isDark ? '#d1d5db' : '#9ca3af', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: isDark ? '#d1d5db' : '#9ca3af', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}`}
            label={{
              value: unit,
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 },
            }}
          />
          <Tooltip
            formatter={(val: number) => [`${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`, 'Verbrauch']}
            labelFormatter={(label, payload) => {
              const item = payload?.[0]?.payload;
              return item?.fullDate || label;
            }}
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              backgroundColor: isDark ? '#374151' : '#ffffff',
              color: isDark ? '#f3f4f6' : '#1f2937',
            }}
            cursor={{ fill: isDark ? '#1f2937' : '#f9fafb' }}
          />
          <Bar dataKey="consumption" fill={barColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
