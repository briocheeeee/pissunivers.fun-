import React, { useEffect, useState, useCallback, useContext } from 'react';
import { t } from 'ttag';

import { requestPublicProfile } from '../store/actions/fetch.js';
import { numberToString } from '../core/utils.js';
import WindowContext from './context/window.js';

const USERLVL_LABELS = {
  3: 'Mod',
  4: 'Admin',
};

function getStatus(status) {
  if (status === 'online') return { label: t`Online`, cls: 'pub-profile-status--online' };
  if (status === 'idle') return { label: t`Idle`, cls: 'pub-profile-status--idle' };
  return { label: t`Offline`, cls: 'pub-profile-status--offline' };
}

function StatBox({ label, value, rank }) {
  return (
    <div className="pub-profile-stat-box">
      <span className="pub-profile-stat-label">{label}</span>
      <span className="pub-profile-stat-value">
        {rank && value ? '#' : ''}{numberToString(value, '0')}
      </span>
    </div>
  );
}

function formatLocalDate(dateMs) {
  const d = new Date(dateMs);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PublicProfile = () => {
  const { args, setTitle } = useContext(WindowContext);
  const uid = args?.uid;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    const result = await requestPublicProfile(uid);
    if (result.errors) {
      setError(result.errors[0]);
    } else {
      setProfile(result);
      if (setTitle) setTitle(result.name);
    }
    setLoading(false);
  }, [uid, setTitle]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="content pub-profile-state">{t`Loading...`}</div>
    );
  }

  if (error || !profile) {
    return (
      <div className="content pub-profile-state pub-profile-state--error">
        {error || t`User not found.`}
      </div>
    );
  }

  const { label: statusLabel, cls: statusCls } = getStatus(profile.status);

  return (
    <div
      className="content pub-profile-root"
      style={{
        width: '100%',
        maxWidth: 620,
        margin: '0 auto',
      }}
    >
      <div
        className="pub-profile-banner-wrap"
        style={{
          position: 'relative',
          height: 124,
          maxHeight: 124,
          minHeight: 124,
        }}
      >
        {profile.banner
          ? (
            <img
              src={profile.banner}
              alt=""
              className="pub-profile-banner-img"
              style={{
                width: '100%',
                height: '100%',
                maxHeight: 124,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )
          : <div className="pub-profile-banner-placeholder" />}
        <div
          className="pub-profile-avatar-ring"
          style={{
            position: 'absolute',
            left: 12,
            bottom: -30,
            width: 108,
            height: 108,
            maxWidth: 108,
            maxHeight: 108,
            minWidth: 108,
            minHeight: 108,
            borderRadius: '50%',
            overflow: 'hidden',
            zIndex: 4,
          }}
        >
          {profile.avatar
            ? (
              <img
                src={profile.avatar}
                alt="Avatar"
                className="pub-profile-avatar-img"
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: 108,
                  maxHeight: 108,
                  objectFit: 'cover',
                  objectPosition: 'center',
                  display: 'block',
                }}
              />
            )
            : <div className="pub-profile-avatar-placeholder">?</div>}
        </div>
      </div>

      <div className="pub-profile-body" style={{ paddingTop: 44 }}>
        <div className="pub-profile-name-row">
          <div className="pub-profile-name-block">
            {USERLVL_LABELS[profile.userlvl] && (
              <span className="pub-profile-userlvl-badge">
                {USERLVL_LABELS[profile.userlvl]}
              </span>
            )}
            <span className="pub-profile-name">{profile.name}</span>
          </div>
        </div>

        {profile.description && (
          <p className="pub-profile-description">{profile.description}</p>
        )}

        <div className={`pub-profile-status ${statusCls}`}>
          <span className="pub-profile-status-dot" />
          {statusLabel}
        </div>

        <div className="pub-profile-meta">
          <p className="pub-profile-meta-line">
            <span className="pub-profile-meta-key">{t`User ID:`}</span>
            {` #${profile.id}`}
          </p>
          <p className="pub-profile-meta-line">
            <span className="pub-profile-meta-key">{t`Last login:`}</span>
            {` ${profile.lastSeen
              ? formatLocalDate(new Date(profile.lastSeen).getTime())
              : t`Unknown`}`}
          </p>
          <p className="pub-profile-meta-line">
            <span className="pub-profile-meta-key">{t`Registered:`}</span>
            {` ${profile.createdAt
              ? formatLocalDate(new Date(profile.createdAt).getTime())
              : t`Unknown`}`}
          </p>
        </div>

        <div className="pub-profile-stats-grid">
          <StatBox label={t`Total Rank:`} value={profile.totalRanking} rank />
          <StatBox label={t`Placed Pixels:`} value={profile.totalPixels} />
          <StatBox label={t`Daily Rank:`} value={profile.dailyRanking} rank />
          <StatBox label={t`Today Placed Pixels:`} value={profile.dailyPixels} />
        </div>
      </div>
    </div>
  );
};

export default React.memo(PublicProfile);
