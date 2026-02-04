import {
  subDays,
  subMonths,
  subYears,
  startOfYear,
  startOfMonth,
  startOfQuarter,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
} from 'date-fns';

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface CustomDateRange {
  type: 'custom';
  start: string;
  end: string;
}

/**
 * Check if a value is a custom date range object.
 */
export function isCustomDateRange(value: unknown): value is CustomDateRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as CustomDateRange).type === 'custom' &&
    'start' in value &&
    'end' in value
  );
}

/**
 * Expand a custom date range into start_date and end_date.
 */
export function expandCustomDateRange(range: CustomDateRange): DateRange {
  return {
    start_date: range.start,
    end_date: range.end,
  };
}

export const DATE_PRESETS = [
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_12_months',
  'year_to_date',
  'month_to_date',
  'quarter_to_date',
  'previous_month',
  'previous_quarter',
  'previous_year',
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

const DATE_FORMAT = 'yyyy-MM-dd';

function formatDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

/**
 * Expand a date preset into start_date and end_date.
 * Returns null if preset is not recognized.
 */
export function expandDatePreset(preset: string): DateRange | null {
  const now = new Date();
  const today = formatDate(now);

  switch (preset) {
    case 'last_7_days':
      return {
        start_date: formatDate(subDays(now, 7)),
        end_date: today,
      };

    case 'last_30_days':
      return {
        start_date: formatDate(subDays(now, 30)),
        end_date: today,
      };

    case 'last_90_days':
      return {
        start_date: formatDate(subDays(now, 90)),
        end_date: today,
      };

    case 'last_12_months':
      return {
        start_date: formatDate(subMonths(now, 12)),
        end_date: today,
      };

    case 'year_to_date':
      return {
        start_date: formatDate(startOfYear(now)),
        end_date: today,
      };

    case 'month_to_date':
      return {
        start_date: formatDate(startOfMonth(now)),
        end_date: today,
      };

    case 'quarter_to_date':
      return {
        start_date: formatDate(startOfQuarter(now)),
        end_date: today,
      };

    case 'previous_month': {
      const lastMonth = subMonths(now, 1);
      return {
        start_date: formatDate(startOfMonth(lastMonth)),
        end_date: formatDate(endOfMonth(lastMonth)),
      };
    }

    case 'previous_quarter': {
      const lastQuarter = subMonths(now, 3);
      return {
        start_date: formatDate(startOfQuarter(lastQuarter)),
        end_date: formatDate(endOfQuarter(lastQuarter)),
      };
    }

    case 'previous_year': {
      const lastYear = subYears(now, 1);
      return {
        start_date: formatDate(startOfYear(lastYear)),
        end_date: formatDate(endOfYear(lastYear)),
      };
    }

    default:
      return null;
  }
}

/**
 * Check if a string is a known date preset.
 */
export function isDatePreset(value: string): value is DatePreset {
  return DATE_PRESETS.includes(value as DatePreset);
}
