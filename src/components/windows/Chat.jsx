/**
 *
 */

import React, {
  useRef, useLayoutEffect, useState, useEffect, useCallback, useContext,
} from 'react';
import useStayScrolled from 'react-stay-scrolled';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import useLink from '../hooks/link.js';
import ContextMenu from '../contextmenus/index.jsx';
import ChatMessage from '../ChatMessage.jsx';
import ChannelDropDown from '../contextmenus/ChannelDropDown.jsx';
import TypingIndicator from '../TypingIndicator.jsx';
import EmojiPicker from '../EmojiPicker.jsx';
import { openWindow } from '../../store/actions/windows.js';

import { CHANNEL_TYPES } from '../../core/constants.js';

import {
  markChannelAsRead,
  sendChatMessage,
  sendTypingStart,
} from '../../store/actions/index.js';
import {
  fetchChatMessages,
} from '../../store/actions/thunks.js';


const Chat = () => {
  const listRef = useRef();
  const targetRef = useRef();
  const inputRef = useRef();

  const [blockedIds, setBlockedIds] = useState([]);
  const [btnSize, setBtnSize] = useState(20);
  const [cmArgs, setCmArgs] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const lastMessageCountRef = useRef(0);
  const lastTypingSentRef = useRef(0);

  const dispatch = useDispatch();

  const ownName = useSelector((state) => state.user.name);
  const fetching = useSelector((state) => state.fetching.fetchingChat);
  const { channels, messages, blocked } = useSelector((state) => state.chat);

  const {
    args,
    setArgs,
    setTitle,
  } = useContext(WindowContext);

  const chatChannel = args.chatChannel || 0;

  const link = useLink();

  const setChannel = useCallback((cid) => {
    dispatch(markChannelAsRead(cid));
    setArgs({
      chatChannel: Number(cid),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const addToInput = useCallback((msg) => {
    const inputElem = inputRef.current;
    if (!inputElem) {
      return;
    }
    let newInputMessage = inputElem.value;
    if (newInputMessage.slice(-1) !== ' ') {
      newInputMessage += ' ';
    }
    newInputMessage += `${msg} `;
    inputElem.value = newInputMessage;
    inputRef.current.focus();
  }, []);

  const closeCm = useCallback(() => {
    setCmArgs({});
  }, []);

  const openProfile = useCallback((uid, name) => {
    dispatch(openWindow(
      'USER_PROFILE',
      false,
      name,
      { uid },
      false,
      false,
      null,
      null,
      560,
      null,
    ));
  }, [dispatch]);

  const openUserCm = useCallback((x, y, name, uid) => {
    setCmArgs({
      type: 'USER',
      x,
      y,
      args: {
        name,
        uid,
        setChannel,
        addToInput,
        openProfile,
      },
    });
  }, [setChannel, addToInput, openProfile]);

  const { stayScrolled, isScrolled } = useStayScrolled(listRef, {
    initialScroll: Infinity,
    inaccuracy: 10,
  });

  const handleScroll = useCallback(() => {
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsScrolledUp(!atBottom);
      if (atBottom) {
        setUnreadCount(0);
      }
    }
  }, []);

  const channelMessages = messages[chatChannel] || [];
  useEffect(() => {
    if (channels[chatChannel] && !messages[chatChannel] && !fetching) {
      dispatch(fetchChatMessages(chatChannel));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, messages, chatChannel, fetching]);

  useEffect(() => {
    if (channels[chatChannel]) {
      const channelName = channels[chatChannel][0];
      setTitle(`Chan: ${channelName}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatChannel, channels]);

  useLayoutEffect(() => {
    const wasScrolled = stayScrolled();
    if (!wasScrolled && channelMessages.length > lastMessageCountRef.current) {
      setUnreadCount((prev) => prev + (channelMessages.length - lastMessageCountRef.current));
    }
    lastMessageCountRef.current = channelMessages.length;
  }, [channelMessages.length, stayScrolled]);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      setUnreadCount(0);
      setIsScrolledUp(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      const fontSize = Math.round(targetRef.current.offsetHeight / 10);
      setBtnSize(Math.min(28, fontSize));
    }, 330);
  }, [targetRef]);

  useEffect(() => {
    const bl = [];
    for (let i = 0; i < blocked.length; i += 1) {
      bl.push(blocked[i][0]);
    }
    setBlockedIds(bl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked.length]);

  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > 3000) {
      lastTypingSentRef.current = now;
      dispatch(sendTypingStart(chatChannel));
    }
  }, [dispatch, chatChannel]);

  const handleEmojiSelect = useCallback((emoji) => {
    const inputElem = inputRef.current;
    if (!inputElem) return;
    const emojiCode = `:${emoji.name}:`;
    const cursorPos = inputElem.selectionStart;
    const textBefore = inputElem.value.substring(0, cursorPos);
    const textAfter = inputElem.value.substring(cursorPos);
    inputElem.value = textBefore + emojiCode + textAfter;
    inputElem.focus();
    inputElem.setSelectionRange(cursorPos + emojiCode.length, cursorPos + emojiCode.length);
    setShowEmojiPicker(false);
  }, []);

  function handleSubmit(evt) {
    evt.preventDefault();
    const inptMsg = inputRef.current.value.trim();
    if (!inptMsg) return;
    dispatch(sendChatMessage(inptMsg, chatChannel));
    inputRef.current.value = '';
    setShowEmojiPicker(false);
  }

  /*
   * if selected channel isn't in channel list anymore
   * for whatever reason (left faction etc.)
   * set channel to first available one
   */
  useEffect(() => {
    if (!chatChannel || !channels[chatChannel]) {
      let chosenChannel;
      for (const [cid, [name, type]] of Object.entries(channels)) {
        if (!chosenChannel) {
          chosenChannel = cid;
        }
        if (type === CHANNEL_TYPES.PUBLIC) {
          chosenChannel = cid;
          if (name === 'en') {
            chosenChannel = cid;
            break;
          }
        }
      }
      if (chosenChannel) {
        setChannel(chosenChannel);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, chatChannel]);

  return (
    <div
      ref={targetRef}
      className="chat-container"
    >
      <ContextMenu
        type={cmArgs.type}
        x={cmArgs.x}
        y={cmArgs.y}
        args={cmArgs.args}
        close={closeCm}
        align={cmArgs.align}
      />
      <ul
        className="chatarea"
        ref={listRef}
        style={{ flexGrow: 1 }}
        role="presentation"
        onScroll={handleScroll}
      >
        {
          (!channelMessages.length)
          && (
          <ChatMessage
            uid={0}
            name="info"
            country="xx"
            msg={t`Start chatting here`}
          />
          )
        }
        {
          channelMessages.map((message) => ((blockedIds.includes(message[3]))
            ? null : (
              <ChatMessage
                name={message[0]}
                msg={message[1]}
                country={message[2]}
                uid={message[3]}
                ts={message[4]}
                key={message[5]}
                msgId={message[9]}
                channelId={chatChannel}
                faction={message[6]}
                avatar={message[7]}
                badges={message[8]}
                openCm={openUserCm}
                onFactionClick={(factionId) => {
                  link('FACTION_PUBLIC', { target: 'blank', args: { factionId } });
                }}
              />
            )))
        }
      </ul>
      <TypingIndicator channelId={chatChannel} />
      <form
        className="chatinput"
        onSubmit={(e) => handleSubmit(e)}
        style={{
          display: 'flex',
        }}
      >
        {(ownName) ? (
          <React.Fragment key="chtipt">
            <button
              type="button"
              className="emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title={t`Emojis`}
              aria-label={t`Open emoji picker`}
            >
              ☺
            </button>
            <input
              style={{
                flexGrow: 1,
                minWidth: 40,
              }}
              ref={inputRef}
              autoComplete="off"
              maxLength="200"
              type="text"
              className="chtipt"
              placeholder={t`Chat here`}
              onInput={handleTyping}
            />
            <button
              id="sendbtn"
              style={{ flexGrow: 0 }}
              type="submit"
            >
              ‣
            </button>
          </React.Fragment>
        ) : (
          <div
            className="modallink"
            key="nlipt"
            onClick={(evt) => {
              evt.stopPropagation();
              link('USERAREA', { target: 'parent' });
            }}
            style={{
              textAlign: 'center',
              fontSize: 13,
              flexGrow: 1,
            }}
            role="button"
            tabIndex={0}
          >
            {t`You must be logged in to chat`}
          </div>
        )}
        <ChannelDropDown
          key="cdd"
          setChatChannel={setChannel}
          chatChannel={chatChannel}
        />
      </form>
      <div
        className="chatlink"
        style={{
          fontSize: btnSize,
        }}
      >
        <span
          onClick={(event) => {
            const {
              clientX: x,
              clientY: y,
            } = event;
            setCmArgs({
              type: 'CHANNEL',
              x,
              y,
              args: { cid: chatChannel },
              align: 'tr',
            });
          }}
          role="button"
          title={t`Channel settings`}
          tabIndex={0}
          aria-label={t`Channel settings`}
        >⚙</span>
      </div>
      {isScrolledUp && unreadCount > 0 && (
        <div
          className="chat-new-messages"
          onClick={scrollToBottom}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && scrollToBottom()}
        >
          ↓ {unreadCount} {t`new messages`}
        </div>
      )}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
};

export default Chat;
