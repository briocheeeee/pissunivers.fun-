/*
 * Menu to change user credentials
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { t } from 'ttag';

import UserMessages from './UserMessages.jsx';
import FishList from './FishList.jsx';
import BadgeList from './BadgeList.jsx';
import ChangePassword from './ChangePassword.jsx';
import ChangeName from './ChangeName.jsx';
import ChangeUsername from './ChangeUsername.jsx';
import ChangeMail from './ChangeMail.jsx';
import DeleteAccount from './DeleteAccount.jsx';
import LogInForm from './LogInForm.jsx';
import SocialSettings from './SocialSettings.jsx';
import ChangeAvatar from './ChangeAvatar.jsx';
import PerkManagement from './PerkManagement.jsx';
import BadgeCustomization from './BadgeCustomization.jsx';
import { logoutUser } from '../store/actions/index.js';
import { requestLogOut } from '../store/actions/fetch.js';
import { numberToString } from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';
import { fetchProfile } from '../store/actions/thunks.js';

const AREAS = {
  CHANGE_NAME: ChangeName,
  CHANGE_USERNAME: ChangeUsername,
  CHANGE_MAIL: ChangeMail,
  CHANGE_PASSWORD: ChangePassword,
  DELETE_ACCOUNT: DeleteAccount,
  SOCIAL_SETTINGS: SocialSettings,
  CHANGE_AVATAR: ChangeAvatar,
  BADGE_CUSTOMIZATION: BadgeCustomization,
};

const Stat = ({
  text, value, rank, zero,
}) => (
  <p>
    <span className="stattext">{(rank) ? `${text}: #` : `${text}: `}</span>
    &nbsp;
    <span className="statvalue">{numberToString(value, zero)}</span>
  </p>
);

const UserAreaContent = () => {
  const [area, setArea] = useState('NONE');

  const dispatch = useDispatch();
  const logout = useCallback(async () => {
    const ret = await requestLogOut();
    if (ret) {
      dispatch(logoutUser());
    }
  }, [dispatch]);

  const isDarkMode = useSelector(selectIsDarkMode);
  const lastProfileFetch = useSelector((state) => state.profile.lastFetch);
  const [
    name,
    havePassword,
    username,
    id,
    avatar,
  ] = useSelector((state) => [
    state.user.name,
    state.user.havePassword,
    state.user.username,
    state.user.id,
    state.user.avatar,
  ], shallowEqual);
  const [
    totalPixels,
    dailyTotalPixels,
    ranking,
    dailyRanking,
  ] = useSelector((state) => [
    state.ranks.totalPixels,
    state.ranks.dailyTotalPixels,
    state.ranks.ranking,
    state.ranks.dailyRanking,
  ], shallowEqual);

  useEffect(() => {
    if (username && Date.now() - 600000 > lastProfileFetch) {
      dispatch(fetchProfile());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastProfileFetch, username]);

  if (!name) {
    return <LogInForm title={t`Login to access more features and stats.`} />;
  }

  const Area = AREAS[area];

  return (
    <div className="content">
      <UserMessages />
      <div className="profile-layout">
        <div className="profile-left">
          <div className="profile-avatar-section">
            <div
              className="profile-avatar"
              role="button"
              tabIndex={0}
              onClick={() => setArea('CHANGE_AVATAR')}
              onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_AVATAR')}
              title={t`Change Avatar`}
              aria-label={t`Change Avatar`}
            >
              {avatar ? (
                <img src={avatar} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">?</div>
              )}
            </div>
          </div>
          <p className="profile-id">Id: {id}</p>
          <p className="profile-username">{t`Your username is:`} {username}</p>
        </div>
        <div className="profile-right">
          <Stat
            text={t`Today Placed Pixels`}
            value={dailyTotalPixels}
          />
          <Stat
            text={t`Daily Rank`}
            value={dailyRanking}
            zero="N/A"
            rank
          />
          <Stat
            text={t`Placed Pixels`}
            value={totalPixels}
          />
          <Stat
            text={t`Total Rank`}
            value={ranking}
            zero="N/A"
            rank
          />
        </div>
      </div>
      <BadgeList />
      <FishList />
      <PerkManagement />
      <div>
        <p>
          {t`Your name is:`}<span className="statvalue">{` ${name} `}</span>
          [{` ${username} `}]
        </p>(
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={logout}
          onKeyDown={(e) => e.key === 'Enter' && logout()}
        > {t`Log out`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={() => setArea('CHANGE_NAME')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_NAME')}
        > {t`Change Name`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={() => setArea('CHANGE_AVATAR')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_AVATAR')}
        > {t`Change Avatar`}</span>
        <span className="hdivider" />
        {(username.startsWith('pp_')) && (
          <React.Fragment key="choseun">
            <span
              role="button"
              tabIndex={0}
              style={{
                fontWeight: 'bold',
                color: (isDarkMode) ? '#fcff4b' : '#8f270d',
              }}
              className="modallink"
              onClick={() => setArea('CHANGE_USERNAME')}
              onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_USERNAME')}
            > {t`Choose Username`}</span>
            <span className="hdivider" />
          </React.Fragment>
        )}
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={() => setArea('CHANGE_MAIL')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_MAIL')}
        > {t`Login Methods`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={0}
          style={(havePassword) ? {} : {
            fontWeight: 'bold',
            color: (isDarkMode) ? '#fcff4b' : '#8f270d',
          }}
          className="modallink"
          onClick={() => setArea('CHANGE_PASSWORD')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_PASSWORD')}
        > {(havePassword) ? t`Change Password` : t`Set Password`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={() => setArea('DELETE_ACCOUNT')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('DELETE_ACCOUNT')}
        > {t`Delete Account`}</span> )
        <br />(
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={() => setArea('SOCIAL_SETTINGS')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('SOCIAL_SETTINGS')}
        > {t`Social Settings`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={() => setArea('BADGE_CUSTOMIZATION')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('BADGE_CUSTOMIZATION')}
        > {t`Customize Badges`}</span> )
      </div>
      {(Area) && <Area key="area" done={() => setArea(null)} />}
    </div>
  );
};

export default React.memo(UserAreaContent);
