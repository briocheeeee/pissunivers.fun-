/*
 * hook that returns the current day and month
 */

import { useState, useCallback, useEffect } from 'react';

function useDate() {
  const [day, setDay] = useState(() => new Date().getDate());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [timeoutId, setTimeoutId] = useState();

  let scheduleMidnight;
  const checkDay = useCallback(() => {
    const curDate = new Date();
    setDay(curDate.getDate());
    setMonth(curDate.getMonth() + 1);
    scheduleMidnight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  scheduleMidnight = useCallback(() => {
    const midnight = new Date().setHours(24, 0, 0, 0);
    const timeUntilMidnight = midnight - Date.now();
    setTimeoutId(setTimeout(checkDay, timeUntilMidnight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!timeoutId) {
      scheduleMidnight();
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutId]);

  return [day, month];
}

export default useDate;
