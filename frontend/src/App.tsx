import { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, Cell 
} from 'recharts';
import { 
  Upload, Loader2, RefreshCw, Filter, XCircle, Calendar, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, 
  MousePointerClick, Trash2, Pencil, Save, X, ChevronLeft, ChevronRight, Settings, CloudLightning 
} from 'lucide-react';
import { 
  format, parseISO, isSameDay, startOfToday, endOfToday, 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, 
  subWeeks, subMonths, isWithinInterval, addDays, addWeeks, addMonths, addQuarters, addYears, subDays 
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
// NEU: 'CUSTOM' hinzugefügt
type DatePreset = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'LAST_WEEK' | 'LAST_MONTH' | 'ALL' | 'CUSTOM';

const API_URL = '/api';

function App() {
  // --- STATE ---
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Filter States
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('MONTH');
  
  // Date Range State
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    return { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
  });

  // UI States
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'desc' 
  });
  
  // MODAL STATES
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- API CALLS ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<TimeEntry[]>(`${API_URL}/stats`);
      if (Array.isArray(res.data)) setEntries(res.data);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Möchtest du diesen Eintrag wirklich löschen?')) return;
    try {
        await axios.delete(`${API_URL}/entries/${id}`);
        fetchData(); 
    } catch (e) { alert('Fehler beim Löschen'); }
  };

  const updateEntry = async (entry: TimeEntry) => {
      try {
          await axios.put(`${API_URL}/entries/${entry.id}`, entry);
          setEditingEntry(null); 
          fetchData(); 
      } catch (e) { alert('Fehler beim Speichern'); }
  };

  const syncToggl = async (startDate?: string, endDate?: string) => {
      setSyncing(true);
      setShowSyncModal(false);
      try {
          // Force ist true, wenn Daten manuell gewählt wurden
          const isCustom = !!startDate;
          const payload = isCustom ? { startDate, endDate } : {};
          
          const res = await axios.post(`${API_URL}/sync/toggl?force=${isCustom}`, payload);
          alert(`Sync erfolgreich: ${res.data.message} (${res.data.count} Einträge)`);
          fetchData();
      } catch (error) {
          console.error(error);
          alert('Fehler beim Toggl Sync.');
      } finally {
          setSyncing(false);
      }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setSelectedDay(null); }, [filterSource, filterProject, dateRange]);

  // --- LOGIC: DATE NAVIGATION ---
  const opts = { locale: de, weekStartsOn: 1 as const };

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    let start = new Date(0); let end = new Date(2100, 0, 1); 

    switch (preset) {
        case 'TODAY': start = startOfToday(); end = endOfToday(); break;
        case 'WEEK': start = startOfWeek(now, opts); end = endOfWeek(now, opts); break;
        case 'MONTH': start = startOfMonth(now); end = endOfMonth(now); break;
        case 'QUARTER': start = startOfQuarter(now); end = endOfQuarter(now); break;
        case 'YEAR': start = startOfYear(now); end = endOfYear(now); break;
        case 'LAST_WEEK': const lw = subWeeks(now, 1); start = startOfWeek(lw, opts); end = endOfWeek(lw, opts); break;
        case 'LAST_MONTH': const lm = subMonths(now, 1); start = startOfMonth(lm); end = endOfMonth(lm); break;
        case 'CUSTOM': 
            // Standardmäßig die letzten 7 Tage, wenn auf Custom gewechselt wird
            end = endOfToday();
            start = subDays(end, 7);
            break;
    }
    setDateRange({ start, end });
  };

  // Vorwärts / Rückwärts Button Logik
  const navigateDateRange = (direction: 'prev' | 'next') => {
      if (datePreset === 'ALL' || datePreset === 'CUSTOM') return; // Bei Custom macht simple Navigation oft keinen Sinn oder ist komplex

      const modifier = direction === 'next' ? 1 : -1;
      let { start, end } = dateRange;

      switch (datePreset) {
          case 'TODAY':
              start = addDays(start, modifier);
              end = addDays(end, modifier);
              break;
          case 'WEEK':
          case 'LAST_WEEK': // Verhält sich wie Woche
              start = addWeeks(start, modifier);
              end = addWeeks(end, modifier);
              break;
          case 'MONTH':
          case 'LAST_MONTH':
              start = addMonths(start, modifier);
              end = endOfMonth(start); // Ende neu berechnen, da Monate unterschiedliche Längen haben
              break;
          case 'QUARTER':
              start = addQuarters(start, modifier);
              end = endOfQuarter(start);
              break;
          case 'YEAR':
              start = addYears(start, modifier);
              end = endOfYear(start);
              break;
      }
      setDateRange({ start, end });
  };

  // Custom Date Change Handler
  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
      const newDate = value ? parseISO(value) : new Date();
      setDateRange(prev => ({
          ...prev,
          [type]: type === 'start' ? newDate : endOfToday() // Fallback logic vereinfacht
      }));
      // Wenn End-Datum, dann dieses auch setzen.
      if(type === 'end') {
        // Da Input type="date" immer 00:00 liefert, wollen wir beim Enddatum eigentlich 23:59:59
        // Aber für den Filter reicht der Tagesvergleich.
         setDateRange(prev => ({ ...prev, end: newDate }));
      }
  };


  // --- LOGIC: FILTERING & SORTING ---
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSource = filterSource === 'ALL' || entry.source === filterSource;
      const matchesProject = filterProject === 'ALL' || entry.project === filterProject;
      const entryDate = parseISO(entry.date);
      let matchesDate = true;
      if (datePreset !== 'ALL') matchesDate = isWithinInterval(entryDate, { start: dateRange.start, end: dateRange.end });
      return matchesSource && matchesProject && matchesDate;
    });
  }, [entries, filterSource, filterProject, dateRange, datePreset]);

  const tableEntries = useMemo(() => {
    let data = [...filteredEntries];
    if (selectedDay) {
        const targetDate = parseISO(selectedDay);
        data = data.filter(e => isSameDay(parseISO(e.date), targetDate));
    }
    data.sort((a, b) => {
        let valA: any = a[sortConfig.key];
        let valB: any = b[sortConfig.key];
        if (sortConfig.key === 'date') { valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); }
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return data;
  }, [filteredEntries, sortConfig, selectedDay]);

  const tableTotalHours = useMemo(() => tableEntries.reduce((acc, curr) => acc + curr.duration, 0), [tableEntries]);
  const uniqueProjects = useMemo(() => Array.from(new Set(entries.map(e => e.project).filter(Boolean))).sort(), [entries]);

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  };

  // --- CHART LOGIC ---
  const aggregatedData: DailyStats[] = useMemo(() => {
    const map = new Map<string, DailyStats>();
    filteredEntries.forEach(entry => {
      const dateObj = parseISO(entry.date);
      const dateKey = format(dateObj, 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, { dateStr: dateKey, displayDate: format(dateObj, 'EE dd.MM', { locale: de }), totalHours: 0, togglHours: 0, tempoHours: 0, projects: [] });
      }
      const dayStat = map.get(dateKey)!;
      dayStat.totalHours += entry.duration;
      entry.source === 'TOGGL' ? dayStat.togglHours += entry.duration : dayStat.tempoHours += entry.duration;
      if (entry.project && !dayStat.projects.includes(entry.project)) dayStat.projects.push(entry.project);
    });
    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredEntries]);

  const handleBarClick = (data: any) => {
    let clickedDateStr: string | null = null;
    if (data && data.dateStr) clickedDateStr = data.dateStr;
    else if (data && data.activePayload && data.activePayload.length > 0) clickedDateStr = data.activePayload[0].payload.dateStr;
    if (clickedDateStr) setSelectedDay(current => current === clickedDateStr ? null : clickedDateStr!);
  };

  // --- KPIs & UPLOAD ---
  const totalHoursFiltered = filteredEntries.reduce((acc, curr) => acc + curr.duration, 0);
  const hoursToday = entries.filter(e => isSameDay(parseISO(e.date), new Date())).reduce((acc, curr) => acc + curr.duration, 0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API_URL}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('Import erfolgreich!');
      fetchData();
    } catch (error) { console.error(error); alert('Fehler beim Upload.'); } 
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 font-sans relative">
      
      {/* MODALS */}
      {editingEntry && <EditModal entry={editingEntry} onClose={() => setEditingEntry(null)} onSave={updateEntry} />}
      {showSyncModal && <SyncModal onClose={() => setShowSyncModal(false)} onSync={syncToggl} syncing={syncing} />}

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">vihais Tracker</h1>
            <p className="text-sm text-gray-500">
                {datePreset === 'ALL' ? 'Alle Zeiträume' : `${format(dateRange.start, 'dd.MM.yyyy')} - ${format(dateRange.end, 'dd.MM.yyyy')}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
              {/* SYNC GROUP */}
              <div className="flex items-center rounded-lg border border-pink-200 bg-pink-50 p-0.5">
                  <button 
                    onClick={() => syncToggl()} // Quick sync default
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-2 text-pink-700 hover:bg-pink-100 rounded-l-md transition text-sm font-medium"
                    title="Schnell-Sync (3 Monate)"
                  >
                      <CloudLightning size={18} className={syncing ? "animate-pulse" : ""} />
                      <span className="hidden md:inline">Sync</span>
                  </button>
                  <div className="w-px h-5 bg-pink-200"></div>
                  <button 
                    onClick={() => setShowSyncModal(true)}
                    className="px-2 py-2 text-pink-700 hover:bg-pink-100 rounded-r-md transition"
                    title="Einstellungen"
                  >
                      <Settings size={18} />
                  </button>
              </div>

              <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>

              <button onClick={fetchData} className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"><RefreshCw size={20} className={loading ? "animate-spin" : ""} /></button>
              
              <div className="relative">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition shadow-sm disabled:opacity-50 text-sm">
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} CSV Import
                  </button>
              </div>
          </div>
        </header>

        {/* CONTROLS / FILTER */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
            
            {/* DATE NAVIGATION & PRESET */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => navigateDateRange('prev')} 
                    disabled={datePreset === 'ALL' || datePreset === 'CUSTOM'}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="relative group">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg text-sm text-gray-700 min-w-[160px]">
                        <Calendar size={16} className="text-gray-400"/>
                        <select value={datePreset} onChange={(e) => applyDatePreset(e.target.value as DatePreset)} className="bg-transparent border-none focus:ring-0 p-0 text-gray-700 font-medium w-full cursor-pointer appearance-none">
                            <option value="TODAY">Heute</option>
                            <option value="WEEK">Diese Woche</option>
                            <option value="MONTH">Dieser Monat</option>
                            <option value="QUARTER">Dieses Quartal</option>
                            <option value="YEAR">Dieses Jahr</option>
                            <option value="LAST_WEEK">Letzte Woche</option>
                            <option value="LAST_MONTH">Letzter Monat</option>
                            <option value="CUSTOM">Benutzerdefiniert</option>
                            <option value="ALL">Alles</option>
                        </select>
                        <ChevronDown size={14} className="text-gray-400 absolute right-3 pointer-events-none"/>
                    </div>
                </div>

                <button 
                    onClick={() => navigateDateRange('next')} 
                    disabled={datePreset === 'ALL' || datePreset === 'CUSTOM'}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* CUSTOM DATE INPUTS (Only visible if CUSTOM) */}
            {datePreset === 'CUSTOM' && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                    <input 
                        type="date" 
                        value={format(dateRange.start, 'yyyy-MM-dd')}
                        onChange={(e) => handleCustomDateChange('start', e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg text-sm px-2 py-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                        type="date" 
                        value={format(dateRange.end, 'yyyy-MM-dd')}
                        onChange={(e) => handleCustomDateChange('end', e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg text-sm px-2 py-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            )}

            <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>
            
            {/* FILTERS */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg text-sm text-gray-700">
                <Filter size={16} className="text-gray-400" />
                <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-transparent border-none focus:ring-0 p-0 w-[110px]">
                    <option value="ALL">Alle Quellen</option>
                    <option value="TOGGL">Toggl</option>
                    <option value="TEMPO">Tempo</option>
                </select>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg text-sm text-gray-700">
                <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-transparent border-none focus:ring-0 p-0 w-[140px]">
                    <option value="ALL">Alle Projekte</option>
                    {uniqueProjects.map(proj => <option key={proj} value={proj}>{proj}</option>)}
                </select>
            </div>

            {(filterSource !== 'ALL' || filterProject !== 'ALL' || datePreset !== 'MONTH') && (
                <button onClick={() => { setFilterSource('ALL'); setFilterProject('ALL'); applyDatePreset('MONTH'); }} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 ml-auto">
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

        {/* CHART */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Tägliche Arbeitszeit</h2>
            <div className="text-xs text-gray-400 flex items-center gap-1"><MousePointerClick size={14} /><span>Balken klicken für Details</span></div>
          </div>
          {aggregatedData.length > 0 ? (
              <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={aggregatedData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} onClick={handleBarClick}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="displayDate" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}h`} />
                    <Tooltip formatter={(val: number) => [val.toFixed(2) + ' h']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#f9fafb'}} />
                    <Legend iconType="circle" />
                    <Bar name="Toggl" dataKey="togglHours" stackId="a" fill="#E57CD8" radius={[0, 0, 4, 4]} cursor="pointer" onClick={handleBarClick}>
                        {aggregatedData.map((entry, index) => (
                            <Cell key={`cell-toggl-${index}`} fill="#E57CD8" fillOpacity={selectedDay && entry.dateStr !== selectedDay ? 0.3 : 1} />
                        ))}
                    </Bar>
                    <Bar name="Tempo" dataKey="tempoHours" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick}>
                        {aggregatedData.map((entry, index) => (
                            <Cell key={`cell-tempo-${index}`} fill="#3B82F6" fillOpacity={selectedDay && entry.dateStr !== selectedDay ? 0.3 : 1} />
                        ))}
                    </Bar>
                    <Line type="monotone" dataKey="totalHours" stroke="none" dot={false} activeDot={false} isAnimationActive={false}>
                        <LabelList dataKey="totalHours" position="top" offset={10} formatter={(val: number) => val > 0 ? val.toFixed(2) : ''} style={{ fontSize: '12px', fill: '#6b7280', fontWeight: 600 }} />
                    </Line>
                  </ComposedChart>
              </ResponsiveContainer>
              </div>
          ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50"><p>Keine Daten für diesen Filterzeitraum.</p></div>
          )}
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">
                {selectedDay ? `Details für ${format(parseISO(selectedDay), 'dd.MM.yyyy')}` : 'Alle Einträge im Zeitraum'}
            </h3>
            {selectedDay && (
                <button onClick={() => setSelectedDay(null)} className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium hover:bg-indigo-100 transition">
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
                          <th className="px-6 py-3 font-medium text-right w-[100px]">Aktionen</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {tableEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-6 py-3 text-gray-600">{format(parseISO(entry.date), 'EE dd.MM.yyyy', { locale: de })}</td>
                              <td className="px-6 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.source === 'TOGGL' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}`}>{entry.source}</span></td>
                              <td className="px-6 py-3 font-medium text-gray-800">{entry.project}</td>
                              <td className="px-6 py-3 text-gray-500 max-w-md truncate" title={entry.description}>{entry.description}</td>
                              <td className="px-6 py-3 text-right font-mono text-gray-700">{entry.duration.toFixed(2)} h</td>
                              <td className="px-6 py-3 text-right">
                                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => setEditingEntry(entry)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Bearbeiten"><Pencil size={16} /></button>
                                      <button onClick={() => deleteEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Löschen"><Trash2 size={16} /></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
                  {tableEntries.length > 0 && (
                      <tfoot className="bg-gray-50 sticky bottom-0 z-10 shadow-inner">
                          <tr><td colSpan={4} className="px-6 py-4 text-right font-bold text-gray-700">Gesamt:</td><td className="px-6 py-4 text-right font-bold text-indigo-600 text-base">{tableTotalHours.toFixed(2)} h</td><td></td></tr>
                      </tfoot>
                  )}
              </table>
              {tableEntries.length === 0 && <div className="p-10 text-center text-gray-400">Keine Einträge {selectedDay ? 'an diesem Tag' : 'im gewählten Zeitraum'}.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---

// SYNC MODAL (NEU)
function SyncModal({ onClose, onSync, syncing }: { onClose: () => void, onSync: (start?: string, end?: string) => void, syncing: boolean }) {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSync(start, end);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg">Toggl Sync Einstellungen</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">Lege fest, welcher Zeitraum von Toggl synchronisiert werden soll. Wenn leer, werden die letzten 3 Monate geladen.</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
                        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
                        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div className="pt-2 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border rounded-lg">Abbrechen</button>
                        <button type="submit" disabled={syncing} className="px-4 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg flex items-center gap-2">
                            {syncing ? <Loader2 size={16} className="animate-spin"/> : <CloudLightning size={16}/>} 
                            Jetzt Syncen
                        </button>
                    </div>
                </form>
             </div>
        </div>
    );
}

// Edit Modal Component (Bestehend)
function EditModal({ entry, onClose, onSave }: { entry: TimeEntry, onClose: () => void, onSave: (e: TimeEntry) => void }) {
    const [formData, setFormData] = useState({
        date: format(parseISO(entry.date), 'yyyy-MM-dd'),
        duration: entry.duration,
        project: entry.project,
        description: entry.description,
        source: entry.source
    });
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ ...entry, ...formData }); };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg">Eintrag bearbeiten</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Datum</label><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full rounded-lg border-gray-300 shadow-sm p-2.5 border" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Dauer (Stunden)</label><input type="number" step="0.01" min="0.01" required value={formData.duration} onChange={e => setFormData({...formData, duration: parseFloat(e.target.value)})} className="w-full rounded-lg border-gray-300 shadow-sm p-2.5 border" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label><input type="text" required value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})} className="w-full rounded-lg border-gray-300 shadow-sm p-2.5 border" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label><textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-lg border-gray-300 shadow-sm p-2.5 border" /></div>
                    <div className="pt-2 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"><Save size={16} /> Speichern</button></div>
                </form>
            </div>
        </div>
    );
}

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

function SortableHeader({ label, sortKey, currentSort, onSort, align = 'left' }: { label: string; sortKey: SortKey; currentSort: { key: SortKey; direction: SortDirection }; onSort: (key: SortKey) => void; align?: 'left' | 'right'; }) {
    const isActive = currentSort.key === sortKey;
    return (
        <th className={`px-6 py-3 font-medium cursor-pointer hover:text-gray-700 hover:bg-gray-100 transition user-select-none ${align === 'right' ? 'text-right' : ''}`} onClick={() => onSort(sortKey)}>
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                {isActive ? (currentSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : (<ArrowUpDown size={14} className="opacity-30" />)}
            </div>
        </th>
    );
}

export default App;
