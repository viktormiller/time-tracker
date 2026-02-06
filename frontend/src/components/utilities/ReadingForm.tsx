import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface Meter {
  id: string;
  type: string;
  name: string;
  unit: string;
}

interface MeterReading {
  id: string;
  meterId: string;
  readingDate: string;
  value: number;
  notes: string | null;
}

interface ReadingFormProps {
  reading?: MeterReading | null;
  meters: Meter[];
  selectedMeterId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function ReadingForm({ reading, meters, selectedMeterId, onClose, onSave }: ReadingFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    meterId: reading?.meterId || selectedMeterId || (meters[0]?.id || ''),
    readingDate: reading?.readingDate || new Date().toISOString().split('T')[0],
    value: reading?.value || 0,
    notes: reading?.notes || '',
  });

  useEffect(() => {
    if (reading) {
      setFormData({
        meterId: reading.meterId,
        readingDate: reading.readingDate,
        value: reading.value,
        notes: reading.notes || '',
      });
    }
  }, [reading]);

  const selectedMeter = meters.find(m => m.id === formData.meterId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.meterId) {
      toast.error('Bitte wählen Sie einen Zähler aus');
      return;
    }

    if (!formData.value || formData.value <= 0) {
      toast.error('Bitte geben Sie einen gültigen Zählerstand ein');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        meterId: formData.meterId,
        readingDate: formData.readingDate,
        value: Number(formData.value),
        notes: formData.notes.trim() || null,
      };

      if (reading) {
        // Edit mode
        await axios.put(`/api/utilities/readings/${reading.id}`, {
          readingDate: payload.readingDate,
          value: payload.value,
          notes: payload.notes,
        });
        toast.success('Ablesung aktualisiert');
      } else {
        // Create mode
        await axios.post('/api/utilities/readings', payload);
        toast.success('Ablesung erstellt');
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Failed to save reading:', err);

      // Handle monotonic validation error
      if (err.response?.status === 400 && err.response?.data?.error) {
        const errorMessage = err.response.data.error;
        setValidationError(errorMessage);
        toast.error('Ungültige Ablesung');
      } else {
        toast.error('Fehler beim Speichern');
      }
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
            {reading ? 'Ablesung bearbeiten' : 'Neue Ablesung'}
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
          {/* Meter Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Zähler *
            </label>
            <select
              value={formData.meterId}
              onChange={(e) => setFormData({ ...formData, meterId: e.target.value })}
              disabled={!!reading}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              required
            >
              {meters.map(meter => (
                <option key={meter.id} value={meter.id}>
                  {meter.name} ({meter.type})
                </option>
              ))}
            </select>
            {reading && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Der Zähler kann nach dem Erstellen nicht mehr geändert werden
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Datum *
            </label>
            <input
              type="date"
              value={formData.readingDate}
              onChange={(e) => setFormData({ ...formData, readingDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              required
            />
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Zählerstand *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.value}
              onChange={(e) => {
                setFormData({ ...formData, value: Number(e.target.value) });
                setValidationError(null); // Clear validation error when user edits
              }}
              placeholder={selectedMeter ? `Wert in ${selectedMeter.unit}` : 'Wert'}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              required
            />
            {validationError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <span className="font-medium">⚠</span>
                <span>{validationError}</span>
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notizen
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optionale Notizen..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent resize-none"
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
              {reading ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
