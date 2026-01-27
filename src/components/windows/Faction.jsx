import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  requestMyFaction,
  requestUpdateFaction,
  requestDeleteFaction,
  requestLeaveFaction,
  requestKickFactionMember,
  requestTransferFactionOwnership,
  requestAcceptFactionRequest,
  requestRejectFactionRequest,
  requestFactionStats,
} from '../../store/actions/fetch.js';
import { pAlert } from '../../store/actions/index.js';
import { numberToString } from '../../core/utils.js';
import { FACTION_ACCESS, FACTION_ROLE } from '../../core/constants.js';

const ACCESS_LABELS = {
  [FACTION_ACCESS.OPEN]: t`Open`,
  [FACTION_ACCESS.REQUEST]: t`Request Only`,
  [FACTION_ACCESS.CLOSED]: t`Closed`,
};

const Faction = () => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.id);

  const [faction, setFaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editAccess, setEditAccess] = useState(0);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transferId, setTransferId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadFaction = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await requestMyFaction();
    if (res.errors) {
      setError(res.errors[0]);
      setFaction(null);
    } else {
      setFaction(res);
      setEditName(res.name);
      setEditTag(res.tag);
      setEditAccess(res.access);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) {
      loadFaction();
    }
  }, [userId, loadFaction]);

  const handleUpdate = async () => {
    const updates = {};
    if (editName !== faction.name) updates.name = editName;
    if (editTag !== faction.tag) updates.tag = editTag;
    if (editAccess !== faction.access) updates.access = editAccess;

    if (Object.keys(updates).length === 0) {
      setEditMode(false);
      return;
    }

    const res = await requestUpdateFaction(faction.id, updates);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`Faction updated successfully`, 'info'));
      setEditMode(false);
      loadFaction();
    }
  };

  const handleDelete = async () => {
    if (!deletePassword) {
      dispatch(pAlert(t`Error`, t`Password is required`, 'error'));
      return;
    }
    const res = await requestDeleteFaction(faction.id, deletePassword);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`Faction deleted`, 'info'));
      setFaction(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleLeave = async () => {
    const res = await requestLeaveFaction(faction.id);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`You left the faction`, 'info'));
      setFaction(null);
    }
  };

  const handleKick = async (memberId) => {
    const res = await requestKickFactionMember(faction.id, memberId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      loadFaction();
    }
  };

  const handleTransfer = async () => {
    const targetId = parseInt(transferId, 10);
    if (Number.isNaN(targetId)) {
      dispatch(pAlert(t`Error`, t`Invalid user ID`, 'error'));
      return;
    }
    const res = await requestTransferFactionOwnership(faction.id, targetId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`Ownership transferred`, 'info'));
      setShowTransfer(false);
      loadFaction();
    }
  };

  const handleAcceptRequest = async (requestId) => {
    const res = await requestAcceptFactionRequest(faction.id, requestId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      loadFaction();
    }
  };

  const handleRejectRequest = async (requestId) => {
    const res = await requestRejectFactionRequest(faction.id, requestId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      loadFaction();
    }
  };

  const loadStats = async () => {
    if (!faction) return;
    setStatsLoading(true);
    const res = await requestFactionStats(faction.id);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      setStats(res);
    }
    setStatsLoading(false);
  };

  const toggleStats = () => {
    if (!showStats && !stats) {
      loadStats();
    }
    setShowStats(!showStats);
  };

  if (!userId) {
    return (
      <div className="content">
        <p>{t`You must be logged in to view your faction.`}</p>
      </div>
    );
  }

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
        <p>{error || t`You are not a member of any faction.`}</p>
      </div>
    );
  }

  const isOwner = faction.role === FACTION_ROLE.OWNER;

  return (
    <div className="content">
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>
          [{faction.tag}] {faction.name}
        </h3>
        <p style={{ margin: '4px 0' }}>
          <strong>{t`Members`}:</strong> {faction.memberCount}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>{t`Total Pixels`}:</strong> {numberToString(faction.totalPixels)}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>{t`Pixels Today`}:</strong> {numberToString(faction.dailyPixels)}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>{t`Rank`}:</strong> #{faction.rank || '-'}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>{t`Access`}:</strong> {ACCESS_LABELS[faction.access]}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>{t`Your Role`}:</strong> {isOwner ? t`Owner` : t`Member`}
        </p>
        <button type="button" onClick={toggleStats} style={{ marginTop: 8 }}>
          {showStats ? t`Hide Stats` : t`View Stats`}
        </button>
      </div>

      {showStats && (
        <div style={{ marginBottom: 16, padding: 8, border: '1px solid #ccc' }}>
          <h4>{t`Faction Statistics`}</h4>
          {statsLoading ? (
            <p>{t`Loading...`}</p>
          ) : stats ? (
            <>
              <p><strong>{t`Total Pixels`}:</strong> {numberToString(stats.totalPixels)}</p>
              <p><strong>{t`Pixels Today`}:</strong> {numberToString(stats.dailyPixels)}</p>
              {stats.memberStats && stats.memberStats.length > 0 && (
                <>
                  <h5>{t`Top Contributors`}</h5>
                  <table style={{ width: '100%', fontSize: '0.9em' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t`User`}</th>
                        <th>{t`Pixels`}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.memberStats.slice(0, 10).map((c, i) => (
                        <tr key={c.id}>
                          <td>{i + 1}</td>
                          <td>{c.name}</td>
                          <td>{numberToString(c.totalPixels)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {stats.canvasBreakdown && stats.canvasBreakdown.length > 0 && (
                <>
                  <h5>{t`Canvas Breakdown`}</h5>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {stats.canvasBreakdown.map((cb) => (
                      <li key={cb.canvasId}>{t`Canvas`} {cb.canvasId}: {numberToString(cb.pixels)}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p>{t`No stats available`}</p>
          )}
        </div>
      )}

      {isOwner && editMode && (
        <div style={{ marginBottom: 16, padding: 8, border: '1px solid #ccc' }}>
          <h4>{t`Edit Faction`}</h4>
          <div style={{ marginBottom: 8 }}>
            <label>{t`Name`}:</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ marginLeft: 8, width: 200 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>{t`Tag`}:</label>
            <input
              type="text"
              value={editTag}
              onChange={(e) => setEditTag(e.target.value)}
              style={{ marginLeft: 8, width: 100 }}
              maxLength={8}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>{t`Access`}:</label>
            <select
              value={editAccess}
              onChange={(e) => setEditAccess(Number(e.target.value))}
              style={{ marginLeft: 8 }}
            >
              <option value={FACTION_ACCESS.OPEN}>{ACCESS_LABELS[FACTION_ACCESS.OPEN]}</option>
              <option value={FACTION_ACCESS.REQUEST}>{ACCESS_LABELS[FACTION_ACCESS.REQUEST]}</option>
              <option value={FACTION_ACCESS.CLOSED}>{ACCESS_LABELS[FACTION_ACCESS.CLOSED]}</option>
            </select>
          </div>
          <button type="button" onClick={handleUpdate}>{t`Save`}</button>
          <button type="button" onClick={() => setEditMode(false)} style={{ marginLeft: 8 }}>{t`Cancel`}</button>
        </div>
      )}

      {isOwner && !editMode && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={() => setEditMode(true)}>{t`Edit Faction`}</button>
          <button type="button" onClick={() => setShowTransfer(!showTransfer)} style={{ marginLeft: 8 }}>
            {t`Transfer Ownership`}
          </button>
          <button type="button" onClick={() => setShowDeleteConfirm(!showDeleteConfirm)} style={{ marginLeft: 8 }}>
            {t`Delete Faction`}
          </button>
        </div>
      )}

      {!isOwner && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={handleLeave}>{t`Leave Faction`}</button>
        </div>
      )}

      {showTransfer && (
        <div style={{ marginBottom: 16, padding: 8, border: '1px solid #ccc' }}>
          <h4>{t`Transfer Ownership`}</h4>
          <div style={{ marginBottom: 8 }}>
            <label>{t`New Owner ID`}:</label>
            <input
              type="text"
              value={transferId}
              onChange={(e) => setTransferId(e.target.value)}
              style={{ marginLeft: 8, width: 100 }}
            />
          </div>
          <button type="button" onClick={handleTransfer}>{t`Transfer`}</button>
          <button type="button" onClick={() => setShowTransfer(false)} style={{ marginLeft: 8 }}>{t`Cancel`}</button>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ marginBottom: 16, padding: 8, border: '1px solid #c00' }}>
          <h4>{t`Delete Faction`}</h4>
          <p>{t`This action cannot be undone. Enter your password to confirm.`}</p>
          <div style={{ marginBottom: 8 }}>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t`Password`}
            />
          </div>
          <button type="button" onClick={handleDelete}>{t`Confirm Delete`}</button>
          <button type="button" onClick={() => setShowDeleteConfirm(false)} style={{ marginLeft: 8 }}>{t`Cancel`}</button>
        </div>
      )}

      {isOwner && faction.requests && faction.requests.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4>{t`Join Requests`} ({faction.requestCount})</h4>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{t`User`}</th>
                <th>{t`ID`}</th>
                <th>{t`Date`}</th>
                <th>{t`Actions`}</th>
              </tr>
            </thead>
            <tbody>
              {faction.requests.map((req) => (
                <tr key={req.id}>
                  <td>{req.name}</td>
                  <td>{req.uid}</td>
                  <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button type="button" onClick={() => handleAcceptRequest(req.id)}>{t`Accept`}</button>
                    <button type="button" onClick={() => handleRejectRequest(req.id)} style={{ marginLeft: 4 }}>{t`Reject`}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h4>{t`Members`}</h4>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>{t`User`}</th>
              <th>{t`ID`}</th>
              <th>{t`Role`}</th>
              <th>{t`Joined`}</th>
              {isOwner && <th>{t`Actions`}</th>}
            </tr>
          </thead>
          <tbody>
            {faction.members && faction.members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.id}</td>
                <td>{member.role === FACTION_ROLE.OWNER ? t`Owner` : t`Member`}</td>
                <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
                {isOwner && (
                  <td>
                    {member.id !== userId && member.role !== FACTION_ROLE.OWNER && (
                      <button type="button" onClick={() => handleKick(member.id)}>{t`Kick`}</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Faction;
