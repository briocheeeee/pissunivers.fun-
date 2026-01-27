/* eslint-disable jsx-a11y/media-has-caption */

import React from 'react';

import { getExt } from '../../core/utils.js';

const videoExts = [
  'webm',
  'mp4',
];
const imageExts = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
];

const DirectLinkMedia = ({
  url, fill, maxHeight, type,
}) => {
  const ext = getExt(url);
  if (type === 'video' || videoExts.includes(ext)) {
    return (
      <div
        style={{
          textAlign: 'center',
          overflow: 'hidden',
          height: fill && '100%',
        }}
      >
        <video
          style={{
            maxWidth: '100%',
            maxHeight: maxHeight || '100%',
            height: fill && '100%',
            width: fill && '100%',
          }}
          controls
          autoPlay
          src={url}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        textAlign: 'center',
        overflow: 'hidden',
        height: fill && '100%',
        alignContent: fill && 'center',
      }}
    >
      <img
        alt={`${url}`}
        src={url}
        style={{
          maxWidth: '100%',
          maxHeight: maxHeight || '100%',
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default [
  React.memo(DirectLinkMedia),
  (url) => {
    const ext = getExt(url);
    return (videoExts.includes(ext) || imageExts.includes(ext));
  },
  null,
  '/embico/direct.png',
];
