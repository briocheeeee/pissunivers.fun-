/*
 * Renders a markdown image embed from our own media storage
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { HiArrowsExpand, HiStop } from 'react-icons/hi';
import { HiWindow } from 'react-icons/hi2';
import { t } from 'ttag';

import DirectLinkMedia from '../embeds/DirectLinkMedia.jsx';
import useLink from '../hooks/link.js';
import { cdn } from '../../utils/utag.js';

const MdLocalMedia = ({ href, title, refEmbed }) => {
  const [showEmbed, setShowEmbed] = useState(false);
  const link = useLink();

  const [Embed] = DirectLinkMedia;

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {title || href}
      </a>
      <span className="embbtn">
        &nbsp;
        <img
          style={{
            width: '1em',
            height: '1em',
            verticalAlign: 'middle',
          }}
          src={cdn`/embico/direct.png`}
          alt="local-icon"
        />
        <span
          onClick={(evt) => {
            evt.stopPropagation();
            link('PLAYER', {
              reuse: true,
              target: 'blank',
              args: { uri: href },
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
      {showEmbed && (
        (refEmbed && refEmbed.current)
          ? createPortal(
            <Embed url={href} maxHeight={300} />,
            refEmbed.current,
          ) : (
            <Embed url={href} />
          )
      )}
    </>
  );
};

export default React.memo(MdLocalMedia);
