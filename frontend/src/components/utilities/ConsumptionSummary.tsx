import { useState, useEffect } from 'react';
import axios from 'axios';
import { Euro } from 'lucide-react';

interface PeriodStats {
  consumption: number;
  cost: number | null;
  pricedConsumption: number;
  co2Kg: number | null;
}

interface SummaryResponse {
  unit: string;
  hasPrices: boolean;
  asOf: string;
  periods: {
    currentYear: PeriodStats;
    previousYearSamePeriod: PeriodStats;
    previousYearTotal: PeriodStats;
    rolling12m: PeriodStats;
    priorRolling12m: PeriodStats;
  };
}

interface ConsumptionSummaryProps {
  meterType: string;
  propertyId: string | null;
  refreshKey?: number;
  onManagePrices?: () => void;
}

const fmtNum = (n: number) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: n < 100 ? 1 : 0 });
const fmtEur = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Percent change vs. a previous value; null when there is no baseline. */
function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** For consumption, less is better: falling numbers are green. */
function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const color =
    delta < 0
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : delta > 0
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {delta > 0 ? '+' : ''}{delta}%
    </span>
  );
}

function StatCard({
  title,
  value,
  delta,
  subtitle,
}: {
  title: string;
  value: string;
  delta?: number | null;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>
      {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
}

export function ConsumptionSummary({ meterType, propertyId, refreshKey, onManagePrices }: ConsumptionSummaryProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ type: meterType });
    if (propertyId) params.set('propertyId', propertyId);
    axios
      .get<SummaryResponse>(`/api/utilities/consumption/summary?${params.toString()}`)
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null));
  }, [meterType, propertyId, refreshKey]);

  if (!summary) return null;

  const { unit, hasPrices, asOf, periods } = summary;
  const { currentYear, previousYearSamePeriod, rolling12m, priorRolling12m } = periods;

  // Nothing measured yet — no cards
  if (currentYear.consumption === 0 && rolling12m.consumption === 0 && priorRolling12m.consumption === 0) {
    return null;
  }

  const asOfLabel = new Date(asOf).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const showCo2 = currentYear.co2Kg !== null;

  return (
    <div className={`grid grid-cols-2 ${showCo2 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4 mb-6`}>
      <StatCard
        title="Dieses Jahr"
        value={`${fmtNum(currentYear.consumption)} ${unit}`}
        delta={percentChange(currentYear.consumption, previousYearSamePeriod.consumption)}
        subtitle={
          previousYearSamePeriod.consumption > 0
            ? `Vorjahr bis ${asOfLabel}: ${fmtNum(previousYearSamePeriod.consumption)} ${unit}`
            : undefined
        }
      />
      <StatCard
        title="Letzte 12 Monate"
        value={`${fmtNum(rolling12m.consumption)} ${unit}`}
        delta={percentChange(rolling12m.consumption, priorRolling12m.consumption)}
        subtitle={
          priorRolling12m.consumption > 0
            ? `12 Monate davor: ${fmtNum(priorRolling12m.consumption)} ${unit}`
            : undefined
        }
      />
      {hasPrices && currentYear.cost !== null ? (
        <StatCard
          title="Kosten dieses Jahr"
          value={`≈ ${fmtEur(currentYear.cost)}`}
          delta={
            previousYearSamePeriod.cost !== null
              ? percentChange(currentYear.cost, previousYearSamePeriod.cost)
              : null
          }
          subtitle={
            currentYear.pricedConsumption < currentYear.consumption * 0.99
              ? `Preis deckt nur ${fmtNum(currentYear.pricedConsumption)} von ${fmtNum(currentYear.consumption)} ${unit}`
              : previousYearSamePeriod.cost !== null
                ? `Vorjahr bis ${asOfLabel}: ${fmtEur(previousYearSamePeriod.cost)}`
                : undefined
          }
        />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 flex flex-col items-start justify-center">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kosten</p>
          {onManagePrices ? (
            <button
              onClick={onManagePrices}
              className="mt-1 flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <Euro size={14} />
              Preis hinterlegen
            </button>
          ) : (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Kein Preis hinterlegt</p>
          )}
        </div>
      )}
      {showCo2 && (
        <StatCard
          title="CO₂ dieses Jahr"
          value={`≈ ${fmtNum(currentYear.co2Kg!)} kg`}
          delta={
            previousYearSamePeriod.co2Kg !== null
              ? percentChange(currentYear.co2Kg!, previousYearSamePeriod.co2Kg)
              : null
          }
          subtitle={
            previousYearSamePeriod.co2Kg !== null && previousYearSamePeriod.co2Kg > 0
              ? `Vorjahr bis ${asOfLabel}: ${fmtNum(previousYearSamePeriod.co2Kg)} kg`
              : undefined
          }
        />
      )}
    </div>
  );
}
