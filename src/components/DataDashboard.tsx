import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart as ReBarChart, Bar,
  LineChart as ReLineChart, Line,
  AreaChart as ReAreaChart, Area,
  PieChart as RePieChart, Pie, Cell,
  ScatterChart as ReScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  LayoutDashboard, 
  Sliders, 
  LineChart, 
  BarChart3, 
  PieChart, 
  Activity, 
  Sparkles, 
  TrendingUp, 
  HelpCircle,
  Filter,
  Search,
  RotateCcw,
  Download,
  ArrowUpDown,
  Layers,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { Dataset, AIAnalysisReport, ChartSuggestion } from '../types';

interface DataDashboardProps {
  dataset: Dataset;
  analysisReport: AIAnalysisReport | null;
  onNavigateToTab?: (tab: 'clean' | 'dashboard' | 'insights' | 'pdf') => void;
}

const PALETTE = ['#10b981', '#34d399', '#059669', '#6ee7b7', '#a7f3d0', '#047857', '#06b6d4', '#3b82f6'];

export default function DataDashboard({ dataset, analysisReport, onNavigateToTab }: DataDashboardProps) {
  // Columns lists
  const columnsList = useMemo(() => dataset.columns.map(c => c.name), [dataset]);
  const numberColumns = useMemo(() => dataset.columns.filter(c => c.type === 'number').map(c => c.name), [dataset]);
  const categoricalOrDateColumns = useMemo(() => dataset.columns.filter(c => c.type === 'string' || c.type === 'date').map(c => c.name), [dataset]);

  // Chart config states
  const [xAxisCol, setXAxisCol] = useState(categoricalOrDateColumns[0] || columnsList[0] || '');
  const [yAxisCol, setYAxisCol] = useState(numberColumns[0] || columnsList[1] || '');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie' | 'scatter'>('bar');
  const [groupByCol, setGroupByCol] = useState<string>(''); // Optional aggregation toggle

  // --- INTERACTIVE SLICERS & FILTERS STATES ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [slicerCol, setSlicerCol] = useState<string>(categoricalOrDateColumns[0] || '');
  const [selectedSlicerValues, setSelectedSlicerValues] = useState<string[]>([]);
  const [numericFilterCol, setNumericFilterCol] = useState<string>(numberColumns[0] || '');
  const [numMin, setNumMin] = useState<string>('');
  const [numMax, setNumMax] = useState<string>('');
  const [sortBy, setSortBy] = useState<'none' | 'value-desc' | 'value-asc' | 'name-asc'>('none');
  const [recordLimit, setRecordLimit] = useState<number>(30);

  // Default initial slicer selection
  useEffect(() => {
    if (categoricalOrDateColumns.length > 0 && !slicerCol) {
      setSlicerCol(categoricalOrDateColumns[0]);
    }
    if (numberColumns.length > 0 && !numericFilterCol) {
      setNumericFilterCol(numberColumns[0]);
    }
  }, [categoricalOrDateColumns, numberColumns]);

  // Pre-load default chart configs from AI suggestion if available
  useEffect(() => {
    if (analysisReport && analysisReport.chartSuggestions && analysisReport.chartSuggestions.length > 0) {
      const suggestion = analysisReport.chartSuggestions[0];
      const xExists = columnsList.includes(suggestion.xAxis);
      const yExists = columnsList.includes(suggestion.yAxis);
      
      if (xExists && yExists) {
        setXAxisCol(suggestion.xAxis);
        setYAxisCol(suggestion.yAxis);
        setChartType(suggestion.chartType);
      }
    } else {
      if (categoricalOrDateColumns.length > 0) setXAxisCol(categoricalOrDateColumns[0]);
      if (numberColumns.length > 0) setYAxisCol(numberColumns[0]);
    }
  }, [analysisReport, columnsList, numberColumns, categoricalOrDateColumns]);

  // Slicer unique values options for the chosen slicer column
  const slicerOptions = useMemo(() => {
    if (!slicerCol || dataset.rows.length === 0) return [];
    const counts: Record<string, number> = {};
    dataset.rows.forEach(row => {
      const val = row[slicerCol] !== null && row[slicerCol] !== undefined && row[slicerCol] !== ''
        ? String(row[slicerCol])
        : '(Empty)';
      counts[val] = (counts[val] || 0) + 1;
    });
    // Return top 20 distinct categories sorted by count
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [dataset, slicerCol]);

  // Filter rows based on all active slicers
  const filteredRows = useMemo(() => {
    if (dataset.rows.length === 0) return [];

    return dataset.rows.filter(row => {
      // 1. Text Search Filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const match = Object.values(row).some(
          v => v !== null && v !== undefined && String(v).toLowerCase().includes(q)
        );
        if (!match) return false;
      }

      // 2. Categorical Value Slicer Filter
      if (slicerCol && selectedSlicerValues.length > 0) {
        const cellVal = row[slicerCol] !== null && row[slicerCol] !== undefined && row[slicerCol] !== ''
          ? String(row[slicerCol])
          : '(Empty)';
        if (!selectedSlicerValues.includes(cellVal)) {
          return false;
        }
      }

      // 3. Numeric Range Filter
      if (numericFilterCol) {
        const cellVal = parseFloat(row[numericFilterCol]);
        if (!isNaN(cellVal)) {
          if (numMin !== '' && !isNaN(parseFloat(numMin)) && cellVal < parseFloat(numMin)) {
            return false;
          }
          if (numMax !== '' && !isNaN(parseFloat(numMax)) && cellVal > parseFloat(numMax)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [dataset, searchQuery, slicerCol, selectedSlicerValues, numericFilterCol, numMin, numMax]);

  // Process chart data from filtered rows
  const chartData = useMemo(() => {
    if (filteredRows.length === 0) return [];

    let baseData: any[] = [];

    if (!groupByCol) {
      baseData = filteredRows.map(row => {
        const xVal = row[xAxisCol];
        const yVal = parseFloat(row[yAxisCol]);
        return {
          name: xVal !== null && xVal !== undefined ? String(xVal) : 'N/A',
          value: isNaN(yVal) ? 0 : parseFloat(yVal.toFixed(2)),
          ...row
        };
      });
    } else {
      const aggMap: Record<string, { name: string; value: number; count: number }> = {};
      filteredRows.forEach(row => {
        const xVal = String(row[xAxisCol] || 'N/A');
        const yVal = parseFloat(row[yAxisCol]) || 0;
        
        if (!aggMap[xVal]) {
          aggMap[xVal] = { name: xVal, value: 0, count: 0 };
        }
        aggMap[xVal].value += yVal;
        aggMap[xVal].count += 1;
      });

      baseData = Object.values(aggMap).map(item => ({
        name: item.name,
        value: parseFloat(item.value.toFixed(2)),
        averageValue: parseFloat((item.value / item.count).toFixed(2))
      }));
    }

    // Apply Sorting
    if (sortBy === 'value-desc') {
      baseData.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'value-asc') {
      baseData.sort((a, b) => a.value - b.value);
    } else if (sortBy === 'name-asc') {
      baseData.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Apply Record Plot Limit
    return recordLimit > 0 ? baseData.slice(0, recordLimit) : baseData;
  }, [filteredRows, xAxisCol, yAxisCol, groupByCol, sortBy, recordLimit]);

  // Real-time Aggregation Summary numbers for filtered dataset
  const selectedStats = useMemo(() => {
    if (filteredRows.length === 0 || !yAxisCol) return null;
    const values = filteredRows.map(r => parseFloat(r[yAxisCol])).filter(v => !isNaN(v));
    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      sum: sum.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      avg: avg.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      min: min.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      max: max.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      count: values.length,
      totalRows: dataset.rowCount,
      filteredRowsCount: filteredRows.length
    };
  }, [filteredRows, yAxisCol, dataset.rowCount]);

  const toggleSlicerValue = (val: string) => {
    setSelectedSlicerValues(prev => 
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedSlicerValues([]);
    setNumMin('');
    setNumMax('');
    setSortBy('none');
    setRecordLimit(30);
  };

  const handleExportFilteredCSV = () => {
    if (filteredRows.length === 0) return;
    const headers = columnsList;
    const csvLines = [
      headers.join(','),
      ...filteredRows.map(row => 
        headers.map(col => {
          const val = row[col] ?? '';
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Filtered_${dataset.name || 'data'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyAIChartSuggestion = (suggestion: ChartSuggestion) => {
    if (columnsList.includes(suggestion.xAxis) && columnsList.includes(suggestion.yAxis)) {
      setXAxisCol(suggestion.xAxis);
      setYAxisCol(suggestion.yAxis);
      setChartType(suggestion.chartType);
    }
  };

  const activeFiltersCount = (searchQuery ? 1 : 0) + selectedSlicerValues.length + (numMin || numMax ? 1 : 0);

  return (
    <div className="space-y-6" id="dashboard-visual-module">
      {/* Top Header & Fast Action Bar */}
      <div className="bg-[#111113] border border-white/5 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-emerald-500" />
            <h2 className="text-base font-bold text-white font-display">Interactive Analytical Dashboard</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Filter, slice, sort, and visualize your dataset in real time with interactive controls
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filteredRows.length < dataset.rowCount && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded font-mono font-bold">
              Filter Active: {filteredRows.length} / {dataset.rowCount} rows
            </span>
          )}
          
          <button
            onClick={handleExportFilteredCSV}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold rounded border border-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Download currently filtered slice as CSV"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            Export Slice CSV
          </button>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('pdf')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              Download Report PDF
            </button>
          )}
        </div>
      </div>

      {/* --- INTERACTIVE SLICERS & FILTERS SECTION --- */}
      <div className="bg-[#111113] border border-emerald-500/20 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Interactive Data Slicers & Filters
            </h3>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 bg-emerald-500 text-black text-[10px] font-extrabold rounded-full font-mono">
                {activeFiltersCount} Active
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All Filters
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* 1. Global Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
              <Search className="h-3 w-3 text-emerald-500" />
              Search Dataset
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search across all fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded text-white focus:border-emerald-500 cursor-text outline-none pr-7"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2.5 text-gray-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 2. Categorical Slicer Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
              <Layers className="h-3 w-3 text-emerald-500" />
              Category Slicer Field
            </label>
            <select
              value={slicerCol}
              onChange={(e) => {
                setSlicerCol(e.target.value);
                setSelectedSlicerValues([]);
              }}
              className="w-full text-xs p-2.5 bg-white/5 border border-white/10 rounded text-white focus:border-emerald-500 cursor-pointer outline-none"
            >
              {categoricalOrDateColumns.map(col => (
                <option key={col} value={col} className="bg-[#111113] text-gray-300">
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Numeric Range Slicer */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
              <Sliders className="h-3 w-3 text-emerald-500" />
              Range Filter ({numericFilterCol || 'Number'})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={numMin}
                onChange={(e) => setNumMin(e.target.value)}
                className="w-1/2 text-xs p-2 bg-white/5 border border-white/10 rounded text-white focus:border-emerald-500 outline-none"
              />
              <span className="text-gray-500 text-xs">-</span>
              <input
                type="number"
                placeholder="Max"
                value={numMax}
                onChange={(e) => setNumMax(e.target.value)}
                className="w-1/2 text-xs p-2 bg-white/5 border border-white/10 rounded text-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* 4. Chart Sort & Display Limit */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-emerald-500" />
              Sort & Limit Plotted
            </label>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-3/5 text-xs p-2 bg-white/5 border border-white/10 rounded text-white focus:border-emerald-500 cursor-pointer outline-none"
              >
                <option value="none" className="bg-[#111113]">Order: Default</option>
                <option value="value-desc" className="bg-[#111113]">Value: High → Low</option>
                <option value="value-asc" className="bg-[#111113]">Value: Low → High</option>
                <option value="name-asc" className="bg-[#111113]">Name: A → Z</option>
              </select>

              <select
                value={recordLimit}
                onChange={(e) => setRecordLimit(Number(e.target.value))}
                className="w-2/5 text-xs p-2 bg-white/5 border border-white/10 rounded text-white focus:border-emerald-500 cursor-pointer outline-none font-mono"
              >
                <option value={10} className="bg-[#111113]">10 rows</option>
                <option value={25} className="bg-[#111113]">25 rows</option>
                <option value={50} className="bg-[#111113]">50 rows</option>
                <option value={100} className="bg-[#111113]">100 rows</option>
                <option value={0} className="bg-[#111113]">All</option>
              </select>
            </div>
          </div>

        </div>

        {/* Categorical Value Interactive Chips / Slicers */}
        {slicerCol && slicerOptions.length > 0 && (
          <div className="pt-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 font-mono">
                Click Slicer Pills to filter by <strong className="text-emerald-400">{slicerCol}</strong>:
              </span>
              {selectedSlicerValues.length > 0 && (
                <button
                  onClick={() => setSelectedSlicerValues([])}
                  className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer font-mono"
                >
                  Clear field selection ({selectedSlicerValues.length})
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
              {slicerOptions.map(({ value, count }) => {
                const isSelected = selectedSlicerValues.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSlicerValue(value)}
                    className={`px-2.5 py-1 text-xs rounded-full border font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500 text-black border-emerald-400 font-bold shadow-sm shadow-emerald-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    <span>{value}</span>
                    <span className={`text-[9px] px-1 py-0.2 rounded ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Summary KPI Cards (Recalculated on filtered data) */}
      {selectedStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#111113] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block font-mono">Sum ({yAxisCol})</span>
            <span className="text-2xl font-light text-white block mt-2 font-display">{selectedStats.sum}</span>
            <span className="text-[10px] text-gray-500 mt-1 font-mono">{selectedStats.filteredRowsCount} records</span>
          </div>
          <div className="bg-[#111113] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block font-mono">Average</span>
            <span className="text-2xl font-light text-white block mt-2 font-display">{selectedStats.avg}</span>
            <span className="text-[10px] text-gray-500 mt-1 font-mono">Filtered mean</span>
          </div>
          <div className="bg-[#111113] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block font-mono">Minimum</span>
            <span className="text-2xl font-light text-emerald-400 block mt-2 font-display">{selectedStats.min}</span>
            <span className="text-[10px] text-gray-500 mt-1 font-mono">Filtered min</span>
          </div>
          <div className="bg-[#111113] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block font-mono">Maximum</span>
            <span className="text-2xl font-light text-amber-400 block mt-2 font-display">{selectedStats.max}</span>
            <span className="text-[10px] text-gray-500 mt-1 font-mono">Filtered max</span>
          </div>
        </div>
      )}

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Chart Customizer controls (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#111113] border border-white/5 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-white/5">
              <Sliders className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-white font-display">Chart Configurator</h3>
            </div>

            {/* X Axis */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono block">X-Axis (Label Column)</label>
              <select
                value={xAxisCol}
                onChange={(e) => setXAxisCol(e.target.value)}
                className="w-full text-xs p-2.5 bg-white/5 border border-white/5 rounded text-white focus:ring-1 focus:ring-emerald-500 cursor-pointer outline-none"
              >
                {columnsList.map((col) => (
                  <option key={col} value={col} className="bg-[#111113] text-gray-300">
                    {col} {dataset.columns.find(c => c.name === col)?.type === 'date' ? '📅' : '🔤'}
                  </option>
                ))}
              </select>
            </div>

            {/* Y Axis */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono block">Y-Axis (Value Column)</label>
              <select
                value={yAxisCol}
                onChange={(e) => setYAxisCol(e.target.value)}
                className="w-full text-xs p-2.5 bg-white/5 border border-white/5 rounded text-white focus:ring-1 focus:ring-emerald-500 cursor-pointer outline-none"
              >
                {columnsList.map((col) => (
                  <option key={col} value={col} className="bg-[#111113] text-gray-300">
                    {col} {dataset.columns.find(c => c.name === col)?.type === 'number' ? '🔢' : '⚠️ non-numeric'}
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Type Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono block">Visualization Type</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { key: 'bar', icon: BarChart3, label: 'Bar' },
                  { key: 'line', icon: LineChart, label: 'Line' },
                  { key: 'area', icon: Activity, label: 'Area' },
                  { key: 'pie', icon: PieChart, label: 'Pie' },
                  { key: 'scatter', icon: TrendingUp, label: 'Scatter' }
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setChartType(item.key as any)}
                      className={`p-2 rounded border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        chartType === item.key
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                      title={item.label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[8px] font-bold tracking-wider uppercase font-mono">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Suggestions from Gemini AI */}
            {analysisReport && analysisReport.chartSuggestions && analysisReport.chartSuggestions.length > 0 && (
              <div className="pt-4 border-t border-white/5 space-y-2.5">
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-widest font-mono">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
                  AI Recommended Visuals
                </span>
                <div className="space-y-2">
                  {analysisReport.chartSuggestions.map((suggestion, idx) => {
                    const isXValid = columnsList.includes(suggestion.xAxis);
                    const isYValid = columnsList.includes(suggestion.yAxis);
                    if (!isXValid || !isYValid) return null;

                    return (
                      <button
                        key={idx}
                        onClick={() => applyAIChartSuggestion(suggestion)}
                        className="w-full text-left p-2.5 bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 rounded transition-all flex items-center gap-2 group cursor-pointer"
                      >
                        <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          {suggestion.chartType === 'line' ? <LineChart className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-white truncate">{suggestion.title}</span>
                          <span className="block text-[10px] text-gray-400 truncate mt-0.5">{suggestion.reason}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Recharts container (8 Cols) */}
        <div className="lg:col-span-8 bg-[#111113] border border-white/5 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-semibold text-white font-display capitalize">
                  {yAxisCol} by {xAxisCol}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Plotting {chartData.length} filtered items ({chartType.toUpperCase()} chart)
                </p>
              </div>
              <span className="px-2.5 py-1 bg-white/5 text-emerald-400 text-[10px] font-bold tracking-wider rounded font-mono uppercase border border-white/5">
                {chartType} Matrix
              </span>
            </div>

            {/* Main Visual Arena */}
            <div className="h-[360px] w-full mt-6 flex items-center justify-center">
              {chartData.length === 0 ? (
                <div className="text-center text-gray-500 space-y-2">
                  <HelpCircle className="h-10 w-10 mx-auto opacity-20" />
                  <p className="text-xs font-medium">No rows match the active filter criteria</p>
                  <button
                    onClick={handleResetFilters}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer font-mono"
                  >
                    Reset slicers
                  </button>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const renderTooltip = (
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111113',
                          borderColor: 'rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      />
                    );

                    switch (chartType) {
                      case 'line':
                        return (
                          <ReLineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c1c1f" />
                            <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                            <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                            {renderTooltip}
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="value" name={yAxisCol} stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </ReLineChart>
                        );
                      case 'area':
                        return (
                          <ReAreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c1c1f" />
                            <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                            <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                            {renderTooltip}
                            <Area type="monotone" dataKey="value" name={yAxisCol} stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                          </ReAreaChart>
                        );
                      case 'pie':
                        return (
                          <RePieChart>
                            <Pie
                              data={chartData.slice(0, 10)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={110}
                              fill="#10b981"
                              dataKey="value"
                              nameKey="name"
                              label={({ name, percent }) => `${name.substring(0, 10)}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                              ))}
                            </Pie>
                            {renderTooltip}
                          </RePieChart>
                        );
                      case 'scatter':
                        return (
                          <ReScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
                            <XAxis dataKey="name" name={xAxisCol} stroke="#52525b" fontSize={10} />
                            <YAxis dataKey="value" name={yAxisCol} stroke="#52525b" fontSize={10} />
                            {renderTooltip}
                            <Scatter name={`${yAxisCol} distribution`} data={chartData} fill="#10b981" />
                          </ReScatterChart>
                        );
                      case 'bar':
                      default:
                        return (
                          <ReBarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c1c1f" />
                            <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                            <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                            {renderTooltip}
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                            <Bar dataKey="value" name={yAxisCol} fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={45}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                              ))}
                            </Bar>
                          </ReBarChart>
                        );
                    }
                  })()}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="text-[10px] text-gray-500 border-t border-white/5 pt-3 flex items-center justify-between font-mono">
            <span>Hover on chart elements for exact values • Filtered subset plot</span>
            <span>Interactive Visualizer Engine</span>
          </div>
        </div>

      </div>
    </div>
  );
}

