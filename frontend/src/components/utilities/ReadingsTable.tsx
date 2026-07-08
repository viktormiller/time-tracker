import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Edit2, Trash2, ChevronUp, ChevronDown, Camera } from 'lucide-react';
import { PhotoLightbox } from './PhotoLightbox';

export interface MeterReading {
  id: string;
  meterId: string;
  readingDate: string;
  value: number;
  consumption: number | null;
  unit: string;
  photoPath: string | null;
  notes: string | null;
  createdAt: string;
}

interface ReadingsTableProps {
  readings: MeterReading[];
  loading: boolean;
  onEdit: (reading: MeterReading) => void;
  onDelete: (readingId: string) => void;
}

type SortField = 'readingDate' | 'value' | 'consumption';
type SortDirection = 'asc' | 'desc';

export function ReadingsTable({ readings, loading, onEdit, onDelete }: ReadingsTableProps) {
  const [sortField, setSortField] = useState<SortField>('readingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // Menu uses viewport (fixed) coordinates so the table's overflow container
  // can't clip it — for the last rows it flips upward instead
  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const MENU_WIDTH = 192; // w-48
  const MENU_HEIGHT = 84; // 2 Einträge + Padding

  const toggleMenu = (readingId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openMenu?.id === readingId) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const openUp = rect.bottom + MENU_HEIGHT + 8 > window.innerHeight;
    setOpenMenu({
      id: readingId,
      top: openUp ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
      left: rect.right - MENU_WIDTH,
    });
  };

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedReadings = [...readings].sort((a, b) => {
    let comparison = 0;

    if (sortField === 'readingDate') {
      comparison = new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime();
    } else if (sortField === 'value') {
      comparison = a.value - b.value;
    } else if (sortField === 'consumption') {
      const aConsumption = a.consumption ?? -Infinity;
      const bConsumption = b.consumption ?? -Infinity;
      comparison = aConsumption - bConsumption;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatValue = (value: number, unit: string) => {
    return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
  };

  const handleDeleteClick = (reading: MeterReading) => {
    if (confirm('Diese Ablesung wirklich löschen?')) {
      onDelete(reading.id);
    }
    setOpenMenu(null);
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp size={16} className="inline ml-1" />
    ) : (
      <ChevronDown size={16} className="inline ml-1" />
    );
  };

  if (loading) {
    return (
      <div>
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            </div>
          ))}
        </div>
        {/* Desktop skeleton */}
        <table className="w-full hidden md:table">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Zählerstand
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Verbrauch
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Notizen
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Foto
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {[1, 2, 3].map(i => (
              <tr key={i} className="animate-pulse">
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 ml-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (readings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">Noch keine Ablesungen vorhanden.</p>
        <p className="text-sm mt-2">Fügen Sie Ihre erste Ablesung hinzu, um den Verbrauch zu tracken.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile: card list (newest first per default sort) */}
      <div className="md:hidden space-y-3">
        {sortedReadings.map((reading) => (
          <div
            key={reading.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {format(new Date(reading.readingDate), 'dd.MM.yyyy')}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatValue(reading.value, reading.unit)}
                </p>
                {reading.consumption === null ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">Basislinie</p>
                ) : (
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    +{formatValue(reading.consumption, reading.unit)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {reading.photoPath && (
                  <button
                    onClick={() => setLightboxPhoto(reading.photoPath)}
                    className="rounded overflow-hidden mr-1"
                    aria-label="Foto anzeigen"
                  >
                    <img
                      src={reading.photoPath}
                      alt="Zählerstand"
                      className="w-12 h-12 object-cover rounded"
                    />
                  </button>
                )}
                <button
                  onClick={() => onEdit(reading)}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                  aria-label="Bearbeiten"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDeleteClick(reading)}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  aria-label="Löschen"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            {reading.notes && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 break-words">{reading.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: sortable table */}
      <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th
              onClick={() => handleSort('readingDate')}
              className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Datum
              <SortIndicator field="readingDate" />
            </th>
            <th
              onClick={() => handleSort('value')}
              className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Zählerstand
              <SortIndicator field="value" />
            </th>
            <th
              onClick={() => handleSort('consumption')}
              className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Verbrauch
              <SortIndicator field="consumption" />
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Notizen
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Foto
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedReadings.map((reading, index) => (
            <tr
              key={reading.id}
              className={`${
                index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
              } hover:bg-gray-100 dark:hover:bg-gray-700 transition`}
            >
              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                {format(new Date(reading.readingDate), 'dd.MM.yyyy')}
              </td>
              <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatValue(reading.value, reading.unit)}
              </td>
              <td className="px-4 py-4 text-sm">
                {reading.consumption === null ? (
                  <span className="text-gray-500 dark:text-gray-400 italic">Basislinie</span>
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {formatValue(reading.consumption, reading.unit)}
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                {reading.notes ? (
                  <span className="truncate block max-w-xs" title={reading.notes}>
                    {reading.notes}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">-</span>
                )}
              </td>
              <td className="px-4 py-4 text-center">
                {reading.photoPath ? (
                  <button
                    onClick={() => setLightboxPhoto(reading.photoPath)}
                    className="inline-block rounded overflow-hidden hover:ring-2 hover:ring-indigo-500 transition"
                  >
                    <img
                      src={reading.photoPath}
                      alt="Zählerstand"
                      className="w-10 h-10 object-cover rounded"
                    />
                  </button>
                ) : (
                  <Camera size={18} className="text-gray-300 dark:text-gray-600 mx-auto" />
                )}
              </td>
              <td className="px-4 py-4 text-right">
                <button
                  onClick={(e) => toggleMenu(reading.id, e)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition"
                >
                  <MoreVertical size={18} className="text-gray-600 dark:text-gray-400" />
                </button>

                {openMenu?.id === reading.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenu(null)}
                    />
                    <div
                      className="fixed w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20"
                      style={{ top: openMenu.top, left: openMenu.left }}
                    >
                      <button
                        onClick={() => {
                          onEdit(reading);
                          setOpenMenu(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                      >
                        <Edit2 size={16} />
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDeleteClick(reading)}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Löschen
                      </button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {lightboxPhoto && (
        <PhotoLightbox
          photoPath={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
}
