/*
 * expand menu / show other menu buttons
 *
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MdExpandMore, MdExpandLess } from 'react-icons/md';
import { t } from 'ttag';

import { toggleOpenMenu } from '../../store/actions/index.js';

const ExpandMenuButton = () => {
  const menuOpen = useSelector((state) => state.gui.menuOpen);
  const dispatch = useDispatch();

  return (
    <button
      type="button"
      id="menubutton"
      className={`actionbuttons${menuOpen ? ' pressed' : ''}`}
      title={(menuOpen) ? t`Close Menu` : t`Open Menu`}
      tabIndex={-1}
      onClick={() => dispatch(toggleOpenMenu())}
    >
      {(menuOpen) ? <MdExpandLess /> : <MdExpandMore /> }
    </button>
  );
};

export default React.memo(ExpandMenuButton);
