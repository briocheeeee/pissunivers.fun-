import React, { useCallback } from 'react';
import { FaCog } from 'react-icons/fa';
import { t } from 'ttag';

import useLink from '../hooks/link.js';


const SettingsButton = () => {
  const link = useLink();

  const handleClick = useCallback(() => link('SETTINGS', { target: 'parent' }), [link]);
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      link('SETTINGS', { target: 'parent' });
    }
  }, [link]);

  return (
    <button
      type="button"
      id="settingsbutton"
      className="actionbuttons"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={t`Settings`}
      aria-label={t`Settings`}
    >
      <FaCog />
    </button>
  );
};

export default React.memo(SettingsButton);
