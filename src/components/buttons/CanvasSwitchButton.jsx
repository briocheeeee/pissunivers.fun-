/**
 *
 */

import React from 'react';
import { FaFlipboard } from 'react-icons/fa';
import { t } from 'ttag';

import useLink from '../hooks/link.js';

const CanvasSwitchButton = () => {
  const link = useLink();

  return (
    <div
      id="canvasbutton"
      className="actionbuttons"
      onClick={() => link('CANVAS_SELECTION', { target: 'parent' })}
      role="button"
      title={t`Canvas Selection`}
      tabIndex={-1}
    >
      <FaFlipboard />
    </div>
  );
};

export default React.memo(CanvasSwitchButton);
