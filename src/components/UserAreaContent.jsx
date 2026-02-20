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
import ChangeBanner from './ChangeBanner.jsx';
import ChangeDescription from './ChangeDescription.jsx';
import BadgeCustomization from './BadgeCustomization.jsx';
import { logoutUser } from '../store/actions/index.js';
import { requestLogOut } from '../store/actions/fetch.js';
import { numberToString } from '../core/utils.js';
import { fetchProfile } from '../store/actions/thunks.js';

const AREAS = {
  CHANGE_NAME: ChangeName,
  CHANGE_USERNAME: ChangeUsername,
  CHANGE_MAIL: ChangeMail,
  CHANGE_PASSWORD: ChangePassword,
  DELETE_ACCOUNT: DeleteAccount,
  SOCIAL_SETTINGS: SocialSettings,
  CHANGE_AVATAR: ChangeAvatar,
  CHANGE_BANNER: ChangeBanner,
  CHANGE_DESCRIPTION: ChangeDescription,
  BADGE_CUSTOMIZATION: BadgeCustomization,
};

const StatCard = ({
  label, value, rank, zero, accent,
}) => (
  <div className={`ua-stat-card${accent ? ' ua-stat-card--accent' : ''}`}>
    <span className="ua-stat-value">
      {rank && '#'}{numberToString(value, zero)}
    </span>
    <span className="ua-stat-label">{label}</span>
  </div>
);

const ActionBtn = ({
  onClick, onKeyDown, children, variant,
}) => (
  <button
    type="button"
    className={`ua-action-btn${variant ? ` ua-action-btn--${variant}` : ''}`}
    onClick={onClick}
    onKeyDown={onKeyDown}
  >
    {children}
  </button>
);

const SectionBlock = ({ title, children }) => (
  <div className="ua-section">
    <div className="ua-section-title">{title}</div>
    <div className="ua-section-body">{children}</div>
  </div>
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

  const lastProfileFetch = useSelector((state) => state.profile.lastFetch);
  const [
    name,
    havePassword,
    username,
    id,
    avatar,
    banner,
    description,
  ] = useSelector((state) => [
    state.user.name,
    state.user.havePassword,
    state.user.username,
    state.user.id,
    state.user.avatar,
    state.user.banner,
    state.user.description,
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
    <div className="ua-root">
      <UserMessages />

      <div className="ua-profile-card">
        <div
          className="ua-banner"
          role="button"
          tabIndex={0}
          onClick={() => setArea('CHANGE_BANNER')}
          onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_BANNER')}
          title={t`Change Banner`}
          aria-label={t`Change Banner`}
        >
          {banner
            ? <img src={banner} alt="Banner" className="ua-banner-img" />
            : <div className="ua-banner-placeholder" />}
          <span className="ua-banner-hint">{t`Change Banner`}</span>
        </div>

        <div className="ua-profile-body">
          <div className="ua-avatar-wrap">
            <div
              className="ua-avatar"
              role="button"
              tabIndex={0}
              onClick={() => setArea('CHANGE_AVATAR')}
              onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_AVATAR')}
              title={t`Change Avatar`}
              aria-label={t`Change Avatar`}
            >
              {avatar
                ? <img src={avatar} alt="Avatar" className="ua-avatar-img" />
                : <span className="ua-avatar-placeholder">?</span>}
            </div>
          </div>

          <div className="ua-identity">
            <div className="ua-display-name">{name}</div>
            <div className="ua-username-row">
              <span className="ua-username-tag">@{username}</span>
              <span className="ua-id-badge">#{id}</span>
            </div>
            {description && (
              <div className="ua-description">{description}</div>
            )}
          </div>

          <div className="ua-stats-grid">
            <StatCard
              label={t`Pixels Today`}
              value={dailyTotalPixels}
              accent
            />
            <StatCard
              label={t`Daily Rank`}
              value={dailyRanking}
              zero="N/A"
              rank
            />
            <StatCard
              label={t`Total Pixels`}
              value={totalPixels}
            />
            <StatCard
              label={t`Total Rank`}
              value={ranking}
              zero="N/A"
              rank
            />
          </div>
        </div>
      </div>

      <div className="ua-collections">
        <BadgeList />
        <FishList />
      </div>

      <div className="ua-actions-grid">
        <SectionBlock title={t`Profile`}>
          <ActionBtn onClick={() => setArea('CHANGE_NAME')} onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_NAME')}>
            {t`Change Name`}
          </ActionBtn>
          <ActionBtn onClick={() => setArea('CHANGE_AVATAR')} onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_AVATAR')}>
            {t`Change Avatar`}
          </ActionBtn>
          <ActionBtn onClick={() => setArea('CHANGE_BANNER')} onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_BANNER')}>
            {t`Change Banner`}
          </ActionBtn>
          <ActionBtn onClick={() => setArea('CHANGE_DESCRIPTION')} onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_DESCRIPTION')}>
            {t`Change Description`}
          </ActionBtn>
          <ActionBtn onClick={() => setArea('BADGE_CUSTOMIZATION')} onKeyDown={(e) => e.key === 'Enter' && setArea('BADGE_CUSTOMIZATION')}>
            {t`Customize Badges`}
          </ActionBtn>
        </SectionBlock>

        <SectionBlock title={t`Account`}>
          {username.startsWith('pp_') && (
            <ActionBtn
              onClick={() => setArea('CHANGE_USERNAME')}
              onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_USERNAME')}
              variant="warn"
            >
              {t`Choose Username`}
            </ActionBtn>
          )}
          <ActionBtn onClick={() => setArea('CHANGE_MAIL')} onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_MAIL')}>
            {t`Login Methods`}
          </ActionBtn>
          <ActionBtn
            onClick={() => setArea('CHANGE_PASSWORD')}
            onKeyDown={(e) => e.key === 'Enter' && setArea('CHANGE_PASSWORD')}
            variant={havePassword ? '' : 'warn'}
          >
            {havePassword ? t`Change Password` : t`Set Password`}
          </ActionBtn>
          <ActionBtn onClick={() => setArea('SOCIAL_SETTINGS')} onKeyDown={(e) => e.key === 'Enter' && setArea('SOCIAL_SETTINGS')}>
            {t`Social Settings`}
          </ActionBtn>
        </SectionBlock>

        <SectionBlock title={t`Session`}>
          <ActionBtn onClick={logout} onKeyDown={(e) => e.key === 'Enter' && logout()} variant="danger">
            {t`Log Out`}
          </ActionBtn>
          <ActionBtn onClick={() => setArea('DELETE_ACCOUNT')} onKeyDown={(e) => e.key === 'Enter' && setArea('DELETE_ACCOUNT')} variant="danger">
            {t`Delete Account`}
          </ActionBtn>
        </SectionBlock>
      </div>

      {Area && <Area key="area" done={() => setArea(null)} />}
    </div>
  );
};

export default React.memo(UserAreaContent);
