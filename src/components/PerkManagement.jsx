import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { FaPalette, FaCheck, FaCrown, FaStar } from 'react-icons/fa';

const PerkManagement = () => {
  const isVip = useSelector((state) => state.user.isVip);
  const isPremium = useSelector((state) => state.user.isPremium);
  const currentNicknameStyle = useSelector((state) => state.user.nicknameStyle);
  const currentProfileCustomization = useSelector((state) => state.user.profileCustomization);

  const [colors, setColors] = useState([]);
  const [gradients, setGradients] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [frames, setFrames] = useState([]);
  const [selectedBadges, setSelectedBadges] = useState([]);

  const [nicknameType, setNicknameType] = useState(currentNicknameStyle?.type || 'default');
  const [nicknameValue, setNicknameValue] = useState(currentNicknameStyle?.value || null);
  const [profileBackground, setProfileBackground] = useState(currentProfileCustomization?.background || 'default');
  const [profileFrame, setProfileFrame] = useState(currentProfileCustomization?.frame || 'none');
  const [profileBio, setProfileBio] = useState(currentProfileCustomization?.bio || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [nicknameRes, profileRes, badgesRes] = await Promise.all([
          fetch('/api/donations/nickname/options'),
          fetch('/api/donations/profile/options'),
          fetch('/api/donations/badges/current'),
        ]);

        if (nicknameRes.ok) {
          const nicknameData = await nicknameRes.json();
          setColors(nicknameData.colors || []);
          setGradients(nicknameData.gradients || []);
        }

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setBackgrounds(profileData.backgrounds || []);
          setFrames(profileData.frames || []);
        }

        if (badgesRes.ok) {
          const badgesData = await badgesRes.json();
          setSelectedBadges(badgesData.badges || []);
        }
      } catch (err) {
        console.error('Failed to fetch perk options:', err);
      }
    };

    if (isVip || isPremium) {
      fetchOptions();
    }
  }, [isVip, isPremium]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const requests = [];

      requests.push(
        fetch('/api/donations/nickname/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: nicknameType, value: nicknameValue }),
        }),
      );

      if (isPremium) {
        requests.push(
          fetch('/api/donations/profile/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              background: profileBackground,
              frame: profileFrame,
              bio: profileBio,
            }),
          }),
        );
      }

      requests.push(
        fetch('/api/donations/badges/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ badges: selectedBadges }),
        }),
      );

      const responses = await Promise.all(requests);
      const allOk = responses.every((res) => res.ok);

      if (!allOk) {
        setError(t`Failed to save some settings`);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(t`Network error`);
    } finally {
      setLoading(false);
    }
  }, [nicknameType, nicknameValue, isPremium, profileBackground, profileFrame, profileBio, selectedBadges]);

  const toggleBadge = (badge) => {
    setSelectedBadges((prev) => {
      if (prev.includes(badge)) {
        return prev.filter((b) => b !== badge);
      }
      return [...prev, badge];
    });
  };

  if (!isVip && !isPremium) {
    return null;
  }

  const availableBadges = [];
  if (isVip) availableBadges.push('vip');
  if (isPremium) availableBadges.push('premium');

  return (
    <div style={{ marginTop: 16, padding: 12, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4 }}>
      <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <FaPalette />
        {t`VIP/Premium Perks`}
      </h3>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Chat Badges`}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {availableBadges.map((badge) => (
            <button
              key={badge}
              type="button"
              onClick={() => toggleBadge(badge)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: selectedBadges.includes(badge) ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: selectedBadges.includes(badge) ? '#f0fdf4' : 'white',
              }}
            >
              <img src={`/badges/${badge}.gif`} alt={badge} style={{ height: 16 }} />
              {badge === 'vip' ? <FaStar /> : <FaCrown />}
              {badge.toUpperCase()}
              {selectedBadges.includes(badge) && <FaCheck style={{ color: '#22c55e' }} />}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, margin: '4px 0 0 0', opacity: 0.7 }}>
          {t`Select badges to display next to your name in chat`}
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Nickname Color`}</h4>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              name="nicknameType"
              value="default"
              checked={nicknameType === 'default'}
              onChange={() => {
                setNicknameType('default');
                setNicknameValue(null);
              }}
            />
            <span>{t`Default`}</span>
          </label>
        </div>
        {colors.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {colors.map((color) => (
              <button
                key={color.id}
                type="button"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  backgroundColor: color.hex,
                  border: nicknameType === 'color' && nicknameValue === color.id ? '3px solid #000' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
                onClick={() => {
                  setNicknameType('color');
                  setNicknameValue(color.id);
                }}
                title={color.name}
              />
            ))}
          </div>
        )}
        {isPremium && gradients.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {gradients.map((gradient) => {
              const gradientStyle = `linear-gradient(90deg, ${gradient.colors.join(', ')})`;
              return (
                <button
                  key={gradient.id}
                  type="button"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    background: gradientStyle,
                    border: nicknameType === 'gradient' && nicknameValue === gradient.id ? '3px solid #000' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => {
                    setNicknameType('gradient');
                    setNicknameValue(gradient.id);
                  }}
                  title={gradient.name}
                />
              );
            })}
          </div>
        )}
      </div>

      {isPremium && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Profile Background`}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: profileBackground === bg.id ? '2px solid #000' : '1px solid rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    fontSize: 11,
                    ...(bg.value ? { background: bg.value, color: 'white' } : {}),
                  }}
                  onClick={() => setProfileBackground(bg.id)}
                >
                  {bg.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Profile Frame`}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {frames.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: profileFrame === frame.id ? '2px solid #000' : (frame.borderStyle !== 'none' ? frame.borderStyle : '1px solid rgba(0,0,0,0.2)'),
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                  onClick={() => setProfileFrame(frame.id)}
                >
                  {frame.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Profile Bio`}</h4>
            <textarea
              style={{
                width: '100%',
                minHeight: 50,
                padding: 6,
                border: '1px solid rgba(0,0,0,0.2)',
                borderRadius: 4,
                fontFamily: 'inherit',
                fontSize: 13,
                resize: 'vertical',
              }}
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              placeholder={t`Tell others about yourself...`}
              maxLength={500}
            />
            <span style={{ fontSize: 11, opacity: 0.7 }}>{profileBio.length}/500</span>
          </div>
        </>
      )}

      {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
      {success && <p style={{ color: '#16a34a', fontSize: 13 }}>{t`Saved successfully!`}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        style={{ width: '100%' }}
      >
        {loading ? t`Saving...` : t`Save All Perks`}
      </button>
    </div>
  );
};

export default PerkManagement;
