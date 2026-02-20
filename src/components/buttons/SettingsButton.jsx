/**
 *
 */

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
    <div
      id="settingsbutton"
      className="actionbuttons"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      title={t`Settings`}
      aria-label={t`Settings`}
      tabIndex={0}
    >
      <FaCog />
    </div>
  );
};

export default React.memo(SettingsButton);
