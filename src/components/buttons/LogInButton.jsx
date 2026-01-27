/**
 *
 */

import React from 'react';
import { MdPerson } from 'react-icons/md';
import { t } from 'ttag';

import useLink from '../hooks/link.js';

const LogInButton = () => {
  const link = useLink();

  return (
    <div
      id="loginbutton"
      className="actionbuttons"
      onClick={() => link('USERAREA', { target: 'parent' })}
      role="button"
      title={t`User Area`}
      tabIndex={0}
      aria-label={t`User Area`}
    >
      <MdPerson />
    </div>
  );
};

export default React.memo(LogInButton);
