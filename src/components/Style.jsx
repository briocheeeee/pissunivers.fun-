import { useEffect } from 'react';
import { useSelector } from 'react-redux';

function getStoredStyle() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('style') || 'default';
  }
  return 'default';
}

function setStoredStyle(style) {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('style', style);
  }
}

function applyStyleCss(style) {
  if (typeof document === 'undefined' || !window.ssv?.availableStyles) {
    return;
  }
  const availableStyles = window.ssv.availableStyles;
  const basename = window.ssv?.basename || '';

  const baseLinkElement = document.getElementById('globcss');
  if (baseLinkElement) {
    const baseCssPath = availableStyles.default;
    if (baseCssPath) {
      baseLinkElement.href = `${basename}${baseCssPath}`;
    }
  }

  let themeLinkElement = document.getElementById('themecss');

  if (style === 'default' || style === 'new') {
    if (themeLinkElement) {
      themeLinkElement.remove();
    }
    if (style === 'new') {
      const newCssPath = availableStyles.new;
      if (newCssPath && baseLinkElement) {
        baseLinkElement.href = `${basename}${newCssPath}`;
      }
    }
    return;
  }

  const themeCssPath = availableStyles[style];
  if (!themeCssPath) {
    if (themeLinkElement) {
      themeLinkElement.remove();
    }
    return;
  }

  if (!themeLinkElement) {
    themeLinkElement = document.createElement('link');
    themeLinkElement.id = 'themecss';
    themeLinkElement.rel = 'stylesheet';
    themeLinkElement.type = 'text/css';
    document.head.appendChild(themeLinkElement);
  }

  themeLinkElement.href = `${basename}${themeCssPath}`;
}

function Style() {
  const style = useSelector((state) => state.gui.style);

  useEffect(() => {
    const storedStyle = getStoredStyle();
    applyStyleCss(storedStyle);
  }, []);

  useEffect(() => {
    if (style) {
      applyStyleCss(style);
      setStoredStyle(style);
    }
  }, [style]);

  return null;
}

export default Style;
