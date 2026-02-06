import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface Meter {
  id: string;
  type: string;
  name: string;
  unit: string;
  location: string | null;
}

interface MeterFormProps {
  meter?: Meter | null;
  onClose: () => void;
  onSave: () => void;
}

const METER_TYPES = [
  { value: 'STROM', label: 'Strom', unit: 'kWh' },
  { value: 'GAS', label: 'Gas', unit: 'm³' },
  { value: 'WASSER_WARM', label: 'Wasser Warm', unit: 'm³' },
];

export function MeterForm({ meter, onClose, onSave }: MeterFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: meter?.type || 'STROM',
    name: meter?.name || '',
    location: meter?.location || '',
  });

  // Auto-fill unit based on type
  const selectedMeterType = METER_TYPES.find(t => t.value === formData.type);
  const unit = selectedMeterType?.unit || '';

  useEffect(() => {
    if (meter) {
      setFormData({
        type: meter.type,
        name: meter.name,
        location: meter.location || '',
      });
    }
  }, [meter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: formData.type,
        name: formData.name.trim(),
        unit,
        location: formData.location.trim() || null,
      };

      if (meter) {
        // Edit mode
        await axios.put(`/api/utilities/meters/${meter.id}`, {
          name: payload.name,
          location: payload.location,
        });
        toast.success('Zähler aktualisiert');
      } else {
        // Create mode
        await axios.post('/api/utilities/meters', payload);
        toast.success('Zähler erstellt');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save meter:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {meter ? 'Zähler bearbeiten' : 'Neuer Zähler'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            type="button"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Typ *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              disabled={!!meter}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
            >
              {METER_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {meter && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Der Typ kann nach dem Erstellen nicht mehr geändert werden
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="z.B. Hauptzähler Keller"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              required
            />
          </div>

          {/* Unit (read-only, auto-filled) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Einheit
            </label>
            <input
              type="text"
              value={unit}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white cursor-not-allowed"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Standort
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="z.B. Keller, Hauswirtschaftsraum"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {meter ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
