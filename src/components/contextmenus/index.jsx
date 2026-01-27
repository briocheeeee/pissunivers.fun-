import React, { useRef } from 'react';
import { createPortal } from 'react-dom';

import UserContextMenu from './UserContextMenu.jsx';
import ChannelContextMenu from './ChannelContextMenu.jsx';
import {
  useClickOutside,
} from '../hooks/clickOutside.js';

export const types = {
  USER: UserContextMenu,
  CHANNEL: ChannelContextMenu,
};

const ContextMenu = ({
  type, x, y, args, close, align,
}) => {
  const wrapperRef = useRef(null);

  useClickOutside([wrapperRef], close);

  if (!type) {
    return null;
  }

  const style = {};
  switch (align) {
    case 'tr': {
      style.right = window.innerWidth - x;
      style.top = y;
      break;
    }
    case 'br': {
      style.right = window.innerWidth - x;
      style.bottom = window.innerHeight - y;
      break;
    }
    case 'bl': {
      style.left = x;
      style.bottom = window.innerHeight - y;
      break;
    }
    default: {
      // also 'tl'
      style.left = x;
      style.top = y;
    }
  }

  const Content = types[type];

  return createPortal((
    <div
      ref={wrapperRef}
      className={`contextmenu ${type}`}
      style={style}
    >
      <Content close={close} args={args} />
    </div>
  ), document.getElementById('app'));
};

export default React.memo(ContextMenu);
