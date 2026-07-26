import { ColumnMeta, CleanSettings } from '../types';

/**
 * Infer data type of a column based on cell values.
 */
export function inferType(values: any[]): 'string' | 'number' | 'date' | 'boolean' {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNullValues.length === 0) return 'string';

  let numericCount = 0;
  let booleanCount = 0;
  let dateCount = 0;

  for (const val of nonNullValues) {
    if (typeof val === 'number') {
      numericCount++;
      continue;
    }
    if (typeof val === 'boolean' || val === 'true' || val === 'false') {
      booleanCount++;
      continue;
    }

    // Check if it's a number string
    const num = Number(val);
    if (!isNaN(num) && val.toString().trim() !== '') {
      numericCount++;
      continue;
    }

    // Check if it's a valid date string (like YYYY-MM-DD)
    if (isNaN(val as any)) {
      const parsedDate = Date.parse(val);
      if (!isNaN(parsedDate) && val.toString().includes('-') || val.toString().includes('/')) {
        dateCount++;
      }
    }
  }

  const total = nonNullValues.length;
  if (numericCount / total > 0.7) return 'number';
  if (dateCount / total > 0.7) return 'date';
  if (booleanCount / total > 0.7) return 'boolean';
  return 'string';
}

/**
 * Calculate column statistics and metadata.
 */
export function calculateMetadata(rows: Record<string, any>[]): ColumnMeta[] {
  if (rows.length === 0) return [];

  // Gather all unique keys across all rows to support sparse or irregular datasets
  const columnSet = new Set<string>();
  rows.forEach(row => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach(key => columnSet.add(key));
    }
  });
  const columns = Array.from(columnSet);
  const metadata: ColumnMeta[] = [];

  for (const col of columns) {
    const values = rows.map(r => r[col]);
    const type = inferType(values);

    let missingCount = 0;
    const uniqueVals = new Set();
    const numericValues: number[] = [];

    for (const val of values) {
      if (val === null || val === undefined || val === '') {
        missingCount++;
      } else {
        uniqueVals.add(val);
        if (type === 'number') {
          const num = Number(val);
          if (!isNaN(num)) {
            numericValues.push(num);
          }
        }
      }
    }

    const meta: ColumnMeta = {
      name: col,
      type,
      missingCount,
      uniqueCount: uniqueVals.size,
    };

    if (type === 'number' && numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const mean = sum / numericValues.length;
      
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

      meta.min = parseFloat(min.toFixed(2));
      meta.max = parseFloat(max.toFixed(2));
      meta.mean = parseFloat(mean.toFixed(2));
      meta.median = parseFloat(median.toFixed(2));
    }

    metadata.push(meta);
  }

  return metadata;
}

/**
 * Apply dataset cleaning transformations.
 */
export function cleanDataset(
  rows: Record<string, any>[],
  settings: CleanSettings
): { cleanedRows: Record<string, any>[]; stats: { duplicatesRemoved: number; missingFilled: number } } {
  let data = [...rows];
  let duplicatesRemoved = 0;
  let missingFilled = 0;

  if (data.length === 0) {
    return { cleanedRows: [], stats: { duplicatesRemoved, missingFilled } };
  }

  // 1. Normalize Headers if selected
  if (settings.normalizeHeaders) {
    const keys = Object.keys(data[0]);
    const keyMap: Record<string, string> = {};
    keys.forEach(k => {
      // Clean header: lowercase, trim, replace spaces/special chars with underscore
      let cleaned = k.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
      if (!cleaned) cleaned = 'column_' + Math.random().toString(36).substr(2, 4);
      keyMap[k] = cleaned;
    });

    data = data.map(row => {
      const newRow: Record<string, any> = {};
      Object.keys(row).forEach(oldKey => {
        newRow[keyMap[oldKey]] = row[oldKey];
      });
      return newRow;
    });
  }

  // Get current active columns after potential header normalization
  const columns = Object.keys(data[0]);
  const metadataBefore = calculateMetadata(data);

  // Calculate Mean/Median values for numerical columns in case we need to fill missing values
  const columnFills: Record<string, any> = {};
  metadataBefore.forEach(col => {
    if (col.type === 'number' && col.mean !== undefined) {
      if (settings.fillMissingNumbers === 'mean') {
        columnFills[col.name] = col.mean;
      } else if (settings.fillMissingNumbers === 'median') {
        // Simple median calculation
        const vals = data
          .map(r => Number(r[col.name]))
          .filter(v => !isNaN(v))
          .sort((a, b) => a - b);
        const mid = Math.floor(vals.length / 2);
        const median = vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
        columnFills[col.name] = isNaN(median) ? 0 : parseFloat(median.toFixed(2));
      } else if (settings.fillMissingNumbers === 'zero') {
        columnFills[col.name] = 0;
      }
    } else if (col.type === 'string') {
      if (settings.fillMissingStrings === 'na') {
        columnFills[col.name] = 'N/A';
      } else if (settings.fillMissingStrings === 'empty') {
        columnFills[col.name] = '';
      }
    }
  });

  // 2. Remove Duplicates
  if (settings.removeDuplicates) {
    const seen = new Set<string>();
    const uniqueData: Record<string, any>[] = [];
    data.forEach(row => {
      const strRepresentation = JSON.stringify(row);
      if (!seen.has(strRepresentation)) {
        seen.add(strRepresentation);
        uniqueData.push(row);
      } else {
        duplicatesRemoved++;
      }
    });
    data = uniqueData;
  }

  // 3. Trim, Parse, and Fill missing values
  data = data.map(row => {
    const newRow: Record<string, any> = {};
    columns.forEach(col => {
      let val = row[col];

      // Trim whitespace for strings
      if (settings.trimWhitespace && typeof val === 'string') {
        val = val.trim();
      }

      // Convert empty strings or nulls
      const isEmpty = val === null || val === undefined || (typeof val === 'string' && val === '');

      if (isEmpty) {
        if (columnFills[col] !== undefined) {
          val = columnFills[col];
          missingFilled++;
        }
      } else {
        // Parse numbers if they are stored as strings
        const colMeta = metadataBefore.find(c => c.name === col);
        if (colMeta?.type === 'number' && typeof val === 'string') {
          const num = Number(val);
          if (!isNaN(num)) {
            val = num;
          }
        }

        // Standardize Date parsing if option is selected
        if (settings.parseDates && colMeta?.type === 'date') {
          const parsed = Date.parse(val);
          if (!isNaN(parsed)) {
            val = new Date(parsed).toISOString().split('T')[0]; // Store as YYYY-MM-DD
          }
        }
      }

      newRow[col] = val;
    });
    return newRow;
  });

  return {
    cleanedRows: data,
    stats: {
      duplicatesRemoved,
      missingFilled,
    },
  };
}
