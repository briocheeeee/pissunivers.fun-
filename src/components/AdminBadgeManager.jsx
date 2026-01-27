import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import { pAlert } from '../store/actions/index.js';

const AdminBadgeManager = () => {
  const dispatch = useDispatch();

  const [badges, setBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBadge, setSelectedBadge] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await fetch('/api/admin/badges/list', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setBadges(data.badges || []);
          if (data.badges?.length > 0) {
            setSelectedBadge(data.badges[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to fetch badges:', err);
      }
    };
    fetchBadges();
  }, []);

  const handleSearchUser = useCallback(async () => {
    if (!searchUser.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/badges/user/${encodeURIComponent(searchUser)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedUser(data.user);
        setUserBadges(data.badges || []);
      } else {
        const data = await response.json();
        dispatch(pAlert(t`Error`, data.error || t`User not found`, 'error'));
        setSelectedUser(null);
        setUserBadges([]);
      }
    } catch (err) {
      dispatch(pAlert(t`Error`, err.message, 'error'));
    }
    setLoading(false);
  }, [searchUser, dispatch]);

  const handleAwardBadge = useCallback(async () => {
    if (!selectedUser || !selectedBadge) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/badges/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedUser.id,
          badgeName: selectedBadge,
          note: note || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        dispatch(pAlert(t`Success`, data.message, 'success'));
        handleSearchUser();
        setNote('');
      } else {
        dispatch(pAlert(t`Error`, data.error, 'error'));
      }
    } catch (err) {
      dispatch(pAlert(t`Error`, err.message, 'error'));
    }
    setLoading(false);
  }, [selectedUser, selectedBadge, note, dispatch, handleSearchUser]);

  const handleRevokeBadge = useCallback(async (badgeName) => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/badges/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedUser.id,
          badgeName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        dispatch(pAlert(t`Success`, data.message, 'success'));
        handleSearchUser();
      } else {
        dispatch(pAlert(t`Error`, data.error, 'error'));
      }
    } catch (err) {
      dispatch(pAlert(t`Error`, err.message, 'error'));
    }
    setLoading(false);
  }, [selectedUser, dispatch, handleSearchUser]);

  return (
    <div className="admin-badge-manager">
      <h3>{t`Badge Manager`}</h3>

      <div className="admin-badge-search">
        <input
          type="text"
          placeholder={t`Username or ID`}
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
        />
        <button type="button" onClick={handleSearchUser} disabled={loading}>
          {t`Search`}
        </button>
      </div>

      {selectedUser && (
        <div className="admin-badge-user">
          <h4>{t`User`}: {selectedUser.name} (ID: {selectedUser.id})</h4>

          <div className="admin-badge-current">
            <h5>{t`Current Badges`}</h5>
            {userBadges.length === 0 ? (
              <p className="admin-badge-empty">{t`No badges`}</p>
            ) : (
              <ul className="admin-badge-list">
                {userBadges.map((badge) => (
                  <li key={badge.id} className="admin-badge-item">
                    <span className="admin-badge-name">{badge.name}</span>
                    <span className="admin-badge-desc">{badge.description}</span>
                    {badge.note && <span className="admin-badge-note">({badge.note})</span>}
                    <button
                      type="button"
                      className="admin-badge-revoke"
                      onClick={() => handleRevokeBadge(badge.name)}
                      disabled={loading}
                    >
                      {t`Revoke`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="admin-badge-award">
            <h5>{t`Award Badge`}</h5>
            <div className="admin-badge-form">
              <select
                value={selectedBadge}
                onChange={(e) => setSelectedBadge(e.target.value)}
              >
                {badges.map((badge) => (
                  <option key={badge.id} value={badge.name}>
                    {badge.name} - {badge.description}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t`Note (optional)`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="button" onClick={handleAwardBadge} disabled={loading}>
                {t`Award`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(AdminBadgeManager);
