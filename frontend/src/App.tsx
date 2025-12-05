import { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList 
} from 'recharts';
import { 
  Upload, Loader2, RefreshCw, Filter, XCircle, Calendar, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, MousePointerClick 
} from 'lucide-react';
import { 
  format, parseISO, isSameDay, startOfToday, endOfToday, 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, 
  subWeeks, subMonths, isWithinInterval 
} from 'date-fns';
import { de } from 'date-fns/locale';

// --- TYPEN ---
interface TimeEntry {
  id: string;
  date: string;
  duration: number;
  project: string;
  description: string;
  source: string;
}

interface DailyStats {
  dateStr: string;
  displayDate: string;
  totalHours: number;
  togglHours: number;
  tempoHours: number;
  projects: string[];
}

type SortKey = 'date' | 'source' | 'project' | 'description' | 'duration';
type SortDirection = 'asc' | 'desc';

type DatePreset = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'LAST_WEEK' | 'LAST_MONTH' | 'ALL';

const API_URL = '/api';

function App() {
  // --- STATE ---
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Filter States
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  
  // Date Range State
  const [datePreset, setDatePreset] = useState<DatePreset>('MONTH');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    return { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
  });

  // Drill-Down State (Chart Click)
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'desc' 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC: DATA FETCHING ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<TimeEntry[]>(`${API_URL}/stats`);
      if (Array.isArray(res.data)) {
         setEntries(res.data);
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset selected day when main filters change
  useEffect(() => {
    setSelectedDay(null);
  }, [filterSource, filterProject, dateRange]);

  // --- LOGIC: DATE PRESETS ---
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const opts = { locale: de, weekStartsOn: 1 as const }; 

    let start = new Date(0); 
    let end = new Date(2100, 0, 1); 

    switch (preset) {
        case 'TODAY':
            start = startOfToday();
            end = endOfToday();
            break;
        case 'WEEK': 
            start = startOfWeek(now, opts);
            end = endOfWeek(now, opts);
            break;
        case 'MONTH': 
            start = startOfMonth(now);
            end = endOfMonth(now);
            break;
        case 'QUARTER': 
            start = startOfQuarter(now);
            end = endOfQuarter(now);
            break;
        case 'YEAR': 
            start = startOfYear(now);
            end = endOfYear(now);
            break;
        case 'LAST_WEEK':
            const lastWeek = subWeeks(now, 1);
            start = startOfWeek(lastWeek, opts);
            end = endOfWeek(lastWeek, opts);
            break;
        case 'LAST_MONTH':
            const lastMonth = subMonths(now, 1);
            start = startOfMonth(lastMonth);
            end = endOfMonth(lastMonth);
            break;
        case 'ALL':
        default:
            break;
    }
    setDateRange({ start, end });
  };

  // --- LOGIC: FILTERING ---
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSource = filterSource === 'ALL' || entry.source === filterSource;
      const matchesProject = filterProject === 'ALL' || entry.project === filterProject;
      
      const entryDate = parseISO(entry.date);
      let matchesDate = true;
      if (datePreset !== 'ALL') {
          matchesDate = isWithinInterval(entryDate, { start: dateRange.start, end: dateRange.end });
      }

      return matchesSource && matchesProject && matchesDate;
    });
  }, [entries, filterSource, filterProject, dateRange, datePreset]);

  // --- LOGIC: TABLE DATA (Global Filter + Click Selection) ---
  const tableEntries = useMemo(() => {
    let data = [...filteredEntries];

    // Wenn ein Tag im Chart geklickt wurde, filtern wir die Tabelle zusätzlich
    if (selectedDay) {
        data = data.filter(e => e.date.startsWith(selectedDay)); // ISO String Start comparison
    }

    // Sortieren
    data.sort((a, b) => {
        let valA: any = a[sortConfig.key];
        let valB: any = b[sortConfig.key];

        if (sortConfig.key === 'date') {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        }
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return data;
  }, [filteredEntries, sortConfig, selectedDay]);

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const uniqueProjects = useMemo(() => {
    const projects = new Set(entries.map(e => e.project).filter(Boolean));
    return Array.from(projects).sort();
  }, [entries]);

  // --- LOGIC: AGGREGATION (CHART) ---
  const aggregatedData: DailyStats[] = useMemo(() => {
    const map = new Map<string, DailyStats>();

    filteredEntries.forEach(entry => {
      const dateObj = parseISO(entry.date);
      const dateKey = format(dateObj, 'yyyy-MM-dd');

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateStr: dateKey,
          displayDate: format(dateObj, 'EE dd.MM', { locale: de }),
          totalHours: 0,
          togglHours: 0,
          tempoHours: 0,
          projects: []
        });
      }

      const dayStat = map.get(dateKey)!;
      dayStat.totalHours += entry.duration;
      
      if (entry.source === 'TOGGL') {
        dayStat.togglHours += entry.duration;
      } else {
        dayStat.tempoHours += entry.duration;
      }

      if (entry.project && !dayStat.projects.includes(entry.project)) {
        dayStat.projects.push(entry.project);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredEntries]);

  // Chart Click Handler (Robustere Version)
  const handleBarClick = (data: any) => {
    let clickedDateStr: string | null = null;

    // Fall A: Klick direkt auf den Balken (Recharts übergibt das Datenobjekt direkt)
    if (data && data.dateStr) {
        clickedDateStr = data.dateStr;
    } 
    // Fall B: Klick auf den Hintergrund/Wrapper (Recharts übergibt Event mit activePayload)
    else if (data && data.activePayload && data.activePayload.length > 0) {
        clickedDateStr = data.activePayload[0].payload.dateStr;
    }

    if (clickedDateStr) {
        // Toggle: Wenn schon ausgewählt, dann abwählen, sonst auswählen
        setSelectedDay(current => current === clickedDateStr ? null : clickedDateStr!);
    }
  };

  // KPIs
  const totalHoursFiltered = filteredEntries.reduce((acc, curr) => acc + curr.duration, 0);
  const today = new Date();
  const hoursToday = entries 
    .filter(e => isSameDay(parseISO(e.date), today))
    .reduce((acc, curr) => acc + curr.duration, 0);

  // Upload Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Import erfolgreich!');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Fehler beim Upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">vihais Tracker</h1>
            <p className="text-sm text-gray-500">
                {datePreset === 'ALL' 
                    ? 'Alle Zeiträume' 
                    : `${format(dateRange.start, 'dd.MM.yyyy')} - ${format(dateRange.end, 'dd.MM.yyyy')}`
                }
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
              <button onClick={fetchData} className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Aktualisieren">
                  <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
              <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
              <div className="relative">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition shadow-sm disabled:opacity-50 text-sm"
                  >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      CSV Import
                  </button>
              </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
            
            {/* Date Preset Dropdown */}
            <div className="relative group">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg text-sm text-gray-700 min-w-[160px]">
                    <Calendar size={16} className="text-gray-400"/>
                    <select 
                        value={datePreset}
                        onChange={(e) => applyDatePreset(e.target.value as DatePreset)}
                        className="bg-transparent border-none focus:ring-0 p-0 text-gray-700 font-medium w-full cursor-pointer appearance-none"
                    >
                        <option value="TODAY">Heute</option>
                        <option value="WEEK">Diese Woche</option>
                        <option value="MONTH">Dieser Monat</option>
                        <option value="QUARTER">Dieses Quartal</option>
                        <option value="YEAR">Dieses Jahr</option>
                        <option value="LAST_WEEK">Letzte Woche</option>
                        <option value="LAST_MONTH">Letzter Monat</option>
                        <option value="ALL">Alles</option>
                    </select>
                    <ChevronDown size={14} className="text-gray-400 absolute right-3 pointer-events-none"/>
                </div>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>

            {/* Source & Project */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg text-sm text-gray-700">
                <Filter size={16} className="text-gray-400" />
                <select 
                    value={filterSource} 
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 p-0 w-[110px]"
                >
                    <option value="ALL">Alle Quellen</option>
                    <option value="TOGGL">Toggl</option>
                    <option value="TEMPO">Tempo</option>
                </select>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg text-sm text-gray-700">
                <select 
                    value={filterProject} 
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 p-0 w-[140px]"
                >
                    <option value="ALL">Alle Projekte</option>
                    {uniqueProjects.map(proj => (
                        <option key={proj} value={proj}>{proj}</option>
                    ))}
                </select>
            </div>

            {(filterSource !== 'ALL' || filterProject !== 'ALL' || datePreset !== 'MONTH') && (
                <button 
                    onClick={() => { setFilterSource('ALL'); setFilterProject('ALL'); applyDatePreset('MONTH'); }}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 ml-auto"
                >
                    <XCircle size={16} /> Reset
                </button>
            )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Stunden Heute" value={hoursToday.toFixed(2)} unit="h" color="text-indigo-600" />
          <Card title="Summe im Zeitraum" value={totalHoursFiltered.toFixed(2)} unit="h" color="text-gray-900" />
          <Card title="Einträge" value={filteredEntries.length.toString()} unit="#" color="text-gray-600" />
        </div>

        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Tägliche Arbeitszeit</h2>
            <div className="text-xs text-gray-400 flex items-center gap-1">
                <MousePointerClick size={14} />
                <span>Balken klicken für Details</span>
            </div>
          </div>
          
          {aggregatedData.length > 0 ? (
              <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  {/* onClick Handler hinzugefügt */}
                  <ComposedChart 
                    data={aggregatedData} 
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    onClick={handleBarClick} // Fallback für Klick auf leere Fläche in Spalte
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                        dataKey="displayDate" 
                        tick={{fill: '#9ca3af', fontSize: 12}} 
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis 
                        tick={{fill: '#9ca3af', fontSize: 12}} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val}h`}
                    />
                    
                    <Tooltip 
                        formatter={(val: number) => [val.toFixed(2) + ' h']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{fill: '#f9fafb'}}
                    />
                    <Legend iconType="circle" />
                    
                    {/* WICHTIG: onClick auch hier direkt anfügen */}
                    <Bar 
                        name="Toggl" 
                        dataKey="togglHours" 
                        stackId="a" 
                        fill="#E57CD8" 
                        radius={[0, 0, 4, 4]} 
                        cursor="pointer"
                        onClick={handleBarClick} 
                    />
                    <Bar 
                        name="Tempo" 
                        dataKey="tempoHours" 
                        stackId="a" 
                        fill="#3B82F6" 
                        radius={[4, 4, 0, 0]} 
                        cursor="pointer"
                        onClick={handleBarClick} 
                    />

                    <Line 
                        type="monotone" 
                        dataKey="totalHours" 
                        stroke="none" 
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                    >
                        <LabelList 
                            dataKey="totalHours" 
                            position="top" 
                            offset={10} 
                            formatter={(val: number) => val > 0 ? val.toFixed(2) : ''}
                            style={{ fontSize: '12px', fill: '#6b7280', fontWeight: 600 }}
                        />
                    </Line>

                  </ComposedChart>
              </ResponsiveContainer>
              </div>
          ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
                  <p>Keine Daten für diesen Filterzeitraum.</p>
              </div>
          )}
        </div>

        {/* Sortable Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">
                {selectedDay 
                    ? `Details für ${format(parseISO(selectedDay), 'dd.MM.yyyy')}` 
                    : 'Alle Einträge im Zeitraum'
                }
            </h3>
            
            {/* Indikator wenn ein Tag ausgewählt ist */}
            {selectedDay && (
                <button 
                    onClick={() => setSelectedDay(null)}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium hover:bg-indigo-100 transition"
                >
                    <XCircle size={14} /> Auswahl aufheben
                </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10 shadow-sm">
                      <tr>
                          <SortableHeader label="Datum" sortKey="date" currentSort={sortConfig} onSort={handleSort} />
                          <SortableHeader label="Quelle" sortKey="source" currentSort={sortConfig} onSort={handleSort} />
                          <SortableHeader label="Projekt" sortKey="project" currentSort={sortConfig} onSort={handleSort} />
                          <SortableHeader label="Beschreibung" sortKey="description" currentSort={sortConfig} onSort={handleSort} />
                          <SortableHeader label="Dauer" sortKey="duration" currentSort={sortConfig} onSort={handleSort} align="right" />
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {tableEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3 text-gray-600">
                                  {format(parseISO(entry.date), 'EE dd.MM.yyyy', { locale: de })}
                              </td>
                              <td className="px-6 py-3">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      entry.source === 'TOGGL' 
                                      ? 'bg-pink-100 text-pink-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                      {entry.source}
                                  </span>
                              </td>
                              <td className="px-6 py-3 font-medium text-gray-800">{entry.project}</td>
                              <td className="px-6 py-3 text-gray-500 max-w-md truncate" title={entry.description}>
                                {entry.description}
                              </td>
                              <td className="px-6 py-3 text-right font-mono text-gray-700">{entry.duration.toFixed(2)} h</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              {tableEntries.length === 0 && (
                <div className="p-10 text-center text-gray-400">Keine Einträge {selectedDay ? 'an diesem Tag' : 'im gewählten Zeitraum'}.</div>
              )}
          </div>
        </div>

      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---

function Card({ title, value, unit, color }: { title: string, value: string, unit: string, color: string }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
            <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${color}`}>{value}</span>
                <span className="text-gray-400 font-medium">{unit}</span>
            </div>
        </div>
    );
}

function SortableHeader({ label, sortKey, currentSort, onSort, align = 'left' }: {
    label: string;
    sortKey: SortKey;
    currentSort: { key: SortKey; direction: SortDirection };
    onSort: (key: SortKey) => void;
    align?: 'left' | 'right';
}) {
    const isActive = currentSort.key === sortKey;
    
    return (
        <th 
            className={`px-6 py-3 font-medium cursor-pointer hover:text-gray-700 hover:bg-gray-100 transition user-select-none ${align === 'right' ? 'text-right' : ''}`}
            onClick={() => onSort(sortKey)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                {isActive ? (
                    currentSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                ) : (
                    <ArrowUpDown size={14} className="opacity-30" />
                )}
            </div>
        </th>
    );
}

export default App;
