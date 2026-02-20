/**
 *
 */

import React, { useCallback } from 'react';
import { FaQuestion } from 'react-icons/fa';
import { t } from 'ttag';

import useLink from '../hooks/link.js';

const HelpButton = () => {
  const link = useLink();

  const handleClick = useCallback(() => link('HELP', { target: 'parent' }), [link]);
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      link('HELP', { target: 'parent' });
    }
  }, [link]);

  return (
    <div
      id="helpbutton"
      className="actionbuttons"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      title={t`Help`}
      aria-label={t`Help`}
      tabIndex={0}
    >
      <FaQuestion />
    </div>
  );
};

export default React.memo(HelpButton);
