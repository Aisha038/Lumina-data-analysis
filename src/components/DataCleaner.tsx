import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Sparkles, Check, CheckCircle2, RefreshCw, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { Dataset, CleanSettings } from '../types';
import { calculateMetadata, cleanDataset } from '../utils/dataCleanerUtils';

interface DataCleanerProps {
  onDatasetLoaded: (dataset: Dataset, isCleaned: boolean, cleaningReport?: any) => void;
  currentDataset: Dataset | null;
}

// Sample Datasets for quick playground-ing
const SAMPLE_DATASETS = {
  sales: {
    name: "sales_unclean_sample.xlsx",
    data: [
      { "  Order ID  ": "1001", "Product Category": "Electronics", "Units Sold": 5, "Unit Price": 120.00, "Sale Date": "2026-05-12", "Customer Email": "john@example.com", "Discount Applied": "TRUE" },
      { "  Order ID  ": "1002", "Product Category": "Apparel", "Units Sold": 12, "Unit Price": 25.50, "Sale Date": "2026-05-13", "Customer Email": "sarah@gmail.com", "Discount Applied": "FALSE" },
      { "  Order ID  ": "1003", "Product Category": "Electronics", "Units Sold": "", "Unit Price": 450.00, "Sale Date": "2026-05-14", "Customer Email": "alex_unverified", "Discount Applied": "" },
      { "  Order ID  ": "1004", "Product Category": "Home & Kitchen", "Units Sold": 2, "Unit Price": 89.99, "Sale Date": "2026/05/15", "Customer Email": "", "Discount Applied": "FALSE" },
      { "  Order ID  ": "1001", "Product Category": "Electronics", "Units Sold": 5, "Unit Price": 120.00, "Sale Date": "2026-05-12", "Customer Email": "john@example.com", "Discount Applied": "TRUE" }, // duplicate
      { "  Order ID  ": "1005", "Product Category": "Apparel", "Units Sold": 8, "Unit Price": "", "Sale Date": "2026-05-16", "Customer Email": "emma@design.co", "Discount Applied": "TRUE" },
      { "  Order ID  ": "1006", "Product Category": "Home & Kitchen", "Units Sold": 1, "Unit Price": 15.00, "Sale Date": "2026-05-17", "Customer Email": "john@example.com", "Discount Applied": "FALSE" },
      { "  Order ID  ": "1007", "Product Category": "Electronics", "Units Sold": 10, "Unit Price": 110.00, "Sale Date": "2026-05-18", "Customer Email": "mark@tech.io", "Discount Applied": "TRUE" },
      { "  Order ID  ": "1007", "Product Category": "Electronics", "Units Sold": 10, "Unit Price": 110.00, "Sale Date": "2026-05-18", "Customer Email": "mark@tech.io", "Discount Applied": "TRUE" } // duplicate
    ]
  },
  employee: {
    name: "hr_roster_messy.csv",
    data: [
      { "Employee_ID": "EMP01", "Full Name": "Robert Downey", "Department": "Engineering", "Salary": 115000, "Hire Date": "2021-03-10", "Status": "Active" },
      { "Employee_ID": "EMP02", "Full Name": "Scarlett Johansson", "Department": "Marketing", "Salary": "", "Hire Date": "2019/11/04", "Status": "Active" },
      { "Employee_ID": "EMP03", "Full Name": "Chris Evans", "Department": "Sales", "Salary": 85000, "Hire Date": "2020-08-15", "Status": "On Leave" },
      { "Employee_ID": "EMP04", "Full Name": "Chris Hemsworth", "Department": "Engineering", "Salary": 120000, "Hire Date": "", "Status": "Active" },
      { "Employee_ID": "EMP01", "Full Name": "Robert Downey", "Department": "Engineering", "Salary": 115000, "Hire Date": "2021-03-10", "Status": "Active" }, // duplicate
      { "Employee_ID": "EMP05", "Full Name": "Mark Ruffalo", "Department": "", "Salary": 95000, "Hire Date": "2022-01-22", "Status": "Terminated" },
      { "Employee_ID": "EMP06", "Full Name": "Jeremy Renner", "Department": "Sales", "Salary": 80000, "Hire Date": "2018-06-30", "Status": "" }
    ]
  }
};

