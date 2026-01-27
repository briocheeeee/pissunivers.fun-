/**
 *
 */

import React from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import {
  FaUser,
  FaPaintBrush,
  FaFlipboard,
  FaCalendarDay,
} from 'react-icons/fa';
import { t } from 'ttag';

import {
  toggleOnlineCanvas,
  toggleNoRound,
  toggleDailyPxls,
} from '../store/actions/index.js';
import { numberToString, numberToStringFull } from '../core/utils.js';


const OnlineBox = () => {
  const [
    online,
    totalPixels,
    dailyTotalPixels,
    name,
    onlineCanvas,
    dailyPxls,
    noRound,
    canvasId,
  ] = useSelector((state) => [
    state.ranks.online,
    state.ranks.totalPixels,
    state.ranks.dailyTotalPixels,
    state.user.name,
    state.gui.onlineCanvas,
    state.gui.dailyPxls,
    state.gui.noRound,
    state.canvas.canvasId,
  ], shallowEqual);
  const dispatch = useDispatch();

  let pixelAmount = (dailyPxls) ? dailyTotalPixels : totalPixels;
  pixelAmount = (noRound)
    ? numberToStringFull(pixelAmount) : numberToString(pixelAmount);

  return (
    <div
      className="onlinebox"
    >
      {(onlineCanvas)
        ? (
          <span
            title={t`Online Users on Canvas`}
            role="button"
            tabIndex="0"
            key="onlinec"
            onClick={() => dispatch(toggleOnlineCanvas())}
          >
            {online[canvasId] || 0}&nbsp;<FaUser /><FaFlipboard />
          </span>
        )
        : (
          <span
            role="button"
            tabIndex="0"
            key="onlinec"
            onClick={() => dispatch(toggleOnlineCanvas())}
            title={t`Total Online Users`}
          >
            {online.total}&nbsp;<FaUser />
          </span>
        )}
       &nbsp;
      {(name != null)
        && (
          <React.Fragment key="plxc">
            <span
              role="button"
              tabIndex="0"
              onClick={() => dispatch(toggleNoRound())}
              title={t`Placed Pixels`}
            >
              {pixelAmount}
            </span>&nbsp;
            <span
              role="button"
              tabIndex="0"
              onClick={() => dispatch(toggleDailyPxls())}
              title={(dailyPxls) ? t`Today` : t`Total`}
            >
              {(dailyPxls) ? <FaCalendarDay /> : <FaPaintBrush />}
            </span>
          </React.Fragment>
        )}
    </div>
  );
};

export default React.memo(OnlineBox);
