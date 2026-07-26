import React, { useEffect, useState } from 'react';
import { Sparkles, Brain, Lightbulb, ShieldAlert, LineChart, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Dataset, AIAnalysisReport } from '../types';

interface DataInsightsProps {
  dataset: Dataset;
  analysisReport: AIAnalysisReport | null;
  onAnalysisComplete: (report: AIAnalysisReport) => void;
  cleaningReport?: {
    originalCount: number;
    cleanedCount: number;
    duplicatesRemoved: number;
    missingFilled: number;
    appliedSettings: any;
  } | null;
}

export default function DataInsights({
  dataset,
  analysisReport,
  onAnalysisComplete,
  cleaningReport
}: DataInsightsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhrase, setLoadingPhrase] = useState("Initializing analyzer...");

  const loadingPhrases = [
    "Reading column types and structures...",
    "Scanning dataset for statistical anomalies...",
    "Consulting Gemini AI to extract key business indicators...",
    "Summarizing data distributions & categories...",
    "Drafting action-oriented business recommendations...",
    "Selecting ideal visualization patterns..."
  ];

  // Rotate loading phrases for maximum premium feel
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % loadingPhrases.length;
      setLoadingPhrase(loadingPhrases[i]);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  const triggerAIAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Prepare lightweight payloads
      const columnsPayload = dataset.columns.map(col => ({
        name: col.name,
        type: col.type,
        missingValues: col.missingCount,
        uniqueValues: col.uniqueCount,
        min: col.min,
        max: col.max,
        mean: col.mean
      }));

      const summaryStats = {
        rowCount: dataset.rowCount,
        numericalColumnsCount: dataset.columns.filter(c => c.type === 'number').length,
        categoricalColumnsCount: dataset.columns.filter(c => c.type === 'string').length,
        dateColumnsCount: dataset.columns.filter(c => c.type === 'date').length,
      };

      // Send first 15 sample rows for actual data preview
      const sampleRows = dataset.rows.slice(0, 15);

      // 2. Query fullstack server
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: dataset.name,
          columns: columnsPayload,
          rowCount: dataset.rowCount,
          summaryStats,
          sampleRows
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Server failed to analyze dataset");
      }

      const report: AIAnalysisReport = await response.json();
      onAnalysisComplete(report);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not complete AI analysis. Check your Gemini API Key configuration.");
    } finally {
      setLoading(false);
    }
  };

  // Run auto analysis if report doesn't exist yet
  useEffect(() => {
    if (!analysisReport && dataset) {
      triggerAIAnalysis();
    }
  }, [dataset, analysisReport]);

  if (loading) {
    return (
      <div className="bg-[#111113] border border-white/5 rounded-xl p-12 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full animate-pulse">
              <Brain className="h-10 w-10 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <Sparkles className="h-5 w-5 text-emerald-500 absolute -top-1 -right-1 animate-bounce" />
          </div>
          <div className="max-w-md">
            <h4 className="text-sm font-semibold text-white font-display">AI Analytics Agent is working</h4>
            <p className="text-xs text-gray-400 font-mono mt-2 animate-pulse">
              {loadingPhrase}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#111113] border border-white/5 rounded-xl p-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/10">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="max-w-md">
            <h4 className="text-sm font-semibold text-white font-display">AI Report Offline</h4>
            <p className="text-xs text-gray-400 mt-1">
              We couldn't connect with the AI Server. Please ensure your Gemini API Key is configured.
            </p>
            <p className="text-[11px] text-red-400 font-mono mt-2 p-2 bg-red-950/20 border border-red-900/30 rounded">
              {error}
            </p>
          </div>
          <button
            onClick={triggerAIAnalysis}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry AI Summary
          </button>
        </div>
      </div>
    );
  }

  if (!analysisReport) return null;

  return (
    <div className="space-y-8" id="ai-insights-module">
      {/* 1. Overview Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Dataset Summary card */}
        <div className="md:col-span-8 bg-[#111113] border border-white/5 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Brain className="h-28 w-28 text-emerald-500" />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white font-display">AI Executive Summary</h3>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-sans">
            {analysisReport.datasetOverview}
          </p>

          {/* Cleaning feedback */}
          {cleaningReport && (
            <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Rows Before/After</span>
                <span className="block text-sm font-semibold text-white mt-0.5 font-mono">
                  {cleaningReport.originalCount} → {cleaningReport.cleanedCount}
                </span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Duplicates Removed</span>
                <span className="block text-sm font-semibold text-emerald-400 mt-0.5 font-mono">
                  {cleaningReport.duplicatesRemoved} rows
                </span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Missing Values Fixed</span>
                <span className="block text-sm font-semibold text-emerald-400 mt-0.5 font-mono">
                  {cleaningReport.missingFilled} cells
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Column Health Report */}
        <div className="md:col-span-4 bg-[#111113] border border-white/5 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-white font-display">Data Quality Audit</h3>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed font-mono bg-white/5 p-4 rounded border border-white/5">
              {analysisReport.dataQualityReport}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 text-[10px] text-gray-500 font-mono">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Dataset is prepared & aligned.</span>
          </div>
        </div>
      </div>

      {/* 2. Key Insights Grid */}
      <div>
        <h4 className="text-sm font-semibold text-white font-display mb-4 flex items-center gap-2 uppercase tracking-widest">
          <LineChart className="h-4 w-4 text-emerald-500" />
          Primary Insights & Key Trends
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analysisReport.keyInsights.map((insight, idx) => (
            <div
              key={idx}
              className="bg-[#111113] border border-white/5 rounded-xl p-5 hover:border-emerald-500/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{insight.title}</h5>
                  {insight.metric && (
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-mono shrink-0">
                      {insight.metric}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                  {insight.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Actions / Recommendations */}
      <div className="bg-[#111113] border border-emerald-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Lightbulb className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-white font-display">Actionable Strategic Recommendations</h3>
        </div>

        <ul className="space-y-3">
          {analysisReport.recommendations.map((rec, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="flex items-center justify-center h-5 w-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded mt-0.5 shrink-0">
                {idx + 1}
              </span>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">{rec}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
