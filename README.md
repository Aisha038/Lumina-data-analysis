# 📊 Data Cleaner & Dashboard (Lumina Data Workspace)

> **Transform messy, unformatted spreadsheets into clean datasets, interactive visual dashboards, and publication-ready executive PDF reports in seconds.**

---

## 📸 App in Action
DEPLOYMENT LINK
https://lumina-data-analysis.vercel.app/

![Data Cleaner & Dashboard Screenshot](./src/assets/images/dashboard_screenshot_1785086946828.jpg)

---

## 🚀 What It Does

**Data Cleaner & Dashboard** is a full-stack, browser-powered data engineering and analytics workspace. It allows users to upload raw spreadsheets (CSV or Microsoft Excel), inspect data health, execute automated and custom cleaning rules, explore interactive visual charts with dynamic slicers, generate C-level AI narrative insights via Gemini, and export formatted executive reports in PDF, HTML, or Markdown format.

---

## 💡 The Real Problem It Solves

1. **Unproductive Hours Spent on Spreadsheet Cleaning**:
   - Data teams, business analysts, and managers spend up to **80% of their time** manually fixing duplicate rows, blank cells, broken column types, and formatting errors in raw Excel files.
2. **Fragmented Analytics Tools**:
   - Users typically have to switch between Excel/Python for cleaning, PowerBI/Tableau for charts, and PowerPoint/Word for report generation.
3. **Lack of Automated Executive Summaries**:
   - Raw data doesn't tell a story. Translating numerical trends into actionable recommendations usually requires manual writing.
4. **Export Failures & Formatting Issues**:
   - Generating high-resolution PDF reports that look uniform across devices and browsers is notoriously difficult.

### 🌟 How Lumina Solves It:
- **All-in-One Pipeline**: Upload, clean, visualize, analyze, and export—all in one unified interface.
- **Instant Data Hygiene**: Automatically detect and purge duplicate records, fill missing values, and standardize column types with one click.
- **AI Executive Insights**: Server-side Gemini integration automatically reads dataset metadata to produce key operational takeaways and strategic recommendations.
- **Bulletproof Multi-Format Exporter**: Export publication-grade A4 PDF documents with fallbacks for system print-to-pdf, standalone HTML files, and direct Markdown text.

---

## ✨ Feature List

### 📁 1. Spreadsheet Ingestion & Data Parsing
- **Universal Drag & Drop**: Drop `.csv`, `.xlsx`, or `.xls` files directly into the workspace.
- **Smart Schema Detection**: Automatic type inference for numerical, categorical, date, and text columns.
- **Sample Datasets Included**: Pre-loaded messy sales ledger and HR roster datasets for quick testing.

### 🧹 2. Automated Data Cleaning & Hygiene
- **Duplicate Purging**: One-click detection and removal of repeated records.
- **Smart Missing Value Imputation**: Fill blanks using column mean, median, mode, constant value, or drop incomplete rows.
- **Text & Case Normalization**: Strip trailing whitespace, convert to uppercase/lowercase, and fix broken text encodings.
- **Column Management**: Rename, reorder, or drop irrelevent columns on the fly.
- **Real-Time Audit Metrics**: Track original row count, cleaned row count, duplicates purged, and missing fields fixed.

### 📊 3. Interactive Data Dashboard & Exploration
- **KPI Summary Cards**: Live tracking of row counts, column counts, data quality score, and field distributions.
- **Dynamic Slicers & Filtering**: Filter dataset rows interactively across single or multiple column conditions.
- **Custom Visualizations**: Built-in Recharts for Bar Charts, Line Graphs, Pie Charts, Scatter Plots, and Area Charts.
- **Search & Pagination**: Instant global text search, column sorting, and responsive table navigation.

### 🤖 4. AI Narrative & Predictive Insights
- **Powered by Gemini AI**: Server-side proxy computes data metrics and produces high-level executive narrative overviews.
- **Automated Trend Detection**: Highlights key anomalies, top performers, and correlation patterns.
- **Actionable Recommendations**: Bulleted operational takeaways tailored for C-suite decision-making.

### 📄 5. Multi-Format Executive Exporter
- **A4 PDF Document Exporter**: Standardized high-resolution PDF export with `oklch` color parsing compatibility.
- **Print / System PDF Fallback**: Built-in browser print overlay formatted specifically for PDF printing.
- **Standalone HTML Export**: Download self-contained HTML reports playable in any web browser or document editor.
- **Copyable Markdown Text**: Instant clipboard copying of key findings and structured data tables.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts
- **Data Engines**: SheetJS (XLSX), PapaParse, html2canvas, jsPDF
- **Backend / AI**: Express server proxy, Google Gemini API (`@google/genai` SDK)
- **Styling & Design**: Modern dark theme with high-contrast emerald typography and responsive layouts

---

*Created with Lumina Data Workspace.*
