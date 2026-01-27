import React, { useRef } from 'react';
import { useSelector } from 'react-redux';

import MdParagraph from './markdown/MdParagraph.jsx';
import {
  colorFromText,
  setBrightness,
  getDateTimeString,
} from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';
import { cdn } from '../utils/utag.js';


function ChatMessage({
  name,
  uid,
  country,
  msg,
  ts,
  openCm,
  faction,
  onFactionClick,
  avatar,
  badges,
}) {
  const isDarkMode = useSelector(selectIsDarkMode);
  const showChatFlag = useSelector((state) => state.gui.showChatFlag);
  const showChatAvatar = useSelector((state) => state.gui.showChatAvatar);
  const refEmbed = useRef();

  const isInfo = (name === 'info');
  const isEvent = (name === 'event');
  let className = 'msg';
  if (isInfo) {
    className += ' info';
  } else if (isEvent) {
    className += ' event';
  } else if (msg.charAt(0) === '>') {
    className += ' greentext';
  } else if (msg.charAt(0) === '<') {
    className += ' redtext';
  }

  return (
    <li className="chatmsg" ref={refEmbed}>
      <div className="msgcont">
        <span className={className}>
          {(!isInfo && !isEvent) && (
            <span
              key="name"
              role="button"
              tabIndex={-1}
              style={{
                cursor: 'pointer',
              }}
              onClick={(event) => {
                openCm(event.clientX, event.clientY, name, uid);
              }}
            >
              {showChatAvatar && avatar && (
                <img
                  className={`chat-avatar ${badges && badges.includes('totw-winner') ? 'totw-winner' : ''}`}
                  alt=""
                  title={name}
                  src={avatar}
                />
              )}
              {showChatFlag && (
                <img
                  className="chatflag"
                  alt=""
                  title={country}
                  src={cdn`/cf/${country}.gif`}
                />
              )}
              {faction && faction.tag && (
                <span
                  className="chatfaction"
                  style={{
                    color: setBrightness(colorFromText(faction.tag), isDarkMode),
                    cursor: 'pointer',
                    marginRight: 4,
                  }}
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFactionClick) onFactionClick(faction.id);
                  }}
                  title={faction.name}
                >
                  [{faction.tag}]
                </span>
              )}
              <span
                className="chatname"
                style={{
                  color: setBrightness(colorFromText(name), isDarkMode),
                }}
                title={name}
              >
                {name}
              </span>
              {badges && badges.length > 0 && (
                <span className="chatbadges">
                  {badges.map((badge) => (
                    <img
                      key={badge}
                      className="chatbadge"
                      alt={badge}
                      title={badge}
                      src={`/badges/${badge}.gif`}
                    />
                  ))}
                </span>
              )}
              {': '}
            </span>
          )}
          <MdParagraph refEmbed={refEmbed} text={msg} />
        </span>
        <span className="chatts">
          {getDateTimeString(ts)}
        </span>
      </div>
    </li>
  );
}

export default React.memo(ChatMessage);
