import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Plus, MoreVertical, Edit2, Archive } from 'lucide-react';
import { EmptyState } from '../components/utilities/EmptyState';
import { MeterTabs } from '../components/utilities/MeterTabs';
import { MeterForm } from '../components/utilities/MeterForm';
import { ReadingForm } from '../components/utilities/ReadingForm';
import { ReadingsTable } from '../components/utilities/ReadingsTable';
import { ConsumptionChart } from '../components/utilities/ConsumptionChart';
import { PropertySelector, type Property } from '../components/utilities/PropertySelector';
import { PropertyForm } from '../components/utilities/PropertyForm';
import { useToast } from '../hooks/useToast';

interface UtilitiesProps {
  onBack: () => void;
}

interface Meter {
  id: string;
  type: string;
  name: string;
  unit: string;
  location: string | null;
  propertyId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export function Utilities({ onBack }: UtilitiesProps) {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [activeTab, setActiveTab] = useState('STROM');
  const [loading, setLoading] = useState(true);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [showMeterForm, setShowMeterForm] = useState(false);
  const [showReadingForm, setShowReadingForm] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [editingReading, setEditingReading] = useState<MeterReading | null>(null);
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null);
  const [openMeterMenuId, setOpenMeterMenuId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // API functions
  const fetchProperties = async () => {
    try {
      const response = await axios.get<Property[]>('/api/utilities/properties');
      setProperties(response.data);

      // Auto-select first active property if none selected
      if (!selectedPropertyId && response.data.length > 0) {
        const firstActive = response.data.find(p => !p.movedOut) || response.data[0];
        setSelectedPropertyId(firstActive.id);
      }

      return response.data;
    } catch (err) {
      console.error('Failed to fetch properties:', err);
      toast.error('Fehler beim Laden der Wohnungen');
      return [];
    }
  };

  const fetchMeters = async (propertyId?: string) => {
    setLoading(true);
    try {
      const pid = propertyId || selectedPropertyId;
      const params = new URLSearchParams();
      if (showArchived) params.set('includeArchived', 'true');
      if (pid) params.set('propertyId', pid);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const response = await axios.get<Meter[]>(`/api/utilities/meters${queryStr}`);
      setMeters(response.data);

      // Auto-select first meter of active tab
      const activeMeters = response.data.filter(m => !m.deletedAt);
      const metersOfType = activeMeters.filter(m => m.type === activeTab);
      if (metersOfType.length > 0) {
        const firstMeter = metersOfType[0];
        setSelectedMeterId(firstMeter.id);
        await fetchReadings(firstMeter.id);
      } else {
        setSelectedMeterId(null);
        setReadings([]);
      }
    } catch (err) {
      console.error('Failed to fetch meters:', err);
      toast.error('Fehler beim Laden der Zähler');
    } finally {
      setLoading(false);
    }
  };

  const fetchReadings = async (meterId: string) => {
    setReadingsLoading(true);
    try {
      const response = await axios.get<MeterReading[]>(`/api/utilities/meters/${meterId}/readings`);
      setReadings(response.data);
    } catch (err) {
      console.error('Failed to fetch readings:', err);
      toast.error('Fehler beim Laden der Ablesungen');
    } finally {
      setReadingsLoading(false);
    }
  };

  const deleteMeter = async (id: string) => {
    if (!confirm('Dieser Zähler wird archiviert. Alle Ablesungen bleiben erhalten.')) {
      return;
    }

    try {
      await axios.delete(`/api/utilities/meters/${id}`);
      toast.success('Zähler archiviert');
      await fetchMeters();
      setSelectedMeterId(null);
      setReadings([]);
    } catch (err) {
      console.error('Failed to delete meter:', err);
      toast.error('Fehler beim Archivieren');
    }
  };

  const restoreMeter = async (id: string) => {
    try {
      await axios.patch(`/api/utilities/meters/${id}/restore`);
      toast.success('Zähler wiederhergestellt');
      await fetchMeters();
    } catch (err) {
      console.error('Failed to restore meter:', err);
      toast.error('Fehler beim Wiederherstellen');
    }
  };

  const deleteReading = async (id: string) => {
    try {
      await axios.delete(`/api/utilities/readings/${id}`);
      toast.success('Ablesung gelöscht');
      if (selectedMeterId) {
        await fetchReadings(selectedMeterId);
      }
    } catch (err) {
      console.error('Failed to delete reading:', err);
      toast.error('Fehler beim Löschen');
    }
  };

  // Effects
  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchMeters(selectedPropertyId);
    }
  }, [selectedPropertyId, showArchived]);

  useEffect(() => {
    const metersOfType = meters.filter(m => m.type === activeTab);
    if (metersOfType.length > 0) {
      const firstMeter = metersOfType[0];
      setSelectedMeterId(firstMeter.id);
      fetchReadings(firstMeter.id);
    } else {
      setSelectedMeterId(null);
      setReadings([]);
    }
  }, [activeTab]);

  // Calculate meter counts by type (only active meters)
  const meterCounts = {
    STROM: meters.filter(m => m.type === 'STROM' && !m.deletedAt).length,
    GAS: meters.filter(m => m.type === 'GAS' && !m.deletedAt).length,
    WASSER_WARM: meters.filter(m => m.type === 'WASSER_WARM' && !m.deletedAt).length,
  };

  // Get selected meter
  const selectedMeter = meters.find(m => m.id === selectedMeterId);

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
            {properties.length > 0 && (
              <PropertySelector
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                onSelect={setSelectedPropertyId}
                onCreateNew={() => setShowPropertyForm(true)}
                onEdit={(p) => { setEditingProperty(p); setShowPropertyForm(true); }}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            {meters.length > 0 && (
              <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                Archivierte anzeigen
              </label>
            )}
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

              {/* Meter action bar */}
              {selectedMeter && (
                <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className={`text-lg font-semibold ${selectedMeter.deletedAt ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                      {selectedMeter.name}
                    </h3>
                    {selectedMeter.deletedAt && (
                      <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded">
                        Archiviert
                      </span>
                    )}
                    {selectedMeter.location && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({selectedMeter.location})
                      </span>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMeterMenuId(openMeterMenuId === selectedMeter.id ? null : selectedMeter.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                      >
                        <MoreVertical size={18} className="text-gray-600 dark:text-gray-400" />
                      </button>

                      {openMeterMenuId === selectedMeter.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMeterMenuId(null)}
                          />
                          <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20">
                            {!selectedMeter.deletedAt && (
                              <button
                                onClick={() => {
                                  setEditingMeter(selectedMeter);
                                  setShowMeterForm(true);
                                  setOpenMeterMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                              >
                                <Edit2 size={16} />
                                Bearbeiten
                              </button>
                            )}
                            {selectedMeter.deletedAt ? (
                              <button
                                onClick={() => {
                                  restoreMeter(selectedMeter.id);
                                  setOpenMeterMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"
                              >
                                <Archive size={16} />
                                Wiederherstellen
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  deleteMeter(selectedMeter.id);
                                  setOpenMeterMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <Archive size={16} />
                                Archivieren
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {!selectedMeter.deletedAt && (
                    <button
                      onClick={() => setShowReadingForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg transition font-medium shadow-sm"
                    >
                      <Plus size={18} />
                      Ablesung hinzufügen
                    </button>
                  )}
                </div>
              )}

              {/* Consumption chart */}
              {selectedMeter && readings.length >= 2 && !readingsLoading && (
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Verbrauch
                  </h4>
                  <ConsumptionChart
                    readings={readings}
                    unit={selectedMeter.unit}
                    meterType={selectedMeter.type}
                  />
                </div>
              )}

              {/* Readings table */}
              <div className="p-6">
                {selectedMeter ? (
                  <ReadingsTable
                    readings={readings}
                    loading={readingsLoading}
                    onEdit={(reading) => {
                      setEditingReading(reading);
                      setShowReadingForm(true);
                    }}
                    onDelete={deleteReading}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p className="text-lg font-medium">Wählen Sie einen Zähler aus</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {(showPropertyForm || editingProperty) && (
        <PropertyForm
          property={editingProperty}
          onClose={() => {
            setShowPropertyForm(false);
            setEditingProperty(null);
          }}
          onSave={() => {
            fetchProperties();
          }}
        />
      )}

      {(showMeterForm || editingMeter) && (
        <MeterForm
          meter={editingMeter}
          defaultType={activeTab}
          propertyId={selectedPropertyId}
          onClose={() => {
            setShowMeterForm(false);
            setEditingMeter(null);
          }}
          onSave={() => {
            fetchMeters();
          }}
        />
      )}

      {(showReadingForm || editingReading) && (
        <ReadingForm
          reading={editingReading}
          meters={meters}
          selectedMeterId={selectedMeterId || undefined}
          onClose={() => {
            setShowReadingForm(false);
            setEditingReading(null);
          }}
          onSave={() => {
            if (selectedMeterId) {
              fetchReadings(selectedMeterId);
            }
          }}
        />
      )}
    </div>
  );
}
