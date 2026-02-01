/*
 * Renders a markdown link
 * Also provides previews
 * Links are assumed to start with protocol (http:// etc.)
 */
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HiArrowsExpand, HiStop } from 'react-icons/hi';
import { HiWindow } from 'react-icons/hi2';
import { t } from 'ttag';

import { getLinkDesc } from '../../core/utils.js';
import EMBEDS from '../embeds/index.js';
import { isPopUp } from '../windows/popUpAvailable.js';
import useLink from '../hooks/link.js';
import { cdn, u } from '../../utils/utag.js';

const ALLOWED_PROTOCOLS = ['http://', 'https://'];

function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase().trim();
  return ALLOWED_PROTOCOLS.some((proto) => lowerUrl.startsWith(proto));
}

const titleAllowed = [
  'odysee',
  'twitter',
  'matrix.gs-os',
  'youtube',
  'youtu.be',
  'bitchute',
  'tiktok',
  't.me',
  'play.afreecatv',
  'vod.afreecatv',
  'twitch.tv',
];

const MdLink = ({ href, title, refEmbed }) => {
  const [showEmbed, setShowEmbed] = useState(false);

  const link = useLink();

  const safeHref = useMemo(() => {
    if (!isSafeUrl(href)) return null;
    return href;
  }, [href]);

  if (!safeHref) {
    return <span className="unsafe-link">{title || href}</span>;
  }

  const desc = getLinkDesc(safeHref);

  if (desc === window.location.host && safeHref.includes('/#')) {
    const coords = safeHref.substring(safeHref.indexOf('/#') + 1);
    if (isPopUp() && window.opener && !window.opener.closed) {
      return (
        <a href={u`/${coords}`} target="main">{title || coords}</a>
      );
    }
    return (
      <a href={u`/${coords}`}>{title || coords}</a>
    );
  }

  const embedObj = EMBEDS[desc];
  const embedAvailable = embedObj && embedObj[1](safeHref);
  const Embed = embedObj && embedObj[0];


  let parsedTitle;
  if (title && titleAllowed.includes(desc)) {
    parsedTitle = title;
  } else if (embedAvailable && embedObj[2]) {
    parsedTitle = embedObj[2](safeHref);
  } else {
    parsedTitle = safeHref;
  }

  return (
    <>
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        {parsedTitle}
      </a>
      {(embedAvailable) && (
        <span className="embbtn">
          &nbsp;
          {(embedObj[3])
            && (
            <img
              style={{
                width: '1em',
                height: '1em',
                verticalAlign: 'middle',
              }}
              src={cdn`${embedObj[3]}`}
              alt={`${desc}-icon`}
            />
            )}
          <span
            onClick={(evt) => {
              evt.stopPropagation();
              link('PLAYER', {
                reuse: true,
                target: 'blank',
                args: { uri: safeHref },
              });
            }}
            title={t`Open in PopUp`}
          >
            <HiWindow className="ebex" />
          </span>
          <span
            onClick={() => setShowEmbed(!showEmbed)}
          >
            {(showEmbed)
              ? (
                <HiStop
                  className="ebcl"
                  title={t`Hide Embed`}
                />
              )
              : (
                <HiArrowsExpand
                  className="ebex"
                  title={t`Show Embedded`}
                />
              )}
          </span>
          </span>
      )}
      {showEmbed && embedAvailable && (
        (refEmbed && refEmbed.current)
          ? createPortal(
            <Embed url={safeHref} maxHeight={300} />,
            refEmbed.current,
          ) : (
            <Embed url={safeHref} />
          )
      )}
    </>
  );
};

export default React.memo(MdLink);
