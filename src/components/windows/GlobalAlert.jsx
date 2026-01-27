import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { FaBullhorn, FaClock } from 'react-icons/fa';

const GlobalAlert = () => {
  const donationTier = useSelector((state) => state.user.donationTier);
  const donationPermissions = useSelector((state) => state.user.donationPermissions);
  const isVip = useSelector((state) => state.user.isVip);
  const isPremium = useSelector((state) => state.user.isPremium);

  const [message, setMessage] = useState('');
  const [canSend, setCanSend] = useState(false);
  const [remainingCooldown, setRemainingCooldown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/donations/global-alert/status');
      const data = await response.json();
      setCanSend(data.canSend);
      setRemainingCooldown(data.remainingCooldown);
    } catch (err) {
      console.error('Failed to fetch global alert status:', err);
    }
  }, []);

  useEffect(() => {
    if (isVip || isPremium) {
      fetchStatus();
    }
  }, [isVip, isPremium, fetchStatus]);

  useEffect(() => {
    if (remainingCooldown && remainingCooldown > 0) {
      const interval = setInterval(() => {
        setRemainingCooldown((prev) => {
          if (prev <= 1000) {
            clearInterval(interval);
            fetchStatus();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [remainingCooldown, fetchStatus]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/donations/global-alert/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send alert');
        if (data.remainingCooldown) {
          setRemainingCooldown(data.remainingCooldown);
          setCanSend(false);
        }
      } else {
        setSuccess(true);
        setMessage('');
        setCanSend(false);
        if (data.nextAvailableAt) {
          const cooldown = data.nextAvailableAt - Date.now();
          setRemainingCooldown(cooldown);
        }
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [message, loading]);

  const formatCooldown = (ms) => {
    if (!ms || ms <= 0) return t`Available now`;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);
    return parts.join(' ') || t`Available now`;
  };

  if (!donationPermissions?.canUseGlobalAlert) {
    return (
      <div className="content">
        <h3><FaBullhorn style={{ marginRight: 8 }} />{t`Global Alert`}</h3>
        <p className="modalinfo">{t`This feature is available for VIP and Premium members.`}</p>
        <p className="modaldesc">{t`VIP: 6 hour cooldown`} | {t`Premium: 3 hour cooldown`}</p>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="setrow">
        <FaBullhorn style={{ marginRight: 8, fontSize: 18 }} />
        <h3 className="settitle" style={{ margin: 0 }}>{t`Global Alert`}</h3>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600 }}>
          {donationTier.toUpperCase()}
        </span>
      </div>

      <p className="modaldesc">{t`Send a message visible to all online users.`}</p>

      <div className="setitem">
        <div className="setrow">
          <FaClock style={{ marginRight: 8 }} />
          <span>
            {canSend
              ? t`Ready to send`
              : `${t`Cooldown`}: ${formatCooldown(remainingCooldown)}`}
          </span>
        </div>
      </div>

      <div className="modaldivider" />

      <div className="setitem">
        <textarea
          style={{
            width: '100%',
            minHeight: 80,
            padding: 8,
            border: '1px solid rgba(0,0,0,0.2)',
            borderRadius: 4,
            fontFamily: 'inherit',
            fontSize: 14,
            resize: 'vertical',
          }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t`Enter your message (max 500 characters)...`}
          maxLength={500}
          disabled={!canSend || loading}
        />
        <span className="modaldesc" style={{ textAlign: 'right' }}>
          {message.length}/500
        </span>
      </div>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {success && <p style={{ color: '#16a34a' }}>{t`Alert sent successfully!`}</p>}

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend || !message.trim() || loading}
        style={{ marginTop: 8 }}
      >
        {loading ? t`Sending...` : t`Send Global Alert`}
      </button>
    </div>
  );
};

export default GlobalAlert;
