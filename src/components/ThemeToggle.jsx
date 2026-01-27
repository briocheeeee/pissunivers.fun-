import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { FiSun, FiMoon } from 'react-icons/fi';
import { selectStyle } from '../store/actions/index.js';

function getStoredStyle() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('style') || 'default';
  }
  return 'default';
}

function getAvailableStyles() {
  if (typeof window !== 'undefined' && window.ssv?.availableStyles) {
    return Object.keys(window.ssv.availableStyles);
  }
  return ['default'];
}

function isDarkTheme(style) {
  return style.toLowerCase().includes('dark');
}

function ThemeToggle() {
  const [currentStyle, setCurrentStyle] = useState('default');
  const dispatch = useDispatch();

  useEffect(() => {
    const stored = getStoredStyle();
    setCurrentStyle(stored);
  }, []);

  const toggleTheme = useCallback(() => {
    const styles = getAvailableStyles();
    const currentIndex = styles.indexOf(currentStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    const nextStyle = styles[nextIndex];
    setCurrentStyle(nextStyle);
    dispatch(selectStyle(nextStyle));
  }, [currentStyle, dispatch]);

  const isDark = isDarkTheme(currentStyle);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggleTheme}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleTheme(); }}
      className="actionbuttons"
      aria-label={`Current theme: ${currentStyle}`}
      title={currentStyle}
    >
      {isDark ? <FiMoon size={18} /> : <FiSun size={18} />}
    </div>
  );
}

export default React.memo(ThemeToggle);
