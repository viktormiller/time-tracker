import { Zap, Flame, Droplets } from 'lucide-react';

interface MeterTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  meterCounts: { STROM: number; GAS: number; WASSER_WARM: number };
}

const METER_TYPES = [
  { key: 'STROM', label: 'Strom', icon: Zap },
  { key: 'GAS', label: 'Gas', icon: Flame },
  { key: 'WASSER_WARM', label: 'Wasser Warm', icon: Droplets },
] as const;

export function MeterTabs({ activeTab, onTabChange, meterCounts }: MeterTabsProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-1">
        {METER_TYPES.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          const count = meterCounts[key];

          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors relative ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {count}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
