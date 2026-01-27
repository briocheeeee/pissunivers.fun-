/*
 * draw windows
 */

import React from 'react';
import { useSelector, shallowEqual } from 'react-redux';

import Window from './Window.jsx';
import { selectActiveWindowIds } from '../store/selectors/windows.js';

const WindowManager = () => {
  const windowIds = useSelector(selectActiveWindowIds, shallowEqual);

  if (!windowIds.length) {
    return null;
  }

  return (
    <div id="wm">
      {windowIds.map((id) => <Window key={id} id={id} />)}
    </div>
  );
};

export default WindowManager;
