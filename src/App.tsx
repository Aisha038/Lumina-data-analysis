import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Sparkles, 
  LayoutDashboard, 
  BrainCircuit, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  FileSpreadsheet, 
  ArrowLeftRight 
} from 'lucide-react';

import { Dataset, AIAnalysisReport } from './types';
import DataCleaner from './components/DataCleaner';
import DataDashboard from './components/DataDashboard';
import DataInsights from './components/DataInsights';
import ReportPDF from './components/ReportPDF';

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [isCleaned, setIsCleaned] = useState(false);
  const [activeTab, setActiveTab] = useState<'clean' | 'dashboard' | 'insights' | 'pdf'>('clean');
  
  // Stored analysis report once fetched to avoid redundant calls
  const [analysisReport, setAnalysisReport] = useState<AIAnalysisReport | null>(null);
  const [cleaningReport, setCleaningReport] = useState<{
    originalCount: number;
    cleanedCount: number;
    duplicatesRemoved: number;
    missingFilled: number;
    appliedSettings: any;
  } | null>(null);

  // When a new file is uploaded or cleaned
  const handleDatasetLoaded = (newDataset: Dataset, cleanedStatus: boolean, report?: any) => {
    setDataset(newDataset);
    setIsCleaned(cleanedStatus);

    if (cleanedStatus) {
      setCleaningReport(report || null);
      setAnalysisReport(null); // Reset AI report so it regenerates for the new clean data
      setActiveTab('dashboard'); // Transition immediately to dashboard upon successful cleaning
    } else {
      setCleaningReport(null);
      setAnalysisReport(null);
      setActiveTab('clean');
    }
  };

  const handleReset = () => {
    setDataset(null);
    setIsCleaned(false);
    setAnalysisReport(null);
    setCleaningReport(null);
    setActiveTab('clean');
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C] font-sans text-gray-300 flex flex-col" id="applet-root">
      {/* Top Professional Banner */}
      <header className="bg-[#111113] border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-sm flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <div className="w-4 h-4 bg-[#0B0B0C] rotate-45"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-wider text-white font-display">LUMINA <span className="text-emerald-500">DATA</span></h1>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-widest font-mono">
                  CLEANSE ENGINE
                </span>
              </div>
              <p className="text-xs text-gray-500 font-sans mt-0.5">Spreadsheet refiner, automated statistical visuals & pdf exporter</p>
            </div>
          </div>

          {/* Active File Metadata Badge or Get Started CTA */}
          {dataset ? (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2.5 rounded-lg text-xs">
              <div className="p-1 bg-white/5 border border-white/10 text-emerald-400 rounded">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block font-semibold text-white truncate max-w-[150px] font-mono" title={dataset.name}>
                  {dataset.name}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5 font-mono">
                  {dataset.rowCount} rows • {dataset.columns.length} columns
                  {isCleaned && (
                    <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Cleaned
                    </span>
                  )}
                </span>
              </div>
              <button
                onClick={handleReset}
                className="ml-2 text-[10px] bg-red-950/30 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded border border-red-900/30 transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden md:inline">Ready to refine your data?</span>
              <button
                onClick={() => {
                  // Dispatch click on sample loader or file input
                  const btn = document.getElementById('get-started-sample-btn');
                  if (btn) btn.click();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Get Started
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main workspace container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 flex flex-col space-y-6">
        
        {/* Workspace Tab bar (When dataset is parsed and loaded) */}
        {dataset && (
          <div className="flex border-b border-white/5 gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
            {[
              { id: 'clean', label: 'Preparation & Cleanse', icon: ArrowLeftRight, badge: isCleaned ? "Active" : "Pending" },
              { id: 'dashboard', label: 'Visual Dashboard', icon: LayoutDashboard, disabled: !isCleaned },
              { id: 'insights', label: 'AI Narrative Insights', icon: BrainCircuit, disabled: !isCleaned, badge: analysisReport ? "Summarized" : undefined },
              { id: 'pdf', label: 'Executive Report PDF', icon: FileText, disabled: !isCleaned }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id as any)}
                  disabled={tab.disabled}
                  className={`px-5 py-3.5 text-xs font-semibold border-b-2 flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap outline-none ${
                    isActive
                      ? 'border-emerald-500 text-white font-bold bg-[#111113] rounded-t-lg'
                      : tab.disabled
                        ? 'border-transparent text-gray-700 cursor-not-allowed opacity-40'
                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-500' : ''}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${
                      tab.id === 'clean' && isCleaned
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* View Switcher wrapper */}
        <div className="flex-grow">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (dataset ? dataset.name : 'empty')}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="h-full"
            >
              {activeTab === 'clean' && (
                <DataCleaner 
                  onDatasetLoaded={handleDatasetLoaded} 
                  currentDataset={dataset} 
                />
              )}

              {activeTab === 'dashboard' && dataset && (
                <DataDashboard 
                  dataset={dataset} 
                  analysisReport={analysisReport} 
                  onNavigateToTab={setActiveTab}
                />
              )}

              {activeTab === 'insights' && dataset && (
                <DataInsights 
                  dataset={dataset} 
                  analysisReport={analysisReport} 
                  onAnalysisComplete={setAnalysisReport}
                  cleaningReport={cleaningReport}
                />
              )}

              {activeTab === 'pdf' && dataset && (
                <ReportPDF 
                  dataset={dataset} 
                  analysisReport={analysisReport}
                  cleaningReport={cleaningReport}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="bg-[#111113] border-t border-white/5 py-6 text-center text-xs text-gray-600 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>© 2026 LUMINA DATA Workspace. Secure client-first workbook refining.</span>
          <span className="flex items-center gap-1 text-[10px] bg-white/5 text-gray-400 px-2.5 py-1 rounded border border-white/5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Vite 6 + Recharts + Gemini 3.5 Active
          </span>
        </div>
      </footer>
    </div>
  );
}
