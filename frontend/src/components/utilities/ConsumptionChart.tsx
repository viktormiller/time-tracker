import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface MonthlyEntry {
  year: number;
  month: number;
  consumption: number;
}

interface ConsumptionResponse {
  unit: string;
  data: MonthlyEntry[];
}

interface ConsumptionChartProps {
  meterType: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const YEAR_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4'];

const TYPE_LABELS: Record<string, string> = {
  STROM: 'Stromverbrauch',
  GAS: 'Gasverbrauch',
  WASSER_WARM: 'Warmwasserverbrauch',
};

export function ConsumptionChart({ meterType }: ConsumptionChartProps) {
  const [data, setData] = useState<MonthlyEntry[]>([]);
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get<ConsumptionResponse>(`/api/utilities/consumption/monthly?type=${meterType}`)
      .then((res) => {
        setData(res.data.data);
        setUnit(res.data.unit);
      })
      .catch(() => {
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [meterType]);

  const { chartData, years } = useMemo(() => {
    if (data.length === 0) return { chartData: [], years: [] };

    const yearsSet = new Set(data.map(d => d.year));
    const sortedYears = Array.from(yearsSet).sort();

    const rows = MONTH_LABELS.map((label, monthIdx) => {
      const row: Record<string, string | number> = { month: label };
      for (const year of sortedYears) {
        const entry = data.find(d => d.year === year && d.month === monthIdx);
        if (entry) row[String(year)] = entry.consumption;
      }
      return row;
    });

    return { chartData: rows, years: sortedYears };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-400 dark:text-gray-500">
        <div className="animate-pulse">Lade Verbrauchsdaten...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/50">
        <p>Noch nicht genug Daten f&uuml;r Verbrauchsdiagramm.</p>
      </div>
    );
  }

  const isDark = document.documentElement.classList.contains('dark');
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const title = `${TYPE_LABELS[meterType] || 'Verbrauch'} (${minYear}${minYear !== maxYear ? `–${maxYear}` : ''})`;

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h4>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#404040' : '#f3f4f6'} />
            <XAxis
              dataKey="month"
              tick={{ fill: isDark ? '#d1d5db' : '#9ca3af', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: isDark ? '#d1d5db' : '#9ca3af', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: unit,
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 },
              }}
            />
            <Tooltip
              formatter={(val: number, name: string) => [
                `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`,
                name,
              ]}
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: isDark ? '#374151' : '#ffffff',
                color: isDark ? '#f3f4f6' : '#1f2937',
              }}
              cursor={{ fill: isDark ? '#1f2937' : '#f9fafb' }}
            />
            <Legend />
            {years.map((year, i) => (
              <Bar
                key={year}
                dataKey={String(year)}
                fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
