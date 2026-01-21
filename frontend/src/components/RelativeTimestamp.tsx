import { useState, useEffect } from 'react';
import { formatDistanceToNow, format, isAfter, subDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  date: string | Date;
  className?: string;
}

/**
 * Displays timestamps relative for recent entries, absolute for older ones.
 * - Less than 24 hours: "2 hours ago", "vor 30 Minuten"
 * - More than 24 hours: "20. Jan, 14:30"
 */
export function RelativeTimestamp({ date, className = '' }: Props) {
  const [displayTime, setDisplayTime] = useState('');

  useEffect(() => {
    function updateDisplay() {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      const now = new Date();
      const oneDayAgo = subDays(now, 1);

      if (isAfter(dateObj, oneDayAgo)) {
        // Recent: relative time
        setDisplayTime(formatDistanceToNow(dateObj, { addSuffix: true, locale: de }));
      } else {
        // Older: absolute time
        setDisplayTime(format(dateObj, 'dd. MMM, HH:mm', { locale: de }));
      }
    }

    updateDisplay();

    // Update every minute for recent timestamps
    const interval = setInterval(updateDisplay, 60000);
    return () => clearInterval(interval);
  }, [date]);

  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  return (
    <time dateTime={dateObj.toISOString()} className={className} title={format(dateObj, 'PPpp', { locale: de })}>
      {displayTime}
    </time>
  );
}

export default RelativeTimestamp;
