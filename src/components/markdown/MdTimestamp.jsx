import React, { useState, useEffect, useMemo } from 'react';

const FORMATS = {
  t: { hour: 'numeric', minute: '2-digit' },
  T: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
  d: { day: '2-digit', month: '2-digit', year: 'numeric' },
  D: { day: 'numeric', month: 'long', year: 'numeric' },
  f: { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  F: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  R: 'relative',
};

function getRelativeTime(timestamp, locale) {
  const now = Date.now();
  const target = timestamp * 1000;
  const diff = target - now;
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const sign = diff < 0 ? -1 : 1;

    if (years > 0) return rtf.format(sign * years, 'year');
    if (months > 0) return rtf.format(sign * months, 'month');
    if (days > 0) return rtf.format(sign * days, 'day');
    if (hours > 0) return rtf.format(sign * hours, 'hour');
    if (minutes > 0) return rtf.format(sign * minutes, 'minute');
    return rtf.format(sign * seconds, 'second');
  } catch (e) {
    if (diff < 0) {
      if (years > 0) return `${years} years ago`;
      if (months > 0) return `${months} months ago`;
      if (days > 0) return `${days} days ago`;
      if (hours > 0) return `${hours} hours ago`;
      if (minutes > 0) return `${minutes} minutes ago`;
      return `${seconds} seconds ago`;
    }
    if (years > 0) return `in ${years} years`;
    if (months > 0) return `in ${months} months`;
    if (days > 0) return `in ${days} days`;
    if (hours > 0) return `in ${hours} hours`;
    if (minutes > 0) return `in ${minutes} minutes`;
    return `in ${seconds} seconds`;
  }
}

function formatTimestamp(timestamp, format, locale) {
  const date = new Date(timestamp * 1000);
  const formatOptions = FORMATS[format] || FORMATS.f;

  if (formatOptions === 'relative') {
    return getRelativeTime(timestamp, locale);
  }

  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  } catch (e) {
    return date.toLocaleString();
  }
}

const MdTimestamp = ({ timestamp, format = 'f' }) => {
  const locale = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.language || navigator.languages?.[0] || 'en-US';
    }
    return 'en-US';
  }, []);

  const [displayText, setDisplayText] = useState(() => formatTimestamp(timestamp, format, locale));

  useEffect(() => {
    if (format !== 'R') {
      setDisplayText(formatTimestamp(timestamp, format, locale));
      return;
    }

    const updateRelativeTime = () => {
      setDisplayText(formatTimestamp(timestamp, format, locale));
    };

    updateRelativeTime();

    const now = Date.now();
    const target = timestamp * 1000;
    const diff = Math.abs(target - now);

    let interval;
    if (diff < 60000) {
      interval = setInterval(updateRelativeTime, 1000);
    } else if (diff < 3600000) {
      interval = setInterval(updateRelativeTime, 60000);
    } else {
      interval = setInterval(updateRelativeTime, 3600000);
    }

    return () => clearInterval(interval);
  }, [timestamp, format, locale]);

  const fullDate = useMemo(() => {
    const date = new Date(timestamp * 1000);
    try {
      return new Intl.DateTimeFormat(locale, FORMATS.F).format(date);
    } catch (e) {
      return date.toLocaleString();
    }
  }, [timestamp, locale]);

  return (
    <span
      className="md-timestamp"
      title={fullDate}
      data-timestamp={timestamp}
      data-format={format}
    >
      {displayText}
    </span>
  );
};

export default React.memo(MdTimestamp);
