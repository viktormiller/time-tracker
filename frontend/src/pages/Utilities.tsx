import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { EmptyState } from '../components/utilities/EmptyState';
import { MeterTabs } from '../components/utilities/MeterTabs';

interface UtilitiesProps {
  onBack: () => void;
}

interface Meter {
  id: string;
  type: string;
  name: string;
  unit: string;
  location: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// MeterReading interface will be used in Plan 04 for readings table
export interface MeterReading {
  id: string;
  readingDate: string;
  value: number;
  consumption: number | null;
  unit: string;
  photoPath: string | null;
  notes: string | null;
  createdAt: string;
}

export function Utilities({ onBack }: UtilitiesProps) {
  // State management (setMeters and setLoading will be used in Plan 04 for API integration)
  const [meters] = useState<Meter[]>([]);
  const [activeTab, setActiveTab] = useState('STROM');
  const [loading] = useState(false);
  const [showMeterForm, setShowMeterForm] = useState(false);

  // Calculate meter counts by type
  const meterCounts = {
    STROM: meters.filter(m => m.type === 'STROM' && !m.deletedAt).length,
    GAS: meters.filter(m => m.type === 'GAS' && !m.deletedAt).length,
    WASSER_WARM: meters.filter(m => m.type === 'WASSER_WARM' && !m.deletedAt).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
              title="Zurück zum Dashboard"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verbrauch</h1>
          </div>
          {meters.length > 0 && (
            <button
              onClick={() => setShowMeterForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg transition font-medium shadow-sm"
            >
              <Plus size={20} />
              Neuer Zähler
            </button>
          )}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {meters.length === 0 && !loading ? (
            <EmptyState onCreateMeter={() => setShowMeterForm(true)} />
          ) : (
            <>
              {/* Tabs */}
              <MeterTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                meterCounts={meterCounts}
              />

              {/* Content area - placeholder for Plan 04 */}
              <div className="p-8">
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-lg font-medium">Zählerablesungen werden hier angezeigt</p>
                  <p className="text-sm mt-2">Placeholder für Plan 04</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal placeholder - functionality comes in Plan 04 */}
      {showMeterForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Neuer Zähler
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Formular wird in Plan 04 implementiert.
            </p>
            <button
              onClick={() => setShowMeterForm(false)}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
