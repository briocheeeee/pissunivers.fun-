/**
 *
 */

import React from 'react';
import { FaCog } from 'react-icons/fa';
import { t } from 'ttag';

import useLink from '../hooks/link.js';


const SettingsButton = () => {
  const link = useLink();

  return (
    <div
      id="settingsbutton"
      className="actionbuttons"
      onClick={() => link('SETTINGS', { target: 'parent' })}
      role="button"
      title={t`Settings`}
      tabIndex={-1}
    >
      <FaCog />
    </div>
  );
};

export default React.memo(SettingsButton);
