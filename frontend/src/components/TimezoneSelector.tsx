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
    <div className="w-64">
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
            boxShadow: 'none',
            '&:hover': {
              borderColor: isDark ? '#6b7280' : '#d1d5db',
            },
          }),
          menu: (base) => ({
            ...base,
            backgroundColor: isDark ? '#374151' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
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
            '&:active': {
              backgroundColor: isSelected ? '#4338ca' : isDark ? '#6b7280' : '#e5e7eb',
            },
          }),
          singleValue: (base) => ({
            ...base,
            color: isDark ? '#e5e7eb' : '#374151',
          }),
          input: (base) => ({
            ...base,
            color: isDark ? '#e5e7eb' : '#374151',
          }),
        }}
      />
    </div>
  );
}

export default TimezoneSelector;