export default function DataCleaner({ onDatasetLoaded, currentDataset }: DataCleanerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default cleaning settings
  const [settings, setSettings] = useState<CleanSettings>({
    removeDuplicates: true,
    trimWhitespace: true,
    fillMissingNumbers: 'mean',
    fillMissingStrings: 'na',
    parseDates: true,
    normalizeHeaders: true
  });

  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null);

  const getLiveFillValue = (colName: string) => {
    if (!currentDataset) return null;
    const colMeta = currentDataset.columns.find(c => c.name === colName);
    if (!colMeta) return null;

    if (colMeta.type === 'number') {
      if (settings.fillMissingNumbers === 'mean') {
        return { value: colMeta.mean !== undefined ? colMeta.mean : 0, type: 'mean' };
      }
      if (settings.fillMissingNumbers === 'median') {
        return { value: colMeta.median !== undefined ? colMeta.median : 0, type: 'median' };
      }
      if (settings.fillMissingNumbers === 'zero') {
        return { value: 0, type: 'zero' };
      }
    } else if (colMeta.type === 'string') {
      if (settings.fillMissingStrings === 'na') {
        return { value: 'N/A', type: 'na' };
      }
      if (settings.fillMissingStrings === 'empty') {
        return { value: '', type: 'empty' };
      }
    }
    return null;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV/Excel
  const handleFileParsing = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      setError("Unsupported format. Please upload a valid .csv, .xlsx, or .xls spreadsheet file.");
      return;
    }

    setLoading(true);
    setError(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("Could not read any data from this file.");
        }
        
        const arrayBuffer = data as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        
        if (!firstSheetName) {
          throw new Error("This workbook does not contain any sheets.");
        }
        
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          throw new Error("The worksheet could not be parsed.");
        }
        
        // Convert sheet to json
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          throw new Error("The selected sheet contains no readable data rows.");
        }

        const columns = calculateMetadata(jsonData);
        const dataset: Dataset = {
          name: file.name,
          rows: jsonData,
          columns,
          rowCount: jsonData.length
        };

        onDatasetLoaded(dataset, false); // false = not cleaned yet
      } catch (err: any) {
        console.error("Parsing Error:", err);
        setError(err?.message || "Failed to parse file. Please upload a valid CSV or Excel sheet.");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("File reading error occurred.");
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileParsing(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileParsing(e.target.files[0]);
    }
  };

  const loadSample = (key: 'sales' | 'employee') => {
    const sample = SAMPLE_DATASETS[key];
    const columns = calculateMetadata(sample.data);
    const dataset: Dataset = {
      name: sample.name,
      rows: sample.data,
      columns,
      rowCount: sample.data.length
    };
    setSelectedColumnName(null);
    onDatasetLoaded(dataset, false);
  };

  // Run the cleaning algorithm
  const handleCleanData = () => {
    if (!currentDataset) return;
    setLoading(true);

    setTimeout(() => {
      const { cleanedRows, stats } = cleanDataset(currentDataset.rows, settings);
      const cleanedColumns = calculateMetadata(cleanedRows);
      
      const cleanedDataset: Dataset = {
        name: currentDataset.name,
        rows: cleanedRows,
        columns: cleanedColumns,
        rowCount: cleanedRows.length
      };

      const cleaningReport = {
        originalCount: currentDataset.rowCount,
        cleanedCount: cleanedRows.length,
        duplicatesRemoved: stats.duplicatesRemoved,
        missingFilled: stats.missingFilled,
        appliedSettings: { ...settings }
      };

      setSelectedColumnName(null);
      onDatasetLoaded(cleanedDataset, true, cleaningReport);
      setLoading(false);
    }, 600); // Add smooth little delay to feel like the cleaning logic is working deeply!
  };

  return (
    <div className="space-y-8" id="data-cleaner-module">
      {/* Step 1: Upload or Display Raw Dataset */}
      {!currentDataset ? (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Welcome / Get Started Hero Card */}
          <div className="bg-[#111113] border border-emerald-500/20 rounded-xl p-8 text-center relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold rounded-full mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Automated Data Refining & Executive Reports
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-white font-display tracking-tight">
              Transform Messy Spreadsheets Into <span className="text-emerald-400">Publication-Ready Reports</span>
            </h2>

            <p className="text-xs md:text-sm text-gray-400 max-w-xl mx-auto mt-3 leading-relaxed">
              Clean duplicates, impute missing values, filter with interactive slicers, generate AI insights, and export formatted executive PDF reports in seconds.
            </p>

            <div className="flex flex-wrap justify-center items-center gap-3 mt-6">
              <button
                id="get-started-sample-btn"
                onClick={() => loadSample('sales')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center gap-2 font-mono"
              >
                <Sparkles className="h-4 w-4" />
                Get Started (Load Sample Sales Data)
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white text-xs font-semibold rounded-lg border border-white/10 transition-all cursor-pointer flex items-center gap-2"
              >
                <Upload className="h-4 w-4 text-emerald-400" />
                Upload Custom CSV / Excel
              </button>
            </div>
          </div>

          {/* Main Drag-Drop Upload Area */}
          <div
            id="drag-drop-container"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              dragActive 
                ? 'border-emerald-500 bg-emerald-500/5' 
                : 'border-white/10 hover:border-emerald-500/40 bg-[#111113]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileInput}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white font-display">Or Drop Your Own Spreadsheet File Here</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV datasets
                </p>
              </div>

              <span className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded border border-white/10 transition-colors inline-block mt-2">
                Browse System Files
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-950/25 text-red-400 rounded-lg flex items-start gap-3 border border-red-900/30">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm font-mono">{error}</div>
            </div>
          )}

          {/* Quick Play Sample Datasets */}
          <div className="pt-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-mono">
              Quick Test Datasets
            </p>
            <div className="flex justify-center gap-3 mt-3">
              <button
                onClick={() => loadSample('sales')}
                className="px-3.5 py-1.5 bg-[#111113] hover:bg-emerald-500/10 text-gray-300 hover:text-white text-xs font-medium rounded border border-white/5 hover:border-emerald-500/20 transition-all cursor-pointer font-mono"
              >
                📊 Messy Sales Ledger
              </button>
              <button
                onClick={() => loadSample('employee')}
                className="px-3.5 py-1.5 bg-[#111113] hover:bg-emerald-500/10 text-gray-300 hover:text-white text-xs font-medium rounded border border-white/5 hover:border-emerald-500/20 transition-all cursor-pointer font-mono"
              >
                👥 HR Roster
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel - Cleaning Settings & Controls (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#111113] border border-white/5 rounded-xl p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest font-mono">
                    Step 1: Configuration
                  </div>
                  <h3 className="text-base font-semibold text-white font-display mt-1">
                    Select Data Cleaning Rules
                  </h3>
                </div>
                <button
                  onClick={() => onDatasetLoaded(null as any, false)}
                  className="p-1.5 hover:bg-white/5 text-gray-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                  title="Clear uploaded file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Cleaning Checkboxes / Toggles */}
              <div className="space-y-3">
                {/* 1. Normalize Header names */}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                  <input
                    type="checkbox"
                    checked={settings.normalizeHeaders}
                    onChange={(e) => setSettings({ ...settings, normalizeHeaders: e.target.checked })}
                    className="h-4 w-4 mt-0.5 rounded border-white/10 text-emerald-600 bg-white/5 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      Standardize column headers
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                      Trims spaces, lowercases, and replaces non-alphanumeric characters with underscores (e.g. "  Order ID  " → "order_id").
                    </span>
                  </div>
                </label>

                {/* 2. Remove Duplicates */}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                  <input
                    type="checkbox"
                    checked={settings.removeDuplicates}
                    onChange={(e) => setSettings({ ...settings, removeDuplicates: e.target.checked })}
                    className="h-4 w-4 mt-0.5 rounded border-white/10 text-emerald-600 bg-white/5 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      Deduplicate records
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                      Identifies and purges completely identical rows automatically.
                    </span>
                  </div>
                </label>

                {/* 3. Trim Whitespaces */}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                  <input
                    type="checkbox"
                    checked={settings.trimWhitespace}
                    onChange={(e) => setSettings({ ...settings, trimWhitespace: e.target.checked })}
                    className="h-4 w-4 mt-0.5 rounded border-white/10 text-emerald-600 bg-white/5 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      Trim cell text whitespace
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                      Strips trailing or double spaces inside text cells to normalize entries.
                    </span>
                  </div>
                </label>

                {/* 4. Date formatting */}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                  <input
                    type="checkbox"
                    checked={settings.parseDates}
                    onChange={(e) => setSettings({ ...settings, parseDates: e.target.checked })}
                    className="h-4 w-4 mt-0.5 rounded border-white/10 text-emerald-600 bg-white/5 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      Standardize date strings
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                      Auto-detects varied date formats (e.g., "YYYY/MM/DD", US formats) and standardizes them into standard "YYYY-MM-DD".
                    </span>
                  </div>
                </label>

                {/* 5. Fill Missing Numbers */}
                <div className="p-3.5 rounded-lg border border-white/5 bg-white/5 space-y-2">
                  <span className="block text-xs font-semibold text-white">
                    Handle missing numeric fields
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { key: 'mean', label: 'Mean' },
                      { key: 'median', label: 'Median' },
                      { key: 'zero', label: 'Zero (0)' },
                      { key: 'none', label: 'None' }
                    ].map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSettings({ ...settings, fillMissingNumbers: opt.key as any })}
                        className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
                          settings.fillMissingNumbers === opt.key
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-white/5 border border-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Fill Missing Strings */}
                <div className="p-3.5 rounded-lg border border-white/5 bg-white/5 space-y-2">
                  <span className="block text-xs font-semibold text-white">
                    Handle missing text fields
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'na', label: 'Set "N/A"' },
                      { key: 'empty', label: 'Leave Empty' },
                      { key: 'none', label: 'None' }
                    ].map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSettings({ ...settings, fillMissingStrings: opt.key as any })}
                        className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
                          settings.fillMissingStrings === opt.key
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-white/5 border border-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleCleanData}
                disabled={loading}
                className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Cleaning & Standardizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-emerald-200" />
                    Run Data Purge & Clean
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right panel - Data Preview Table & Raw Statistics (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#111113] border border-white/5 rounded-xl p-6 overflow-hidden flex flex-col max-h-[650px]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-white/5">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2 font-display">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    Dataset Preview: <span className="font-mono text-[10px] px-2 py-0.5 bg-white/5 text-emerald-400 rounded font-normal border border-white/5">{currentDataset.name}</span>
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Inspecting first 10 rows • {currentDataset.rowCount} rows detected
                  </p>
                </div>
              </div>

              {/* Data Grid Table */}
              <div className="overflow-x-auto mt-4 border border-white/5 rounded-lg flex-grow overflow-y-auto scrollbar-thin">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#0B0B0C] text-gray-300 sticky top-0">
                    <tr>
                      {Object.keys(currentDataset.rows[0] || {}).map((col, index) => (
                        <th key={index} className="px-4 py-3 font-semibold border-b border-white/5 font-mono text-[11px] text-gray-400">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {currentDataset.rows.slice(0, 10).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-white/5">
                        {Object.keys(currentDataset.rows[0] || {}).map((col, colIndex) => {
                          const val = row[col];
                          const isNull = val === null || val === undefined || val === '';
                          
                          if (isNull) {
                            const fill = getLiveFillValue(col);
                            const colMeta = currentDataset.columns.find(c => c.name === col);
                            const isNumeric = colMeta?.type === 'number';
                            const isString = colMeta?.type === 'string';
                            const shouldFill = fill && (
                              (isNumeric && settings.fillMissingNumbers !== 'none') ||
                              (isString && settings.fillMissingStrings !== 'none')
                            );

                            if (shouldFill && fill) {
                              return (
                                <td
                                  key={colIndex}
                                  className="px-4 py-2.5 font-sans truncate max-w-[200px] bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-400 italic font-medium"
                                  title={`Empty cell - Will be filled with ${fill.type} value: ${fill.value}`}
                                >
                                  {fill.value} <span className="text-[9px] uppercase tracking-wider font-mono opacity-60">({fill.type})</span>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={colIndex}
                                className="px-4 py-2.5 font-sans truncate max-w-[200px] bg-amber-500/5 text-amber-400 italic"
                              >
                                empty
                              </td>
                            );
                          }

                          return (
                            <td
                              key={colIndex}
                              className="px-4 py-2.5 font-sans truncate max-w-[200px]"
                            >
                              {String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Raw Columns Metadata stats at the bottom of the grid */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 font-mono">Column Data Inference & Quality</h5>
                <p className="text-[11px] text-gray-400 mb-3">Click on any column to view its calculated statistics (Mean, Median, Min/Max, etc.)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {currentDataset.columns.map((col, index) => {
                    const isSelected = selectedColumnName === col.name;
                    return (
                      <div
                        key={index}
                        onClick={() => setSelectedColumnName(isSelected ? null : col.name)}
                        className={`p-2.5 rounded border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/5'
                            : 'bg-white/5 border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5'
                        }`}
                      >
                        <span className="block text-xs font-semibold text-white truncate font-mono" title={col.name}>
                          {col.name}
                        </span>
                        <div className="flex justify-between items-center mt-1.5 text-[10px]">
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-medium capitalize font-mono text-[9px]">
                            {col.type}
                          </span>
                          {col.missingCount > 0 ? (
                            <span className="text-amber-400 font-semibold flex items-center gap-0.5 font-mono">
                              <AlertCircle className="h-2.5 w-2.5" />
                              {col.missingCount} empty
                            </span>
                          ) : (
                            <span className="text-emerald-500 font-bold font-mono">100% ok</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Column Detail Panel */}
                {selectedColumnName && (
                  (() => {
                    const col = currentDataset.columns.find(c => c.name === selectedColumnName);
                    if (!col) return null;
                    const missingPercent = ((col.missingCount / currentDataset.rowCount) * 100).toFixed(1);
                    return (
                      <div className="mt-4 p-4 bg-[#141416] border border-emerald-500/20 rounded-lg space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-emerald-400">{col.name}</span>
                            <span className="px-1.5 py-0.5 bg-white/5 text-gray-300 text-[9px] font-mono rounded uppercase">{col.type} Statistics</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedColumnName(null)}
                            className="text-[10px] text-gray-500 hover:text-white font-mono cursor-pointer"
                          >
                            ✕ Close Stats
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                          <div className="p-2 bg-white/5 rounded border border-white/5">
                            <span className="block text-[9px] text-gray-500 uppercase tracking-wider font-mono">Total Rows</span>
                            <span className="block font-semibold text-white mt-0.5">{currentDataset.rowCount}</span>
                          </div>
                          <div className="p-2 bg-white/5 rounded border border-white/5">
                            <span className="block text-[9px] text-gray-500 uppercase tracking-wider font-mono">Missing Values</span>
                            <span className={`block font-semibold mt-0.5 ${col.missingCount > 0 ? 'text-amber-400' : 'text-emerald-500'}`}>
                              {col.missingCount} ({missingPercent}%)
                            </span>
                          </div>
                          <div className="p-2 bg-white/5 rounded border border-white/5">
                            <span className="block text-[9px] text-gray-500 uppercase tracking-wider font-mono">Unique Values</span>
                            <span className="block font-semibold text-white mt-0.5">{col.uniqueCount}</span>
                          </div>
                          {col.type === 'number' && (
                            <>
                              <div className="p-2 bg-white/5 rounded border border-white/5">
                                <span className="block text-[9px] text-gray-500 uppercase tracking-wider font-mono">Minimum</span>
                                <span className="block font-semibold text-white mt-0.5">{col.min !== undefined ? col.min : 'N/A'}</span>
                              </div>
                              <div className="p-2 bg-white/5 rounded border border-white/5">
                                <span className="block text-[9px] text-gray-500 uppercase tracking-wider font-mono">Maximum</span>
                                <span className="block font-semibold text-white mt-0.5">{col.max !== undefined ? col.max : 'N/A'}</span>
                              </div>
                              <div className="p-2.5 bg-emerald-500/5 rounded border border-emerald-500/20 col-span-2 sm:col-span-1">
                                <span className="block text-[9px] text-emerald-400 uppercase tracking-wider font-mono font-bold">Calculated Mean</span>
                                <span className="block font-bold text-white mt-0.5 text-sm font-mono">{col.mean !== undefined ? col.mean : 'N/A'}</span>
                              </div>
                              <div className="p-2.5 bg-emerald-500/5 rounded border border-emerald-500/20 col-span-2 sm:col-span-1">
                                <span className="block text-[9px] text-emerald-400 uppercase tracking-wider font-mono font-bold">Calculated Median</span>
                                <span className="block font-bold text-white mt-0.5 text-sm font-mono">{col.median !== undefined ? col.median : 'N/A'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
