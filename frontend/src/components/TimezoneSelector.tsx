import TimezoneSelect from 'react-timezone-select';
import { useTheme } from '../hooks/useTheme';

interface Props {
  value: string;
  onChange: (timezone: string) => void;
}

export function TimezoneSelector({ value, onChange }: Props) {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';

  return (
    <div className="w-52">
      <TimezoneSelect
        value={value}
        onChange={(tz) => onChange(tz.value)}
        styles={{
          control: (base) => ({
            ...base,
            backgroundColor: isDark ? '#374151' : '#f9fafb',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            color: isDark ? '#e5e7eb' : '#374151',
            minHeight: '42px',
            height: '42px',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            paddingLeft: '0.75rem',
            paddingRight: '0.75rem',
            boxShadow: 'none',
            '&:hover': {
              borderColor: isDark ? '#6b7280' : '#d1d5db',
            },
          }),
          valueContainer: (base) => ({
            ...base,
            padding: '0',
          }),
          indicatorSeparator: () => ({
            display: 'none',
          }),
          dropdownIndicator: (base) => ({
            ...base,
            padding: '0 4px',
            color: isDark ? '#9ca3af' : '#6b7280',
          }),
          menu: (base) => ({
            ...base,
            backgroundColor: isDark ? '#374151' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
            borderRadius: '0.5rem',
          }),
          option: (base, { isFocused, isSelected }) => ({
            ...base,
            backgroundColor: isSelected
              ? '#4f46e5'
              : isFocused
              ? isDark ? '#4b5563' : '#f3f4f6'
              : isDark ? '#374151' : '#ffffff',
            color: isSelected ? '#ffffff' : isDark ? '#e5e7eb' : '#374151',
            cursor: 'pointer',
            fontSize: '0.875rem',
            padding: '0.625rem 0.75rem',
            '&:active': {
              backgroundColor: isSelected ? '#4338ca' : isDark ? '#6b7280' : '#e5e7eb',
            },
          }),
          singleValue: (base) => ({
            ...base,
            color: isDark ? '#e5e7eb' : '#374151',
            fontSize: '0.875rem',
          }),
          input: (base) => ({
            ...base,
            color: isDark ? '#e5e7eb' : '#374151',
            fontSize: '0.875rem',
            margin: '0',
            padding: '0',
          }),
        }}
      />
    </div>
  );
}

export default TimezoneSelector;
