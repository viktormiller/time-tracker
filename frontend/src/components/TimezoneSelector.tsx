import TimezoneSelect from 'react-timezone-select';

interface Props {
  value: string;
  onChange: (timezone: string) => void;
}

export function TimezoneSelector({ value, onChange }: Props) {
  return (
    <div className="w-64">
      <TimezoneSelect
        value={value}
        onChange={(tz) => onChange(tz.value)}
        classNames={{
          control: () => 'border border-gray-300 rounded-lg shadow-sm text-sm',
          menu: () => 'bg-white border border-gray-200 rounded-lg shadow-lg mt-1',
          option: ({ isFocused, isSelected }) =>
            `px-3 py-2 cursor-pointer ${
              isSelected
                ? 'bg-indigo-600 text-white'
                : isFocused
                ? 'bg-gray-100'
                : 'bg-white text-gray-700'
            }`,
        }}
      />
    </div>
  );
}

export default TimezoneSelector;
