import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, CheckCircle, XCircle, Database, Clock, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { getHourLimits, setHourLimits } from '../lib/hour-limits';

const API_URL = '/api';

interface ProviderStatus {
  name: string;
  configured: boolean;
  entryCount: number;
  lastSync: string | null;
}

interface SettingsProps {
  onBack: () => void;
  onLimitsChanged?: () => void;
}

export function Settings({ onBack, onLimitsChanged }: SettingsProps) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hour limits state
  const [dailyLimitInput, setDailyLimitInput] = useState<string>('');
  const [weeklyLimitInput, setWeeklyLimitInput] = useState<string>('');

  useEffect(() => {
    const limits = getHourLimits();
    setDailyLimitInput(limits.dailyLimit !== null ? String(limits.dailyLimit) : '');
    setWeeklyLimitInput(limits.weeklyLimit !== null ? String(limits.weeklyLimit) : '');
  }, []);

  const handleSaveLimits = () => {
    setHourLimits({
      dailyLimit: dailyLimitInput !== '' ? parseFloat(dailyLimitInput) : null,
      weeklyLimit: weeklyLimitInput !== '' ? parseFloat(weeklyLimitInput) : null,
    });
    onLimitsChanged?.();
  };

  useEffect(() => {
    fetchProviderStatus();
  }, []);

  const fetchProviderStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<{ providers: ProviderStatus[] }>(`${API_URL}/providers/status`);
      setProviders(response.data.providers);
    } catch (err) {
      console.error('Failed to fetch provider status:', err);
      setError('Failed to load provider status');
    } finally {
      setLoading(false);
    }
  };

  const getProviderColor = (name: string) => {
    switch (name) {
      case 'TOGGL':
        return 'pink';
      case 'TEMPO':
        return 'blue';
      case 'MANUAL':
        return 'purple';
      default:
        return 'gray';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
            title="Back to dashboard"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        {/* Hour Limits Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">Stundenziele</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tageslimit (h)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={dailyLimitInput}
                onChange={e => setDailyLimitInput(e.target.value)}
                placeholder="z.B. 8"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm p-2.5 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wochenlimit (h)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={weeklyLimitInput}
                onChange={e => setWeeklyLimitInput(e.target.value)}
                placeholder="z.B. 40"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm p-2.5 border"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Leer lassen um das jeweilige Ziel zu deaktivieren.
          </p>
          <div className="flex justify-end">
            <button
              onClick={handleSaveLimits}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
            >
              <Save size={16} />
              Speichern
            </button>
          </div>
        </div>

        {/* Provider Status Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Provider Status</h2>
            <button
              onClick={fetchProviderStatus}
              disabled={loading}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-600 dark:text-red-400">
              <XCircle size={20} className="mr-2" />
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((provider) => {
                const color = getProviderColor(provider.name);
                return (
                  <div
                    key={provider.name}
                    className={`p-5 rounded-lg border-2 ${
                      provider.configured
                        ? `border-${color}-200 dark:border-${color}-800 bg-${color}-50 dark:bg-${color}-900/20`
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                    }`}
                  >
                    {/* Provider Name */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg font-bold ${
                        provider.configured
                          ? `text-${color}-700 dark:text-${color}-300`
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {provider.name}
                      </h3>
                      {provider.configured ? (
                        <CheckCircle size={20} className={`text-${color}-600 dark:text-${color}-400`} />
                      ) : (
                        <XCircle size={20} className="text-gray-400 dark:text-gray-500" />
                      )}
                    </div>

                    {/* Status Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Database size={16} className="text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">{provider.entryCount}</span> entries
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} className="text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">
                          Last sync:{' '}
                          {provider.lastSync
                            ? format(new Date(provider.lastSync), 'PPp')
                            : 'Never'}
                        </span>
                      </div>

                      {!provider.configured && provider.name !== 'MANUAL' && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Configure API token in .env file
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">About Providers</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li><strong>Toggl:</strong> Time tracking from Toggl Track API</li>
            <li><strong>Tempo:</strong> Time tracking from Tempo (Jira) API</li>
            <li><strong>Manual:</strong> Manually entered time entries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
