import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  requestFaction,
  requestJoinFaction,
  requestLeaveFaction,
} from '../../store/actions/fetch.js';
import { pAlert } from '../../store/actions/index.js';
import { numberToString } from '../../core/utils.js';
import { FACTION_ACCESS } from '../../core/constants.js';
import WindowContext from '../context/window.js';

const ACCESS_LABELS = {
  [FACTION_ACCESS.OPEN]: t`Open`,
  [FACTION_ACCESS.REQUEST]: t`Request Only`,
  [FACTION_ACCESS.CLOSED]: t`Closed`,
};

const FactionPublic = () => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.id);

  const { args, setTitle } = useContext(WindowContext);
  const factionId = args?.factionId;

  const [faction, setFaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadFaction = useCallback(async () => {
    if (!factionId) {
      setError(t`No faction ID provided`);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await requestFaction(factionId);
      if (res.errors) {
        setError(res.errors[0]);
        setFaction(null);
      } else {
        setFaction(res);
        if (res.name && setTitle) {
          setTitle(`[${res.tag}] ${res.name}`);
        }
      }
    } catch (err) {
      setError(t`Failed to load faction`);
      setFaction(null);
    }
    setLoading(false);
  }, [factionId, setTitle]);

  useEffect(() => {
    loadFaction();
  }, [loadFaction]);

  const handleJoin = async () => {
    setActionLoading(true);
    const res = await requestJoinFaction(factionId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else if (res.requestSent) {
      dispatch(pAlert(t`Success`, t`Join request sent`, 'info'));
      loadFaction();
    } else if (res.joined) {
      dispatch(pAlert(t`Success`, t`You joined the faction`, 'info'));
      loadFaction();
    }
    setActionLoading(false);
  };

  const handleLeave = async () => {
    setActionLoading(true);
    const res = await requestLeaveFaction(factionId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`You left the faction`, 'info'));
      loadFaction();
    }
    setActionLoading(false);
  };

  const handleCancelRequest = async () => {
    setActionLoading(true);
    const res = await requestLeaveFaction(factionId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`Request cancelled`, 'info'));
      loadFaction();
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="content">
        <p>{t`Loading...`}</p>
      </div>
    );
  }

  if (error || !faction) {
    return (
      <div className="content">
        <p>{error || t`Faction not found.`}</p>
      </div>
    );
  }

  const renderActionButton = () => {
    if (!userId) {
      return <p style={{ color: '#666', fontSize: '0.9em' }}>{t`Log in to join factions.`}</p>;
    }

    if (faction.isMember) {
      if (faction.role === 1) {
        return <p style={{ color: '#666', fontSize: '0.9em' }}>{t`You are the owner of this faction.`}</p>;
      }
      return (
        <button
          type="button"
          onClick={handleLeave}
          disabled={actionLoading}
        >
          {actionLoading ? t`Loading...` : t`Leave Faction`}
        </button>
      );
    }

    if (faction.hasPendingRequest) {
      return (
        <button
          type="button"
          onClick={handleCancelRequest}
          disabled={actionLoading}
        >
          {actionLoading ? t`Loading...` : t`Cancel Request`}
        </button>
      );
    }

    if (faction.access === FACTION_ACCESS.CLOSED) {
      return (
        <button type="button" disabled>
          {t`Closed`}
        </button>
      );
    }

    if (faction.access === FACTION_ACCESS.REQUEST) {
      return (
        <button
          type="button"
          onClick={handleJoin}
          disabled={actionLoading}
        >
          {actionLoading ? t`Loading...` : t`Request to Join`}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleJoin}
        disabled={actionLoading}
      >
        {actionLoading ? t`Loading...` : t`Join Faction`}
      </button>
    );
  };

  return (
    <div className="content">
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div>
          {faction.avatar ? (
            <img
              src={faction.avatar}
              alt={faction.name}
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
            />
          ) : (
            <div style={{
              width: 80,
              height: 80,
              backgroundColor: '#ccc',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 'bold',
            }}
            >
              {faction.tag.substring(0, 2)}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>
            [{faction.tag}] {faction.name}
          </h3>
          <p style={{ margin: '4px 0' }}>
            <span className="stattext">{t`Members`}:</span>
            &nbsp;
            <span className="statvalue">{faction.memberCount}</span>
          </p>
          <p style={{ margin: '4px 0' }}>
            <span className="stattext">{t`Total Pixels`}:</span>
            &nbsp;
            <span className="statvalue">{numberToString(faction.totalPixels)}</span>
          </p>
          <p style={{ margin: '4px 0' }}>
            <span className="stattext">{t`Pixels Today`}:</span>
            &nbsp;
            <span className="statvalue">{numberToString(faction.dailyPixels)}</span>
          </p>
          <p style={{ margin: '4px 0' }}>
            <span className="stattext">{t`Rank`}:</span>
            &nbsp;
            <span className="statvalue">#{faction.rank || '-'}</span>
          </p>
          <p style={{ margin: '4px 0' }}>
            <span className="stattext">{t`Access`}:</span>
            &nbsp;
            <span className="statvalue">{ACCESS_LABELS[faction.access]}</span>
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {renderActionButton()}
      </div>
    </div>
  );
};

export default FactionPublic;
