import React, { useState } from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import {
  durationToString,
} from '../core/utils.js';

const CoolDownBox = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coolDown, modifiers] = useSelector(
    (state) => [state.user.coolDown, state.user.coolDownModifiers],
    shallowEqual,
  );

  const renderModifiers = () => {
    if (!modifiers) return null;
    const items = [];
    if (modifiers.base) {
      items.push(
        <div key="base" className="cdmod-item">
          <span className="cdmod-label">{t`Base cooldown`}:</span>
          <span className="cdmod-value">{modifiers.base}s</span>
        </div>,
      );
    }
    if (modifiers.country && modifiers.country !== 1) {
      const percent = Math.round((modifiers.country - 1) * 100);
      const sign = percent > 0 ? '+' : '';
      items.push(
        <div key="country" className="cdmod-item">
          <span className="cdmod-label">{t`Country modifier`}:</span>
          <span className={`cdmod-value ${percent > 0 ? 'cdmod-neg' : 'cdmod-pos'}`}>
            {sign}{percent}%
          </span>
        </div>,
      );
    }
    if (modifiers.event && modifiers.event !== 1) {
      const percent = Math.round((modifiers.event - 1) * 100);
      const sign = percent > 0 ? '+' : '';
      items.push(
        <div key="event" className="cdmod-item">
          <span className="cdmod-label">{t`Event bonus`}:</span>
          <span className={`cdmod-value ${percent > 0 ? 'cdmod-neg' : 'cdmod-pos'}`}>
            {sign}{percent}%
          </span>
        </div>,
      );
    }
    if (modifiers.factor && modifiers.factor !== 1) {
      const percent = Math.round((modifiers.factor - 1) * 100);
      const sign = percent > 0 ? '+' : '';
      items.push(
        <div key="factor" className="cdmod-item">
          <span className="cdmod-label">{t`Total modifier`}:</span>
          <span className={`cdmod-value ${percent > 0 ? 'cdmod-neg' : 'cdmod-pos'}`}>
            {sign}{percent}%
          </span>
        </div>,
      );
    }
    return items.length > 0 ? items : (
      <div className="cdmod-item">
        <span className="cdmod-label">{t`No modifiers active`}</span>
      </div>
    );
  };

  return (
    <div
      className={(coolDown && coolDown >= 300) ? 'cooldownbox show' : 'cooldownbox'}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {coolDown && durationToString(coolDown, true)}
      {showTooltip && modifiers && (
        <div className="cdmod-tooltip">
          <div className="cdmod-title">{t`Cooldown Details`}</div>
          {renderModifiers()}
        </div>
      )}
    </div>
  );
};

export default React.memo(CoolDownBox);
