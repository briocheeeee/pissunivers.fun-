import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { durationToString } from '../core/utils.js';

const VoidBoostCountdown = () => {
  const dispatch = useDispatch();
  const voidBoostEnd = useSelector((state) => state.gui.voidBoostEnd);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!voidBoostEnd) {
      setRemaining(null);
      return undefined;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const diff = voidBoostEnd - now;
      if (diff <= 0) {
        setRemaining(null);
        dispatch({ type: 'CLEAR_VOID_BOOST' });
        return;
      }
      setRemaining(diff);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [voidBoostEnd, dispatch]);

  if (!remaining || remaining <= 0) {
    return null;
  }

  return (
    <div
      className="voidboostbox"
      title={t`Void Boost Active`}
    >
      {durationToString(remaining, true)}
    </div>
  );
};

export default React.memo(VoidBoostCountdown);
