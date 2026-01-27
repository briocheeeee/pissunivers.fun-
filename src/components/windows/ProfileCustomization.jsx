import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { FaUser, FaCheck } from 'react-icons/fa';

const ProfileCustomization = () => {
  const isPremium = useSelector((state) => state.user.isPremium);
  const currentCustomization = useSelector((state) => state.user.profileCustomization);

  const [backgrounds, setBackgrounds] = useState([]);
  const [frames, setFrames] = useState([]);
  const [selectedBackground, setSelectedBackground] = useState(currentCustomization?.background || 'default');
  const [selectedFrame, setSelectedFrame] = useState(currentCustomization?.frame || 'none');
  const [bio, setBio] = useState(currentCustomization?.bio || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('/api/donations/profile/options');
        if (response.ok) {
          const data = await response.json();
          setBackgrounds(data.backgrounds || []);
          setFrames(data.frames || []);
        }
      } catch (err) {
        console.error('Failed to fetch profile options:', err);
      }
    };

    if (isPremium) {
      fetchOptions();
    }
  }, [isPremium]);

  useEffect(() => {
    if (currentCustomization) {
      setSelectedBackground(currentCustomization.background || 'default');
      setSelectedFrame(currentCustomization.frame || 'none');
      setBio(currentCustomization.bio || '');
    }
  }, [currentCustomization]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/donations/profile/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          background: selectedBackground,
          frame: selectedFrame,
          bio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save');
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [selectedBackground, selectedFrame, bio]);

  const getBackgroundStyle = (bgId) => {
    const bg = backgrounds.find((b) => b.id === bgId);
    return bg?.value ? { background: bg.value } : {};
  };

  const getFrameStyle = (frameId) => {
    const frame = frames.find((f) => f.id === frameId);
    return frame?.borderStyle && frame.borderStyle !== 'none'
      ? { border: frame.borderStyle }
      : {};
  };

  if (!isPremium) {
    return (
      <div className="content">
        <h3><FaUser style={{ marginRight: 8 }} />{t`Profile Customization`}</h3>
        <p className="modalinfo">{t`This feature is exclusive to Premium members.`}</p>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="setrow">
        <FaUser style={{ marginRight: 8, fontSize: 18 }} />
        <h3 className="settitle" style={{ margin: 0 }}>{t`Profile Customization`}</h3>
        <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: '#ede9fe', color: '#7c3aed' }}>PREMIUM</span>
      </div>

      <div className="setitem">
        <p className="modaldesc">{t`Preview`}:</p>
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            ...getBackgroundStyle(selectedBackground),
            ...getFrameStyle(selectedFrame),
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            <FaUser />
          </div>
          <div>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 16 }}>{t`Your Name`}</span>
            <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>{bio || t`Your bio here...`}</span>
          </div>
        </div>
      </div>

      <div className="modaldivider" />

      <div className="setitem">
        <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Background`}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              type="button"
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: selectedBackground === bg.id ? '2px solid #000' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 12,
                ...(bg.value ? { background: bg.value, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' } : {}),
              }}
              onClick={() => setSelectedBackground(bg.id)}
              title={bg.name}
            >
              {bg.name}
              {selectedBackground === bg.id && <FaCheck style={{ marginLeft: 4 }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="setitem">
        <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Frame`}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: selectedFrame === frame.id ? '2px solid #000' : (frame.borderStyle !== 'none' ? frame.borderStyle : '2px solid transparent'),
                cursor: 'pointer',
                fontSize: 12,
              }}
              onClick={() => setSelectedFrame(frame.id)}
              title={frame.name}
            >
              {frame.name}
              {selectedFrame === frame.id && <FaCheck style={{ marginLeft: 4 }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="setitem">
        <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Bio`}</h3>
        <textarea
          style={{
            width: '100%',
            minHeight: 60,
            padding: 8,
            border: '1px solid rgba(0,0,0,0.2)',
            borderRadius: 4,
            fontFamily: 'inherit',
            fontSize: 14,
            resize: 'vertical',
          }}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t`Tell others about yourself...`}
          maxLength={500}
        />
        <span className="modaldesc" style={{ textAlign: 'right' }}>{bio.length}/500</span>
      </div>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {success && <p style={{ color: '#16a34a' }}>{t`Saved successfully!`}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        style={{ marginTop: 8 }}
      >
        {loading ? t`Saving...` : t`Save Changes`}
      </button>
    </div>
  );
};

export default ProfileCustomization;
