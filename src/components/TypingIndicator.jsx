import React, { useEffect, useMemo } from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { t } from 'ttag';

const TYPING_TIMEOUT = 5000;

const TypingIndicator = ({ channelId }) => {
  const dispatch = useDispatch();
  const typing = useSelector(
    (state) => state.chat.typing[channelId] || {},
    shallowEqual,
  );
  const currentUserId = useSelector((state) => state.user.id);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      Object.entries(typing).forEach(([oderId, data]) => {
        if (now - data.timestamp > TYPING_TIMEOUT) {
          dispatch({
            type: 's/CLEAR_TYPING',
            channelId,
            oderId: Number(oderId),
          });
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [typing, channelId, dispatch]);

  const typingUsers = useMemo(() => {
    const now = Date.now();
    return Object.entries(typing)
      .filter(([oderId, data]) => {
        const id = Number(oderId);
        return id !== currentUserId && now - data.timestamp < TYPING_TIMEOUT;
      })
      .map(([, data]) => data.name);
  }, [typing, currentUserId]);

  if (typingUsers.length === 0) {
    return null;
  }

  let text;
  if (typingUsers.length === 1) {
    text = t`${typingUsers[0]} is typing...`;
  } else if (typingUsers.length === 2) {
    text = t`${typingUsers[0]} and ${typingUsers[1]} are typing...`;
  } else if (typingUsers.length === 3) {
    text = t`${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers[2]} are typing...`;
  } else {
    text = t`Several people are typing...`;
  }

  return (
    <div className="typing-indicator">
      <span className="typing-dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
      <span className="typing-text">{text}</span>
    </div>
  );
};

export default React.memo(TypingIndicator);
