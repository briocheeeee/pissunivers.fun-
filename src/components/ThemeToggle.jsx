import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

function ThemeToggle({ currentStyle = 'default' }) {
  const isDark = currentStyle.toLowerCase().includes('dark');
  return isDark ? <FiMoon size={18} /> : <FiSun size={18} />;
}

export default React.memo(ThemeToggle);
