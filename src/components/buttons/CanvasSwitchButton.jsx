import React from 'react';
import { FaFlipboard } from 'react-icons/fa';
import { t } from 'ttag';

import useLink from '../hooks/link.js';

const CanvasSwitchButton = () => {
  const link = useLink();

  return (
    <button
      type="button"
      id="canvasbutton"
      className="actionbuttons"
      onClick={() => link('CANVAS_SELECTION', { target: 'parent' })}
      title={t`Canvas Selection`}
      tabIndex={-1}
    >
      <FaFlipboard />
    </button>
  );
};

export default React.memo(CanvasSwitchButton);
