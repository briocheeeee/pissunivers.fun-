import React, { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import EmojiPicker from './EmojiPicker.jsx';

const MessageReactions = ({ messageId, channelId }) => {
  const dispatch = useDispatch();
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const reactions = useSelector((state) => state.chat.reactions[messageId] || {});
  const currentUserId = useSelector((state) => state.user.id);

  const handleAddReaction = useCallback(async (emoji) => {
    setShowPicker(false);
    if (!currentUserId || loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/reactions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId, emoji: emoji.name }),
      });
      if (!response.ok) {
        console.error('Failed to add reaction');
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    } finally {
      setLoading(false);
    }
  }, [messageId, currentUserId, loading]);

  const handleToggleReaction = useCallback(async (emoji) => {
    if (!currentUserId || loading) return;

    const userReacted = reactions[emoji]?.includes(currentUserId);
    const endpoint = userReacted ? '/api/reactions/remove' : '/api/reactions/add';

    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId, emoji }),
      });
      if (!response.ok) {
        console.error('Failed to toggle reaction');
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    } finally {
      setLoading(false);
    }
  }, [messageId, currentUserId, reactions, loading]);

  const reactionEntries = Object.entries(reactions);

  if (reactionEntries.length === 0 && !currentUserId) {
    return null;
  }

  return (
    <div className="message-reactions">
      {reactionEntries.map(([emoji, users]) => {
        const userReacted = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            className={`reaction-badge ${userReacted ? 'reacted' : ''}`}
            onClick={() => handleToggleReaction(emoji)}
            title={`${users.length} ${users.length === 1 ? 'reaction' : 'reactions'}`}
            disabled={loading || !currentUserId}
            type="button"
          >
            <img
              className="reaction-emoji"
              src={`/emojis/${emoji}.gif`}
              alt={`:${emoji}:`}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `/emojis/${emoji}.jpg`;
              }}
            />
            {users.length > 1 && <span className="reaction-count">{users.length}</span>}
          </button>
        );
      })}
      {currentUserId && (
        <button
          className="reaction-add-btn"
          onClick={() => setShowPicker(!showPicker)}
          title={t`Add reaction`}
          type="button"
        >
          +
        </button>
      )}
      {showPicker && (
        <div className="reaction-picker-wrapper">
          <EmojiPicker
            onSelect={handleAddReaction}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageReactions);
