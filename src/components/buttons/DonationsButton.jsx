import React from 'react';
import { FaHeart } from 'react-icons/fa';
import { t } from 'ttag';

import useLink from '../hooks/link.js';

const DonationsButton = () => {
  const link = useLink();

  return (
    <div
      id="donationsbutton"
      className="actionbuttons"
      onClick={() => link('DONATIONS', { target: 'parent' })}
      role="button"
      title={t`Donations`}
      tabIndex={-1}
    >
      <FaHeart />
    </div>
  );
};

export default React.memo(DonationsButton);
