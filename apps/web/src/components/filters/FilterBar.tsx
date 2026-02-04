import type { ChartParameter } from '../../api/types';
import { DateRangeFilter } from './DateRangeFilter';
import { SelectFilter } from './SelectFilter';
import { DynamicSelectFilter } from './DynamicSelectFilter';

interface FilterBarProps {
  parameters: ChartParameter[];
  chartName?: string;
}

export function FilterBar({ parameters, chartName }: FilterBarProps) {
  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {parameters.map((param) => {
        const label = param.label || param.name;
        const defaultValue =
          typeof param.default === 'string' ? param.default : undefined;

        switch (param.type) {
          case 'date_range':
            return (
              <DateRangeFilter
                key={param.name}
                name={param.name}
                label={label}
                chartName={chartName}
                defaultValue={defaultValue}
              />
            );

          case 'select':
            const options = (param.options || []).map((opt) =>
              typeof opt === 'string' ? { value: opt, label: opt } : opt
            );
            return (
              <SelectFilter
                key={param.name}
                name={param.name}
                label={label}
                options={options}
                chartName={chartName}
                defaultValue={defaultValue}
              />
            );

          case 'dynamic_select':
            if (!chartName) {
              return (
                <div key={param.name} className="text-sm text-gray-500">
                  {label}: dynamic_select requires chartName
                </div>
              );
            }
            return (
              <DynamicSelectFilter
                key={param.name}
                name={param.name}
                label={label}
                chartName={chartName}
                defaultValue={defaultValue}
              />
            );

          default:
            // Unsupported filter type - render as text for now
            return (
              <div key={param.name} className="text-sm text-gray-500">
                {label}: {param.type} (not supported)
              </div>
            );
        }
      })}
    </div>
  );
}
