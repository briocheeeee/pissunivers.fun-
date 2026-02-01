import React, { useState, useEffect, useRef, useCallback } from 'react';
import { t } from 'ttag';

const EmojiPicker = ({ onSelect, onClose }) => {
  const [emojis, setEmojis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    const fetchEmojis = async () => {
      try {
        const response = await fetch('/api/emojis');
        if (response.ok) {
          const data = await response.json();
          setEmojis(data.emojis || []);
        }
      } catch (error) {
        console.error('Failed to load emojis:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmojis();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleEmojiClick = useCallback((emoji) => {
    onSelect(emoji);
  }, [onSelect]);

  const filteredEmojis = searchTerm
    ? emojis.filter((e) => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : emojis;

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <input
        type="text"
        className="emoji-picker-search"
        placeholder={t`Search emojis...`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus
      />
      <div className="emoji-picker-grid">
        {loading && <div className="emoji-picker-loading">{t`Loading...`}</div>}
        {!loading && filteredEmojis.length === 0 && (
          <div className="emoji-picker-empty">{t`No emojis found`}</div>
        )}
        {!loading && filteredEmojis.map((emoji) => (
          <button
            key={emoji.name}
            type="button"
            className="emoji-picker-item"
            onClick={() => handleEmojiClick(emoji)}
            title={`:${emoji.name}:`}
          >
            <img
              src={`/emojis/${emoji.filename}`}
              alt={`:${emoji.name}:`}
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(EmojiPicker);
