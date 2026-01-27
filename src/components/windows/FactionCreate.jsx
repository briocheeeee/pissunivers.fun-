import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { requestCreateFaction } from '../../store/actions/fetch.js';
import { pAlert } from '../../store/actions/index.js';
import { FACTION_ACCESS } from '../../core/constants.js';

const ACCESS_LABELS = {
  [FACTION_ACCESS.OPEN]: t`Open`,
  [FACTION_ACCESS.REQUEST]: t`Request Only`,
  [FACTION_ACCESS.CLOSED]: t`Closed`,
};

const FactionCreate = ({ onCreated }) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.id);

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [access, setAccess] = useState(FACTION_ACCESS.OPEN);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);

    if (!name.trim()) {
      setErrors([t`Faction name is required`]);
      return;
    }
    if (!tag.trim()) {
      setErrors([t`Faction tag is required`]);
      return;
    }

    setLoading(true);
    const res = await requestCreateFaction(name.trim(), tag.trim(), access);
    setLoading(false);

    if (res.errors) {
      setErrors(res.errors);
    } else if (res.success) {
      dispatch(pAlert(t`Success`, t`Faction created successfully!`, 'info'));
      if (onCreated) {
        onCreated(res.faction);
      }
    }
  };

  if (!userId) {
    return (
      <div className="content">
        <p>{t`You must be logged in to create a faction.`}</p>
      </div>
    );
  }

  return (
    <div className="content">
      <h3>{t`Create Faction`}</h3>
      <form onSubmit={handleSubmit}>
        {errors.length > 0 && (
          <div style={{ color: 'red', marginBottom: 12 }}>
            {errors.map((err, i) => (
              <p key={i} style={{ margin: '4px 0' }}>{err}</p>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>
            {t`Faction Name`}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            style={{ width: '100%', maxWidth: 300 }}
            placeholder={t`Enter faction name`}
          />
          <small style={{ display: 'block', color: '#666' }}>
            {t`3-32 characters, letters, numbers, spaces, underscores, hyphens`}
          </small>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>
            {t`Faction Tag`}
          </label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            maxLength={8}
            style={{ width: 100 }}
            placeholder={t`TAG`}
          />
          <small style={{ display: 'block', color: '#666' }}>
            {t`2-8 characters, displayed as [TAG] in chat`}
          </small>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>
            {t`Access Mode`}
          </label>
          <select
            value={access}
            onChange={(e) => setAccess(Number(e.target.value))}
          >
            <option value={FACTION_ACCESS.OPEN}>{ACCESS_LABELS[FACTION_ACCESS.OPEN]}</option>
            <option value={FACTION_ACCESS.REQUEST}>{ACCESS_LABELS[FACTION_ACCESS.REQUEST]}</option>
            <option value={FACTION_ACCESS.CLOSED}>{ACCESS_LABELS[FACTION_ACCESS.CLOSED]}</option>
          </select>
          <small style={{ display: 'block', color: '#666' }}>
            {access === FACTION_ACCESS.OPEN && t`Anyone can join freely`}
            {access === FACTION_ACCESS.REQUEST && t`Users must request to join`}
            {access === FACTION_ACCESS.CLOSED && t`No one can join`}
          </small>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? t`Creating...` : t`Create Faction`}
        </button>
      </form>
    </div>
  );
};

export default FactionCreate;
