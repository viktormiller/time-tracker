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
          control: () => 'border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 h-[42px]',
          menu: () => 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg mt-1',
          option: ({ isFocused, isSelected }) =>
            `px-3 py-2 cursor-pointer ${
              isSelected
                ? 'bg-indigo-600 text-white'
                : isFocused
                ? 'bg-gray-100 dark:bg-gray-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`,
        }}
      />
    </div>
  );
}

export default TimezoneSelector;
