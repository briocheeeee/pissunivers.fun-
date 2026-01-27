import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { FaCrown, FaStar, FaCheck } from 'react-icons/fa';

const DONATION_TIERS = [
  {
    id: 'vip',
    name: 'VIP',
    price: 3.00,
    perks: [
      t`Max Pixel Stack +50%`,
      t`Colorful nickname`,
      t`Global Alert (6h cooldown)`,
      t`VIP Discord Chat`,
    ],
    icon: FaStar,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 7.00,
    perks: [
      t`Max Pixel Stack +100%`,
      t`Global Alert (3h cooldown)`,
      t`Profile customization`,
      t`Premium Discord Chat`,
    ],
    icon: FaCrown,
  },
];

const Donations = () => {
  const userId = useSelector((state) => state.user.id);
  const isLoggedIn = userId > 0;
  const donationTier = useSelector((state) => state.user.donationTier);

  const [providers, setProviders] = useState([]);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/donations/providers')
      .then((res) => res.json())
      .then((data) => {
        setProviders(data.providers || []);
        if (data.providers?.length > 0) {
          setSelectedProvider(data.providers[0].name);
        }
      })
      .catch(() => setProviders([]));
  }, []);

  const handleDonate = useCallback(async (tier) => {
    if (!isLoggedIn) {
      setError(t`Please log in first`);
      return;
    }
    if (!selectedProvider) {
      setError(t`No payment provider available`);
      return;
    }

    setSelectedTier(tier);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/donations/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: tier.id,
          provider: selectedProvider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setSelectedTier(null);
    }
  }, [isLoggedIn, selectedProvider]);

  return (
    <div className="content">
      <p>{t`Place color pixels on a large canvas with other players online!`}</p>
      <p>{t`Your support helps us keep the servers running and develop new features. Get exclusive perks as a thank you!`}</p>

      {donationTier && donationTier !== 'user' && (
        <p className="modalinfo"><b>{t`Current tier`}: {donationTier.toUpperCase()}</b></p>
      )}

      <h3>{t`VIP`} - $3.00</h3>
      <div style={{ lineHeight: 1.8 }}>
        {DONATION_TIERS[0].perks.map((perk, i) => (
          <span key={i}><FaCheck style={{ color: '#22c55e', marginRight: 6 }} />{perk}<br /></span>
        ))}
      </div>
      <p>
        <button
          type="button"
          onClick={() => handleDonate(DONATION_TIERS[0])}
          disabled={loading || donationTier === 'vip' || donationTier === 'premium' || !isLoggedIn}
        >
          {donationTier === 'vip' ? t`Current Tier` : donationTier === 'premium' ? t`Already Premium` : !isLoggedIn ? t`Login Required` : (loading && selectedTier?.id === 'vip') ? t`Processing...` : t`Support Us - VIP`}
        </button>
      </p>

      <h3>{t`Premium`} - $7.00</h3>
      <div style={{ lineHeight: 1.8 }}>
        {DONATION_TIERS[1].perks.map((perk, i) => (
          <span key={i}><FaCheck style={{ color: '#22c55e', marginRight: 6 }} />{perk}<br /></span>
        ))}
      </div>
      <p>
        <button
          type="button"
          onClick={() => handleDonate(DONATION_TIERS[1])}
          disabled={loading || donationTier === 'premium' || !isLoggedIn}
        >
          {donationTier === 'premium' ? t`Current Tier` : !isLoggedIn ? t`Login Required` : (loading && selectedTier?.id === 'premium') ? t`Processing...` : t`Support Us - Premium`}
        </button>
      </p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <p className="modalinfo">{t`All donations are one-time payments. No subscriptions.`}</p>
      <p className="modalinfo">{t`Your support helps maintain the servers and develop new features.`}</p>
    </div>
  );
};

export default Donations;
