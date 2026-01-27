import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { FaPalette, FaCheck } from 'react-icons/fa';

const NicknameCustomization = () => {
  const name = useSelector((state) => state.user.name);
  const isVip = useSelector((state) => state.user.isVip);
  const isPremium = useSelector((state) => state.user.isPremium);
  const currentStyle = useSelector((state) => state.user.nicknameStyle);

  const [colors, setColors] = useState([]);
  const [gradients, setGradients] = useState([]);
  const [canUseColors, setCanUseColors] = useState(false);
  const [canUseGradients, setCanUseGradients] = useState(false);
  const [selectedType, setSelectedType] = useState(currentStyle?.type || 'default');
  const [selectedValue, setSelectedValue] = useState(currentStyle?.value || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('/api/donations/nickname/options');
        const data = await response.json();
        setColors(data.colors || []);
        setGradients(data.gradients || []);
        setCanUseColors(data.canUseColors);
        setCanUseGradients(data.canUseGradients);
      } catch (err) {
        console.error('Failed to fetch nickname options:', err);
      }
    };

    if (isVip || isPremium) {
      fetchOptions();
    }
  }, [isVip, isPremium]);

  useEffect(() => {
    if (currentStyle) {
      setSelectedType(currentStyle.type || 'default');
      setSelectedValue(currentStyle.value || null);
    }
  }, [currentStyle]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/donations/nickname/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, value: selectedValue }),
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
  }, [selectedType, selectedValue]);

  const getPreviewStyle = () => {
    if (selectedType === 'default' || !selectedValue) {
      return {};
    }

    if (selectedType === 'color') {
      const color = colors.find((c) => c.id === selectedValue);
      return color ? { color: color.hex } : {};
    }

    if (selectedType === 'gradient') {
      const gradient = gradients.find((g) => g.id === selectedValue);
      if (!gradient) return {};
      const stops = gradient.colors.map((c, i) => {
        const percent = (i / (gradient.colors.length - 1)) * 100;
        return `${c} ${percent}%`;
      }).join(', ');
      return {
        background: `linear-gradient(90deg, ${stops})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      };
    }

    return {};
  };

  if (!isVip && !isPremium) {
    return (
      <div className="content">
        <h3><FaPalette style={{ marginRight: 8 }} />{t`Nickname Customization`}</h3>
        <p className="modalinfo">{t`This feature is available for VIP and Premium members.`}</p>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="setrow">
        <FaPalette style={{ marginRight: 8, fontSize: 18 }} />
        <h3 className="settitle" style={{ margin: 0 }}>{t`Nickname Customization`}</h3>
      </div>

      <div className="setitem">
        <p className="modaldesc">{t`Preview`}:</p>
        <span style={{ fontSize: 20, fontWeight: 600, ...getPreviewStyle() }}>
          {name || 'Username'}
        </span>
      </div>

      <div className="modaldivider" />

      <div className="setitem">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name="styleType"
            value="default"
            checked={selectedType === 'default'}
            onChange={() => {
              setSelectedType('default');
              setSelectedValue(null);
            }}
          />
          <span>{t`Default`}</span>
        </label>
      </div>

      {canUseColors && (
        <div className="setitem">
          <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{t`Solid Colors`}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {colors.map((color) => (
              <button
                key={color.id}
                type="button"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  backgroundColor: color.hex,
                  border: selectedType === 'color' && selectedValue === color.id ? '3px solid #000' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                onClick={() => {
                  setSelectedType('color');
                  setSelectedValue(color.id);
                }}
                title={color.name}
              >
                {selectedType === 'color' && selectedValue === color.id && (
                  <FaCheck style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {canUseGradients && gradients.length > 0 && (
        <div className="setitem">
          <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>
            {t`Gradients`} <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: '#ede9fe', color: '#7c3aed' }}>PREMIUM</span>
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {gradients.map((gradient) => {
              const gradientStyle = `linear-gradient(90deg, ${gradient.colors.join(', ')})`;
              return (
                <button
                  key={gradient.id}
                  type="button"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: gradientStyle,
                    border: selectedType === 'gradient' && selectedValue === gradient.id ? '3px solid #000' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  onClick={() => {
                    setSelectedType('gradient');
                    setSelectedValue(gradient.id);
                  }}
                  title={gradient.name}
                >
                  {selectedType === 'gradient' && selectedValue === gradient.id && (
                    <FaCheck style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

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

export default NicknameCustomization;
