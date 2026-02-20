import React from 'react';
import { MdPerson } from 'react-icons/md';
import { t } from 'ttag';

import useLink from '../hooks/link.js';

const LogInButton = () => {
  const link = useLink();

  return (
    <button
      type="button"
      id="loginbutton"
      className="actionbuttons"
      onClick={() => link('USERAREA', { target: 'parent' })}
      title={t`User Area`}
      aria-label={t`User Area`}
    >
      <MdPerson />
    </button>
  );
};

export default React.memo(LogInButton);
