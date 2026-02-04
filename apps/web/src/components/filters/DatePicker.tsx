import { useState, useRef, useEffect } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, parse } from 'date-fns';
import 'react-day-picker/style.css';

interface DatePickerProps {
  startDate?: string;
  endDate?: string;
  onApply: (start: string, end: string) => void;
  onCancel: () => void;
}

export function DatePicker({ startDate, endDate, onApply, onCancel }: DatePickerProps) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const start = startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined;
    const end = endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : undefined;
    return start && end ? { from: start, to: end } : undefined;
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleApply = () => {
    if (range?.from && range?.to) {
      onApply(
        format(range.from, 'yyyy-MM-dd'),
        format(range.to, 'yyyy-MM-dd')
      );
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50"
    >
      <DayPicker
        mode="range"
        selected={range}
        onSelect={setRange}
        numberOfMonths={2}
        defaultMonth={range?.from || new Date()}
        classNames={{
          root: 'text-sm',
          day: 'w-8 h-8 rounded hover:bg-gray-100',
          selected: 'bg-blue-500 text-white hover:bg-blue-600',
          range_middle: 'bg-blue-100',
          today: 'font-bold',
        }}
      />
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!range?.from || !range?.to}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
