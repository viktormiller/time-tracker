import Select, { components, type SingleValueProps, type OptionProps } from 'react-select';
import { useTheme } from '../hooks/useTheme';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  icon?: React.ReactNode;
  width?: string;
}

const CustomSingleValue = (props: SingleValueProps<Option>) => (
  <components.SingleValue {...props}>
    {props.data.label}
  </components.SingleValue>
);

const CustomOption = (props: OptionProps<Option>) => (
  <components.Option {...props}>
    {props.data.label}
  </components.Option>
);

export function CustomSelect({ value, onChange, options, icon, width = 'w-40' }: CustomSelectProps) {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={`flex items-center gap-2 ${width}`}>
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <Select<Option>
        value={selectedOption}
        onChange={(option) => {
          if (option && !Array.isArray(option)) {
            onChange(option.value);
          }
        }}
        options={options}
        isSearchable={false}
        components={{
          SingleValue: CustomSingleValue,
          Option: CustomOption,
        }}
        styles={{
          control: (base) => ({
            ...base,
            backgroundColor: isDark ? '#374151' : '#f9fafb',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            color: isDark ? '#e5e7eb' : '#374151',
            minHeight: '40px',
            height: '40px',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            paddingLeft: '0.75rem',
            paddingRight: '0.5rem',
            boxShadow: 'none',
            cursor: 'pointer',
            '&:hover': {
              borderColor: isDark ? '#6b7280' : '#d1d5db',
            },
          }),
          valueContainer: (base) => ({
            ...base,
            padding: '0',
            height: '40px',
          }),
          indicatorSeparator: () => ({
            display: 'none',
          }),
          dropdownIndicator: (base) => ({
            ...base,
            padding: '2px',
            color: isDark ? '#9ca3af' : '#6b7280',
            svg: {
              width: '16px',
              height: '16px',
            },
          }),
          menu: (base) => ({
            ...base,
            backgroundColor: isDark ? '#374151' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
            borderRadius: '0.5rem',
            marginTop: '4px',
          }),
          menuList: (base) => ({
            ...base,
            padding: '4px',
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
            padding: '8px 12px',
            borderRadius: '4px',
            '&:active': {
              backgroundColor: isSelected ? '#4338ca' : isDark ? '#6b7280' : '#e5e7eb',
            },
          }),
          singleValue: (base) => ({
            ...base,
            color: isDark ? '#e5e7eb' : '#374151',
            fontSize: '0.875rem',
            lineHeight: '1.25rem',
          }),
        }}
      />
    </div>
  );
}
