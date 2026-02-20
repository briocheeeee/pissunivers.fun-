import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import HelpButton from './buttons/HelpButton.jsx';
import SettingsButton from './buttons/SettingsButton.jsx';
import LogInButton from './buttons/LogInButton.jsx';
import DownloadButton from './buttons/DownloadButton.jsx';
import ThemeToggle from './ThemeToggle.jsx';
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

const Menu = () => {
  const [render, setRender] = useState(false);
  const [currentStyle, setCurrentStyle] = useState('default');
  const menuOpen = useSelector((state) => state.gui.menuOpen);
  const dispatch = useDispatch();

  useEffect(() => {
    setCurrentStyle(getStoredStyle());
  }, []);

  useEffect(() => {
    if (menuOpen) {
      setTimeout(() => setRender(true), 10);
    }
  }, [menuOpen]);

  const onTransitionEnd = () => {
    if (!menuOpen) setRender(false);
  };

  const toggleTheme = useCallback(() => {
    const styles = getAvailableStyles();
    const currentIndex = styles.indexOf(currentStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    const nextStyle = styles[nextIndex];
    setCurrentStyle(nextStyle);
    dispatch(selectStyle(nextStyle));
  }, [currentStyle, dispatch]);

  const handleThemeKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTheme();
    }
  }, [toggleTheme]);

  return (
    (render || menuOpen) && (
      <div
        className={(menuOpen && render) ? 'menu show' : 'menu'}
        onTransitionEnd={onTransitionEnd}
      >
        <SettingsButton />
        <LogInButton />
        <DownloadButton />
        <HelpButton />
        <div
          id="themebutton"
          className="actionbuttons"
          role="button"
          tabIndex={0}
          onClick={toggleTheme}
          onKeyDown={handleThemeKeyDown}
          title={t`Theme: ${currentStyle}`}
          aria-label={t`Switch theme, current: ${currentStyle}`}
        >
          <ThemeToggle currentStyle={currentStyle} />
        </div>
      </div>
    )
  );
};

export default React.memo(Menu);
