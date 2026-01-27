/*
 *
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  muteChatChannel,
  unmuteChatChannel,
  toggleChatFlag,
  toggleChatAvatar,
} from '../../store/actions/index.js';
import {
  setLeaveChannel,
} from '../../store/actions/thunks.js';

/*
 * args: {
 *   cid,
 * }
 */
const ChannelContextMenu = ({ args, close }) => {
  const channels = useSelector((state) => state.chat.channels);
  const muteArr = useSelector((state) => state.chatRead.mute);
  const showChatFlag = useSelector((state) => state.gui.showChatFlag);
  const showChatAvatar = useSelector((state) => state.gui.showChatAvatar);

  const { cid } = args;
  const dispatch = useDispatch();

  const isMuted = muteArr.includes(cid);

  return (
    <>
      <div
        role="button"
        key="mute"
        onClick={() => {
          if (isMuted) {
            dispatch(unmuteChatChannel(cid));
          } else {
            dispatch(muteChatChannel(cid));
          }
        }}
        tabIndex={0}
        style={{ borderTop: 'none' }}
      >
        {`${(isMuted) ? '✔' : '✘'} ${t`Mute`}`}
      </div>
      <div
        role="button"
        key="showflag"
        onClick={() => {
          dispatch(toggleChatFlag());
        }}
        tabIndex={0}
      >
        {`${(showChatFlag) ? '✔' : '✘'} ${t`Show Flags`}`}
      </div>
      <div
        role="button"
        key="showavatar"
        onClick={() => {
          dispatch(toggleChatAvatar());
        }}
        tabIndex={0}
      >
        {`${(showChatAvatar) ? '✔' : '✘'} ${t`Show Avatars`}`}
      </div>
      {(channels[cid][1] !== 0)
        && (
        <div
          key="leave"
          role="button"
          onClick={() => {
            dispatch(setLeaveChannel(cid));
            close();
          }}
          tabIndex={0}
        >
          {t`Close`}
        </div>
        )}
    </>
  );
};

export default React.memo(ChannelContextMenu);
