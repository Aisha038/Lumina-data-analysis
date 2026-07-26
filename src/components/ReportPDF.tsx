import React, { useRef, useState } from 'react';
import { Download, FileText, CheckCircle, RefreshCw, Eye, Sparkles, Printer, Copy, Check, ExternalLink, FileCode } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Dataset, AIAnalysisReport } from '../types';

interface ReportPDFProps {
  dataset: Dataset;
  analysisReport: AIAnalysisReport | null;
  cleaningReport?: {
    originalCount: number;
    cleanedCount: number;
    duplicatesRemoved: number;
    missingFilled: number;
    appliedSettings: any;
  } | null;
}

export default function ReportPDF({ dataset, analysisReport, cleaningReport }: ReportPDFProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const cleanFileName = (dataset.name || 'dataset').split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_');

  // Method 1: High-res jsPDF + html2canvas generation
  const handleDownloadPDF = async () => {
    setDownloading(true);
    setDownloadUrl(null);
    setStatusMessage(null);

    try {
      setShowPreview(true);
      await new Promise((resolve) => setTimeout(resolve, 350));

      const element = reportRef.current;
      if (!element) {
        throw new Error("Report view element not found.");
      }

      // Capture HTML report as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Fix html2canvas error: "Attempting to parse an unsupported color function 'oklch'"
          const styleElements = clonedDoc.querySelectorAll('style');
          styleElements.forEach((style) => {
            if (style.textContent && style.textContent.includes('oklch')) {
              style.textContent = style.textContent.replace(/oklch\([^)]+\)/gi, '#10b981');
            }
          });

          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((node) => {
            const el = node as HTMLElement;
            
            // Replace oklch in element inline style attribute
            const styleAttr = el.getAttribute('style');
            if (styleAttr && styleAttr.includes('oklch')) {
              el.setAttribute('style', styleAttr.replace(/oklch\([^)]+\)/gi, '#10b981'));
            }

            // Standardize computed styles if browser computes oklch values
            try {
              if (clonedDoc.defaultView) {
                const computed = clonedDoc.defaultView.getComputedStyle(el);
                if (computed.color && computed.color.includes('oklch')) {
                  el.style.color = '#0f172a';
                }
                if (computed.backgroundColor && computed.backgroundColor.includes('oklch')) {
                  el.style.backgroundColor = '#ffffff';
                }
                if (computed.borderColor && computed.borderColor.includes('oklch')) {
                  el.style.borderColor = '#cbd5e1';
                }
              }
            } catch (e) {
              // Ignore computed style read errors
            }
          });
        }
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas rendering produced an empty image.");
      }

      const imgData = canvas.toDataURL('image/png');

      // Standard A4 PDF (210mm x 297mm)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Multi-page handling
      while (heightLeft > 2) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `Executive_Report_${cleanFileName}.pdf`;
      setDownloadFileName(filename);

      // Create Blob URL for direct user clicking
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      setDownloadUrl(blobUrl);

      // Trigger standard PDF save
      pdf.save(filename);

      // Programmatic anchor click fallback
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 500);

      setStatusMessage("PDF successfully generated! If your browser didn't prompt download automatically, click 'Save PDF File' below.");

    } catch (error: any) {
      console.error('Error generating PDF report:', error);
      setStatusMessage(`PDF render alert: ${error?.message || 'Using browser system PDF fallback'}`);
      // Auto fallback to browser print dialog
      handlePrint();
    } finally {
      setDownloading(false);
    }
  };

  // Method 2: System / Browser Native Print to PDF
  const handlePrint = () => {
    setShowPreview(true);
    setStatusMessage("Opening system print dialog... Select 'Save as PDF' as your destination printer.");
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Method 3: Instant HTML Executive Document Download
  const handleDownloadHTML = () => {
    try {
      const reportHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Executive Data Insights Report - ${dataset.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 900px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #0f172a; border-bottom: 3px solid #10b981; padding-bottom: 10px; font-size: 26px; }
    h2 { color: #047857; margin-top: 30px; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; rounded: 8px; display: flex; justify-content: space-between; margin-bottom: 24px; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .stat-card { background: #f1f5f9; padding: 12px; border-radius: 6px; text-align: center; }
    .stat-val { font-size: 20px; font-weight: bold; color: #0f172a; }
    .stat-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .badge { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Executive Data Insights Report</h1>
  <div class="meta-box">
    <div><strong>Dataset:</strong> ${dataset.name}</div>
    <div><strong>Rows:</strong> ${dataset.rowCount} | <strong>Columns:</strong> ${dataset.columns.length}</div>
    <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
  </div>

  ${cleaningReport ? `
    <h2>1. Data Preparation & Hygiene Summary</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-val">${cleaningReport.originalCount}</div><div class="stat-lbl">Original Rows</div></div>
      <div class="stat-card"><div class="stat-val">${cleaningReport.cleanedCount}</div><div class="stat-lbl">Cleaned Rows</div></div>
      <div class="stat-card"><div class="stat-val">${cleaningReport.duplicatesRemoved}</div><div class="stat-lbl">Duplicates Purged</div></div>
      <div class="stat-card"><div class="stat-val">${cleaningReport.missingFilled}</div><div class="stat-lbl">Missing Imputed</div></div>
    </div>
  ` : ''}

  <h2>2. Column Inventory & Data Quality</h2>
  <table>
    <thead>
      <tr><th>Column Name</th><th>Type</th><th>Missing Values</th><th>Unique Values</th></tr>
    </thead>
    <tbody>
      ${dataset.columns.map(c => `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td><span class="badge">${c.type}</span></td>
          <td>${c.missingCount} (${((c.missingCount / dataset.rowCount) * 100).toFixed(1)}%)</td>
          <td>${c.uniqueCount}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${analysisReport ? `
    <h2>3. AI Executive Narrative Summary</h2>
    <p><strong>Executive Overview:</strong> ${analysisReport.datasetOverview}</p>
    
    <h2>4. Key Automated Findings</h2>
    <ul>
      ${analysisReport.keyInsights.map(k => `<li><strong>${k.title}:</strong> ${k.description} ${k.metric ? `(${k.metric})` : ''}</li>`).join('')}
    </ul>

    <h2>5. Operational Recommendations</h2>
    <ul>
      ${analysisReport.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>
  ` : ''}

  <footer style="margin-top: 50px; border-top: 1px solid #e2e8f0; pt: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
    Report compiled via Lumina Data Workspace • ${new Date().toISOString()}
  </footer>
</body>
</html>`;

      const blob = new Blob([reportHtmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const filename = `Executive_Report_${cleanFileName}.html`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 500);

      setStatusMessage(`Downloaded HTML Report document (${filename})! Opens directly in any browser or Word.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Method 4: Copy formatted Markdown text to clipboard
  const handleCopyText = () => {
    let text = `EXECUTIVE DATA INSIGHTS REPORT
Dataset: ${dataset.name}
Date: ${new Date().toLocaleDateString()}
Rows: ${dataset.rowCount} | Columns: ${dataset.columns.length}

=== DATA QUALITY METRICS ===
${dataset.columns.map(c => `- ${c.name} (${c.type}): ${c.missingCount} missing, ${c.uniqueCount} unique`).join('\n')}

`;

    if (cleaningReport) {
      text += `=== CLEANING SUMMARY ===
Original Rows: ${cleaningReport.originalCount}
Cleaned Rows: ${cleaningReport.cleanedCount}
Duplicates Purged: ${cleaningReport.duplicatesRemoved}
Missing Values Imputed: ${cleaningReport.missingFilled}

`;
    }

    if (analysisReport) {
      text += `=== EXECUTIVE OVERVIEW ===
${analysisReport.datasetOverview}

=== KEY FINDINGS ===
${analysisReport.keyInsights.map((k, i) => `${i + 1}. ${k.title}: ${k.description}`).join('\n')}

=== RECOMMENDATIONS ===
${analysisReport.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6" id="pdf-report-module">
      {/* Printable CSS override for System Print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #pdf-printable-area, #pdf-printable-area * {
            visibility: visible;
          }
          #pdf-printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Main Control Panel */}
      <div className="bg-[#111113] border border-white/5 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-500" />
              <h3 className="text-base font-bold text-white font-display">Executive Report Exporter</h3>
            </div>
            <p className="text-xs text-gray-400 max-w-xl leading-relaxed">
              Generate publication-ready reports. Choose between direct PDF download, system print-to-pdf, standalone HTML document, or instant text copy.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {/* Primary Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer font-mono"
            >
              {downloading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Building PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download PDF
                </>
              )}
            </button>

            {/* Print / System PDF Fallback */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white text-xs font-semibold rounded-lg border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Open browser print dialog to save as native PDF"
            >
              <Printer className="h-4 w-4 text-emerald-400" />
              Print / Save PDF
            </button>

            {/* Standalone HTML Export */}
            <button
              onClick={handleDownloadHTML}
              className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white text-xs font-semibold rounded-lg border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Download standalone HTML document file"
            >
              <FileCode className="h-4 w-4 text-cyan-400" />
              Export HTML
            </button>

            {/* Copy Report Text */}
            <button
              onClick={handleCopyText}
              className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white text-xs font-semibold rounded-lg border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-gray-400" />}
              {copied ? "Copied!" : "Copy Text"}
            </button>

            {/* Toggle Preview */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold rounded-lg border border-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
          </div>
        </div>

        {/* Dynamic Status / Fail-safe Download Banner */}
        {statusMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-300 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            {downloadUrl && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={downloadUrl}
                  download={downloadFileName}
                  className="px-3 py-1.5 bg-emerald-500 text-black font-bold text-xs rounded hover:bg-emerald-400 transition-colors flex items-center gap-1 font-mono"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save PDF File Directly
                </a>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-white/10 text-white font-semibold text-xs rounded hover:bg-white/20 transition-colors flex items-center gap-1"
                  title="Open PDF in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Tab
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF Target container */}
      <div className={`${showPreview || downloading ? 'block animate-fade-in' : 'hidden'} border border-white/5 rounded-xl bg-white/5 p-6 md:p-8 max-w-4xl mx-auto overflow-x-auto scrollbar-thin`}>
        
        {/* Printable Paper A4 Frame representation */}
        <div 
          ref={reportRef} 
          id="pdf-printable-area"
          className="bg-white text-slate-800 p-12 shadow-2xl rounded max-w-[800px] mx-auto text-left font-sans border border-slate-200"
          style={{ width: '794px', minHeight: '1123px' }} // Standard A4 ratio in screen pixels
        >
          {/* Header Block */}
          <div className="border-b-2 border-emerald-500 pb-6 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 text-emerald-600">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">Lumina Data Engine</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">EXECUTIVE DATA INSIGHTS REPORT</h1>
              <p className="text-xs text-slate-500 mt-1">Automated Audit, Data Cleaning & Predictive Analysis Summary</p>
            </div>
            <div className="text-right text-xs text-slate-400 font-mono">
              <div>Date: {new Date().toISOString().split('T')[0]}</div>
              <div>Scope: Executive Assessment</div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-6 my-6 p-4 bg-slate-50 rounded border border-slate-100 text-xs">
            <div>
              <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] font-mono">Dataset Audited</span>
              <span className="block font-semibold text-slate-800 mt-0.5 truncate">{dataset.name}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] font-mono">Total Records Compiled</span>
              <span className="block font-semibold text-slate-800 mt-0.5">{dataset.rowCount} Rows</span>
            </div>
            <div>
              <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] font-mono">Analyzed Fields</span>
              <span className="block font-semibold text-slate-800 mt-0.5">{dataset.columns.length} Columns</span>
            </div>
          </div>

          {/* Executive Overview section */}
          {analysisReport ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-100 pb-1.5 mb-2.5 font-mono">
                  1. Executive Overview
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 font-sans">
                  {analysisReport.datasetOverview}
                </p>
              </div>

              {/* Data Quality and Cleaning assessment */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-100 pb-1.5 mb-2.5 font-mono">
                  2. Quality Audit & Cleansing Log
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 mb-3.5">
                  {analysisReport.dataQualityReport}
                </p>

                {cleaningReport && (
                  <table className="w-full text-xs border-collapse border border-slate-100 mt-2 text-left">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-2 border border-slate-100 font-bold">Metric / Step</th>
                        <th className="p-2 border border-slate-100 font-bold">Applied / Cleansed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Original Row Count</td>
                        <td className="p-2 border border-slate-100">{cleaningReport.originalCount}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Post-Cleaning Row Count</td>
                        <td className="p-2 border border-slate-100">{cleaningReport.cleanedCount}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Identical Duplicates Purged</td>
                        <td className="p-2 border border-slate-100 text-emerald-600 font-bold">-{cleaningReport.duplicatesRemoved} rows</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Missing Cell Values Synthesized</td>
                        <td className="p-2 border border-slate-100 text-emerald-600">{cleaningReport.missingFilled} values</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Key Insights bullets */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-100 pb-1.5 mb-2.5 font-mono">
                  3. Primary Trends & Insights
                </h3>
                <div className="space-y-3">
                  {analysisReport.keyInsights.map((insight, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-100">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-slate-800">{insight.title}</h4>
                        {insight.metric && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 rounded-full">{insight.metric}</span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600 mt-1">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategic Actions / Recommendations */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-100 pb-1.5 mb-2.5 font-mono">
                  4. Strategic Recommendations
                </h3>
                <ul className="space-y-2 text-xs">
                  {analysisReport.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-600">
                      <span className="font-bold text-emerald-600 mt-0.5">{idx + 1}.</span>
                      <p className="leading-relaxed">{rec}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Column Inventory and Statistical Summary */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-100 pb-1.5 mb-2.5 font-mono">
                  1. Dataset Column Inventory & Calculated Statistics
                </h3>
                <table className="w-full text-xs border-collapse border border-slate-100 mt-2 text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2 border border-slate-100 font-bold">Column Name</th>
                      <th className="p-2 border border-slate-100 font-bold">Type</th>
                      <th className="p-2 border border-slate-100 font-bold">Missing</th>
                      <th className="p-2 border border-slate-100 font-bold">Mean</th>
                      <th className="p-2 border border-slate-100 font-bold">Median</th>
                      <th className="p-2 border border-slate-100 font-bold">Min / Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {dataset.columns.map((col, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border border-slate-100 font-mono font-semibold text-slate-800">{col.name}</td>
                        <td className="p-2 border border-slate-100 capitalize">{col.type}</td>
                        <td className="p-2 border border-slate-100">{col.missingCount}</td>
                        <td className="p-2 border border-slate-100 font-mono">{col.mean !== undefined ? col.mean : '-'}</td>
                        <td className="p-2 border border-slate-100 font-mono">{col.median !== undefined ? col.median : '-'}</td>
                        <td className="p-2 border border-slate-100 font-mono">
                          {col.min !== undefined && col.max !== undefined ? `${col.min} / ${col.max}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Data Cleansing Log */}
              {cleaningReport && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-100 pb-1.5 mb-2.5 font-mono">
                    2. Quality Audit & Cleansing Log
                  </h3>
                  <table className="w-full text-xs border-collapse border border-slate-100 mt-2 text-left">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-2 border border-slate-100 font-bold">Metric / Step</th>
                        <th className="p-2 border border-slate-100 font-bold">Applied / Cleansed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Original Row Count</td>
                        <td className="p-2 border border-slate-100">{cleaningReport.originalCount}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Post-Cleaning Row Count</td>
                        <td className="p-2 border border-slate-100">{cleaningReport.cleanedCount}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Identical Duplicates Purged</td>
                        <td className="p-2 border border-slate-100 text-emerald-600 font-bold">-{cleaningReport.duplicatesRemoved} rows</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-100 font-mono">Missing Cell Values Synthesized</td>
                        <td className="p-2 border border-slate-100 text-emerald-600">{cleaningReport.missingFilled} values</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-800">
                <strong>Note:</strong> Generate deep AI narrative analysis and strategic recommendations by opening the <strong>AI Narrative Insights</strong> tab.
              </div>
            </div>
          )}

          {/* Footer block */}
          <div className="border-t border-slate-100 mt-12 pt-4 text-center text-[10px] text-slate-400 font-mono">
            This document is generated programmatically on behalf of Lumina Workspace using Gemini 3.5 data summaries.
          </div>
        </div>
      </div>
    </div>
  );
}
