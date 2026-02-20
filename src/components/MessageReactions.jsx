import React, {
  useState, useCallback, useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import EmojiPicker from './EmojiPicker.jsx';

const MessageReactions = ({ messageId, channelId }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const addBtnRef = useRef(null);

  const reactions = useSelector((state) => state.chat.reactions[messageId] || {});
  const currentUserId = useSelector((state) => state.user.id);

  const postReaction = useCallback(async (endpoint, emoji) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messageId, emoji, channelId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Reaction error:', data.errors || response.status);
    }
  }, [messageId, channelId]);

  const handleAddReaction = useCallback(async (emoji) => {
    setShowPicker(false);
    if (!currentUserId || loading) return;
    const userReacted = reactions[emoji.name]?.includes(currentUserId);
    const endpoint = userReacted ? '/api/reactions/remove' : '/api/reactions/add';
    setLoading(true);
    try {
      await postReaction(endpoint, emoji.name);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, loading, reactions, postReaction]);

  const handleToggleReaction = useCallback(async (emoji) => {
    if (!currentUserId || loading) return;
    const userReacted = reactions[emoji]?.includes(currentUserId);
    const endpoint = userReacted ? '/api/reactions/remove' : '/api/reactions/add';
    setLoading(true);
    try {
      await postReaction(endpoint, emoji);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, loading, reactions, postReaction]);

  const handleReactionKeyDown = useCallback((e, emoji) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggleReaction(emoji);
    }
  }, [handleToggleReaction]);

  const openPicker = useCallback(() => {
    if (addBtnRef.current) {
      const rect = addBtnRef.current.getBoundingClientRect();
      setPickerPos({
        top: rect.top - 8,
        left: rect.left,
      });
    }
    setShowPicker((prev) => !prev);
  }, []);

  const handleAddKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  }, [openPicker]);

  const reactionEntries = Object.entries(reactions);

  if (reactionEntries.length === 0 && !currentUserId) {
    return null;
  }

  return (
    <span className="message-reactions">
      {reactionEntries.map(([emoji, users]) => {
        const userReacted = users.includes(currentUserId);
        const count = users.length;
        const label = userReacted
          ? t`Remove :${emoji}: reaction (${count})`
          : t`React with :${emoji}: (${count})`;
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction-badge${userReacted ? ' reacted' : ''}`}
            onClick={() => handleToggleReaction(emoji)}
            onKeyDown={(e) => handleReactionKeyDown(e, emoji)}
            title={label}
            aria-label={label}
            aria-pressed={userReacted}
            disabled={loading || !currentUserId}
          >
            <img
              className="reaction-emoji"
              src={`/emojis/${emoji}.gif`}
              alt={`:${emoji}:`}
              onError={(ev) => {
                ev.target.onerror = null;
                ev.target.src = `/emojis/${emoji}.png`;
              }}
            />
            <span className="reaction-count">{count}</span>
          </button>
        );
      })}
      {currentUserId && (
        <button
          ref={addBtnRef}
          type="button"
          className="reaction-add-btn"
          onClick={openPicker}
          onKeyDown={handleAddKeyDown}
          title={t`Add reaction`}
          aria-label={t`Add reaction`}
          aria-expanded={showPicker}
        >
          +
        </button>
      )}
      {showPicker && createPortal(
        <div
          className="reaction-picker-portal"
          style={{
            position: 'fixed',
            top: pickerPos.top,
            left: pickerPos.left,
            transform: 'translateY(-100%)',
            zIndex: 9999,
          }}
        >
          <EmojiPicker
            onSelect={handleAddReaction}
            onClose={() => setShowPicker(false)}
          />
        </div>,
        document.body,
      )}
    </span>
  );
};

export default React.memo(MessageReactions);
