export interface ColumnMeta {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  missingCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
}

export interface Dataset {
  name: string;
  rows: Record<string, any>[];
  columns: ColumnMeta[];
  rowCount: number;
}

export interface CleanSettings {
  removeDuplicates: boolean;
  trimWhitespace: boolean;
  fillMissingNumbers: 'mean' | 'median' | 'zero' | 'none';
  fillMissingStrings: 'na' | 'empty' | 'none';
  parseDates: boolean;
  normalizeHeaders: boolean;
}

export interface KeyInsight {
  title: string;
  description: string;
  metric?: string;
}

export interface ChartSuggestion {
  title: string;
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter';
  xAxis: string;
  yAxis: string;
  reason: string;
}

export interface AIAnalysisReport {
  datasetOverview: string;
  keyInsights: KeyInsight[];
  dataQualityReport: string;
  chartSuggestions: ChartSuggestion[];
  recommendations: string[];
}
