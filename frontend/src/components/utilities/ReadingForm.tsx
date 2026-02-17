import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Loader2, Camera, Trash2, Plus, Minus } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

function formatDE(value: number): string {
  return value.toLocaleString('de-DE');
}

function parseDE(text: string): number {
  // Remove dots (thousands separators), replace comma with dot (decimal separator)
  const cleaned = text.replace(/\./g, '').replace(',', '.');
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

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
  photoPath: string | null;
  notes: string | null;
}

interface ReadingFormProps {
  reading?: MeterReading | null;
  meters: Meter[];
  selectedMeterId?: string;
  onClose: () => void;
  onSave: () => void;
}

async function uploadPhoto(readingId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post(`/api/utilities/readings/${readingId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.photoPath;
}

export function ReadingForm({ reading, meters, selectedMeterId, onClose, onSave }: ReadingFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(reading?.photoPath || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    meterId: reading?.meterId || selectedMeterId || (meters[0]?.id || ''),
    readingDate: reading?.readingDate || new Date().toISOString().split('T')[0],
    value: reading?.value || 0,
    notes: reading?.notes || '',
  });
  const [valueDisplay, setValueDisplay] = useState(() => formatDE(reading?.value || 0));
  const [valueFocused, setValueFocused] = useState(false);

  useEffect(() => {
    if (reading) {
      setFormData({
        meterId: reading.meterId,
        readingDate: reading.readingDate.split('T')[0],
        value: reading.value,
        notes: reading.notes || '',
      });
      setValueDisplay(formatDE(reading.value));
      setPhotoPreview(reading.photoPath || null);
    }
  }, [reading]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const selectedMeter = meters.find(m => m.id === formData.meterId);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke old preview if it was an object URL
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    // In edit mode, upload immediately since we have the reading ID
    if (reading) {
      try {
        await uploadPhoto(reading.id, file);
        toast.success('Foto hochgeladen');
        onSave();
      } catch {
        toast.error('Fehler beim Hochladen des Fotos');
      }
    }
  };

  const handleRemovePhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.meterId) {
      toast.error('Bitte wählen Sie einen Zähler aus');
      return;
    }

    if (formData.value < 0) {
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
        const res = await axios.post('/api/utilities/readings', payload);
        const newReadingId = res.data.id;

        // Upload photo if selected
        if (photoFile && newReadingId) {
          try {
            await uploadPhoto(newReadingId, photoFile);
          } catch {
            toast.error('Ablesung erstellt, aber Foto-Upload fehlgeschlagen');
          }
        }

        toast.success('Ablesung erstellt');
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Failed to save reading:', err);

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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
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
            <div className="flex items-stretch gap-0">
              <button
                type="button"
                onClick={() => {
                  const newVal = formData.value - 1;
                  setFormData({ ...formData, value: newVal });
                  setValueDisplay(formatDE(newVal));
                  setValidationError(null);
                }}
                className="px-3 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500 transition"
              >
                <Minus size={16} />
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={valueFocused ? valueDisplay : formatDE(formData.value)}
                onFocus={() => {
                  setValueFocused(true);
                  setValueDisplay(String(formData.value));
                }}
                onBlur={() => {
                  const parsed = parseDE(valueDisplay);
                  setFormData({ ...formData, value: parsed });
                  setValueDisplay(formatDE(parsed));
                  setValueFocused(false);
                }}
                onChange={(e) => {
                  setValueDisplay(e.target.value);
                  setValidationError(null);
                }}
                placeholder={selectedMeter ? `Wert in ${selectedMeter.unit}` : 'Wert'}
                className="flex-1 min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent text-center"
                required
              />
              <button
                type="button"
                onClick={() => {
                  const newVal = formData.value + 1;
                  setFormData({ ...formData, value: newVal });
                  setValueDisplay(formatDE(newVal));
                  setValidationError(null);
                }}
                className="px-3 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500 transition"
              >
                <Plus size={16} />
              </button>
            </div>
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

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Foto
            </label>
            {photoPreview ? (
              <div className="relative inline-block">
                <img
                  src={photoPreview}
                  alt="Vorschau"
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition"
              >
                <Camera size={16} />
                Foto hinzufügen
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            {photoPreview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Foto ersetzen
              </button>
            )}
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
