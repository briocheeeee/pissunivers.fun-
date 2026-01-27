import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { cdn } from '../utils/utag.js';
import { pAlert } from '../store/actions/index.js';

const BadgeCustomization = ({ done }) => {
  const dispatch = useDispatch();
  const badges = useSelector((state) => state.profile.badges);

  const [displayedBadges, setDisplayedBadges] = useState([]);
  const [featuredBadge, setFeaturedBadge] = useState(null);
  const [badgeOrder, setBadgeOrder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedBadge, setDraggedBadge] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/profile/badge-display', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const db = data.displayedBadges;
          const bo = data.badgeOrder;
          setDisplayedBadges(Array.isArray(db) ? db : []);
          setFeaturedBadge(data.featuredBadge ?? null);
          setBadgeOrder(Array.isArray(bo) ? bo : []);
        }
      } catch (err) {
        console.error('Failed to fetch badge display settings:', err);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const toggleBadgeDisplay = useCallback((badgeId) => {
    setDisplayedBadges((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(badgeId)) {
        return arr.filter((id) => id !== badgeId);
      }
      return [...arr, badgeId];
    });
  }, []);

  const setAsFeatured = useCallback((badgeId) => {
    setFeaturedBadge((prev) => (prev === badgeId ? null : badgeId));
  }, []);

  const handleDragStart = useCallback((badgeId) => {
    setDraggedBadge(badgeId);
  }, []);

  const handleDragOver = useCallback((e, targetId) => {
    e.preventDefault();
    if (draggedBadge === null || draggedBadge === targetId) return;

    setBadgeOrder((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const currentOrder = arr.length > 0 ? [...arr] : badges.map((b) => b.id);
      const dragIdx = currentOrder.indexOf(draggedBadge);
      const targetIdx = currentOrder.indexOf(targetId);

      if (dragIdx === -1 || targetIdx === -1) return arr;

      currentOrder.splice(dragIdx, 1);
      currentOrder.splice(targetIdx, 0, draggedBadge);
      return currentOrder;
    });
  }, [draggedBadge, badges]);

  const handleDragEnd = useCallback(() => {
    setDraggedBadge(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/profile/badge-display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayedBadges,
          featuredBadge,
          badgeOrder,
        }),
      });

      if (response.ok) {
        dispatch(pAlert(t`Success`, t`Badge display settings saved`, 'info'));
        done();
      } else {
        const data = await response.json();
        dispatch(pAlert(t`Error`, data.error || t`Failed to save`, 'error'));
      }
    } catch (err) {
      dispatch(pAlert(t`Error`, err.message, 'error'));
    }
    setSaving(false);
  }, [displayedBadges, featuredBadge, badgeOrder, dispatch, done]);

  const getSortedBadges = useCallback(() => {
    const order = Array.isArray(badgeOrder) ? badgeOrder : [];
    const badgeList = Array.isArray(badges) ? badges : [];
    if (order.length === 0) return badgeList;
    return [...badgeList].sort((a, b) => {
      const aIdx = order.indexOf(a.id);
      const bIdx = order.indexOf(b.id);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [badges, badgeOrder]);

  if (loading) {
    return (
      <div className="inarea">
        <p>{t`Loading...`}</p>
      </div>
    );
  }

  if (!badges.length) {
    return (
      <div className="inarea">
        <h3>{t`Badge Customization`}</h3>
        <p>{t`You don't have any badges yet.`}</p>
        <button type="button" onClick={done}>{t`Close`}</button>
      </div>
    );
  }

  const sortedBadges = getSortedBadges();
  const showAll = displayedBadges.length === 0;

  return (
    <div className="inarea">
      <h3>{t`Badge Customization`}</h3>
      <p className="modaldesc">{t`Choose which badges to display on your public profile. Drag to reorder.`}</p>

      <div className="badge-customization-list">
        {sortedBadges.map((badge) => {
          const thumbName = badge.thumb || `${badge.name.toLowerCase().replace(/\s+/g, '')}.webp`;
          const isDisplayed = showAll || displayedBadges.includes(badge.id);
          const isFeatured = featuredBadge === badge.id;

          return (
            <div
              key={badge.id}
              className={`badge-customization-item ${isDisplayed ? 'displayed' : 'hidden'} ${isFeatured ? 'featured' : ''} ${draggedBadge === badge.id ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(badge.id)}
              onDragOver={(e) => handleDragOver(e, badge.id)}
              onDragEnd={handleDragEnd}
            >
              <div className="badge-customization-preview">
                <img
                  src={cdn`/badges/thumb/${thumbName}`}
                  alt={badge.name}
                  className="badge-customization-img"
                />
              </div>
              <div className="badge-customization-info">
                <span className="badge-customization-name">{badge.name}</span>
                <span className="badge-customization-desc">{badge.description}</span>
              </div>
              <div className="badge-customization-actions">
                <button
                  type="button"
                  className={`badge-toggle-btn ${isDisplayed ? 'active' : ''}`}
                  onClick={() => toggleBadgeDisplay(badge.id)}
                  title={isDisplayed ? t`Hide` : t`Show`}
                >
                  {isDisplayed ? '👁' : '👁‍🗨'}
                </button>
                <button
                  type="button"
                  className={`badge-featured-btn ${isFeatured ? 'active' : ''}`}
                  onClick={() => setAsFeatured(badge.id)}
                  title={isFeatured ? t`Remove from featured` : t`Set as featured`}
                >
                  ⭐
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="badge-customization-footer">
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? t`Saving...` : t`Save`}
        </button>
        <button type="button" onClick={done}>{t`Cancel`}</button>
      </div>
    </div>
  );
};

export default React.memo(BadgeCustomization);
