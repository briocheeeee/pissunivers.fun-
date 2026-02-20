import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  requestMyFaction,
  requestCreateFaction,
  requestUpdateFaction,
  requestDeleteFaction,
  requestLeaveFaction,
  requestKickFactionMember,
  requestTransferFactionOwnership,
  requestAcceptFactionRequest,
  requestRejectFactionRequest,
  requestFactionRankings,
  requestUploadFactionAvatar,
  requestFactionStats,
} from '../store/actions/fetch.js';
import { pAlert } from '../store/actions/index.js';
import { numberToString } from '../core/utils.js';
import { FACTION_ACCESS, FACTION_ROLE } from '../core/constants.js';
import useLink from './hooks/link.js';

const ACCESS_LABELS = {
  [FACTION_ACCESS.OPEN]: t`Open`,
  [FACTION_ACCESS.REQUEST]: t`Request Only`,
  [FACTION_ACCESS.CLOSED]: t`Closed`,
};

const FactionCreateForm = ({ onCreated }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [access, setAccess] = useState(FACTION_ACCESS.OPEN);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !tag.trim()) {
      dispatch(pAlert(t`Error`, t`Name and tag are required`, 'error'));
      return;
    }
    setSubmitting(true);
    const res = await requestCreateFaction(name.trim(), tag.trim(), access);
    setSubmitting(false);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`Faction created successfully`, 'info'));
      onCreated();
    }
  };

  return (
    <div className="fa-manage">
      <div className="fa-subsection-title">{t`Create a Faction`}</div>
      <div className="fa-form-panel">
        <form onSubmit={handleSubmit}>
          <div className="fa-form-row">
            <label className="fa-form-label">{t`Name`}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t`3-32 characters`}
              maxLength={32}
              className="fa-form-input"
            />
          </div>
          <div className="fa-form-row">
            <label className="fa-form-label">{t`Tag`}</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              placeholder={t`2-8 characters`}
              maxLength={8}
              className="fa-form-input fa-form-input--short"
            />
          </div>
          <div className="fa-form-row">
            <label className="fa-form-label">{t`Access`}</label>
            <select
              value={access}
              onChange={(e) => setAccess(Number(e.target.value))}
              className="fa-form-select"
            >
              <option value={FACTION_ACCESS.OPEN}>{ACCESS_LABELS[FACTION_ACCESS.OPEN]}</option>
              <option value={FACTION_ACCESS.REQUEST}>{ACCESS_LABELS[FACTION_ACCESS.REQUEST]}</option>
              <option value={FACTION_ACCESS.CLOSED}>{ACCESS_LABELS[FACTION_ACCESS.CLOSED]}</option>
            </select>
          </div>
          <div className="fa-form-actions">
            <button type="submit" className="fa-btn fa-btn--primary" disabled={submitting}>
              {submitting ? t`Creating...` : t`Create Faction`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FactionManage = ({ faction, onUpdate, onDeleted }) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.id);
  const link = useLink();
  const fileInputRef = useRef(null);

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(faction.name);
  const [editTag, setEditTag] = useState(faction.tag);
  const [editAccess, setEditAccess] = useState(faction.access);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transferId, setTransferId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsPage, setStatsPage] = useState(1);
  const STATS_PER_PAGE = 50;

  useEffect(() => {
    setEditName(faction.name);
    setEditTag(faction.tag);
    setEditAccess(faction.access);
  }, [faction]);

  const isOwner = faction.role === FACTION_ROLE.OWNER;

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      dispatch(pAlert(t`Error`, t`Please select an image file`, 'error'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      dispatch(pAlert(t`Error`, t`Image must be less than 2MB`, 'error'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingAvatar(true);
      const res = await requestUploadFactionAvatar(faction.id, reader.result);
      setUploadingAvatar(false);
      if (res.errors) {
        dispatch(pAlert(t`Error`, res.errors[0], 'error'));
      } else {
        dispatch(pAlert(t`Success`, t`Avatar updated`, 'info'));
        onUpdate();
      }
    };
    reader.readAsDataURL(file);
  };

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
      onUpdate();
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
      onDeleted();
    }
  };

  const handleLeave = async () => {
    const res = await requestLeaveFaction(faction.id);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      dispatch(pAlert(t`Success`, t`You left the faction`, 'info'));
      onDeleted();
    }
  };

  const handleKick = async (memberId) => {
    const res = await requestKickFactionMember(faction.id, memberId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      onUpdate();
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
      onUpdate();
    }
  };

  const handleAcceptRequest = async (requestId) => {
    const res = await requestAcceptFactionRequest(faction.id, requestId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      onUpdate();
    }
  };

  const handleRejectRequest = async (requestId) => {
    const res = await requestRejectFactionRequest(faction.id, requestId);
    if (res.errors) {
      dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    } else {
      onUpdate();
    }
  };

  const openPublicPage = () => {
    link('FACTION_PUBLIC', { args: { factionId: faction.id }, target: 'blank' });
  };

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      const res = await requestFactionStats(faction.id);
      if (!res.errors) {
        setStats(res);
      }
      setStatsLoading(false);
    };
    loadStats();
  }, [faction.id]);

  return (
    <div className="fa-manage">
      <div className="fa-info-card">
        <div className="fa-info-avatar-col">
          <div className="fa-avatar-wrap">
            {faction.avatar ? (
              <img
                src={faction.avatar}
                alt={faction.name}
                className="fa-avatar-img"
              />
            ) : (
              <div className="fa-avatar-placeholder">
                {faction.tag.substring(0, 2)}
              </div>
            )}
            {isOwner && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="fa-avatar-edit-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? '…' : t`Edit`}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="fa-info-main">
          <div className="fa-info-header">
            <span
              role="button"
              tabIndex={0}
              className="fa-faction-name"
              onClick={openPublicPage}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPublicPage()}
            >
              [{faction.tag}] {faction.name}
            </span>
            <span className="fa-role-badge">
              {isOwner ? t`Owner` : t`Member`}
            </span>
          </div>

          <div className="fa-info-stats">
            <div className="fa-info-stat">
              <span className="fa-info-stat-value">{faction.memberCount}</span>
              <span className="fa-info-stat-label">{t`Members`}</span>
            </div>
            <div className="fa-info-stat">
              <span className="fa-info-stat-value">{numberToString(faction.totalPixels)}</span>
              <span className="fa-info-stat-label">{t`Total Pixels`}</span>
            </div>
            <div className="fa-info-stat">
              <span className="fa-info-stat-value">{numberToString(faction.dailyPixels)}</span>
              <span className="fa-info-stat-label">{t`Today`}</span>
            </div>
            <div className="fa-info-stat">
              <span className="fa-info-stat-value">#{faction.rank || '-'}</span>
              <span className="fa-info-stat-label">{t`Rank`}</span>
            </div>
          </div>

          <div className="fa-info-meta">
            <span className="fa-access-tag">{ACCESS_LABELS[faction.access]}</span>
          </div>
        </div>
      </div>

      <div className="fa-actions-row">
        {isOwner && !editMode && (
          <>
            <button type="button" className="fa-btn" onClick={() => setEditMode(true)}>{t`Edit`}</button>
            <button type="button" className="fa-btn" onClick={() => setShowTransfer(!showTransfer)}>
              {t`Transfer`}
            </button>
            <button type="button" className="fa-btn fa-btn--danger" onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}>
              {t`Delete`}
            </button>
          </>
        )}
        {!isOwner && (
          <button type="button" className="fa-btn fa-btn--danger" onClick={handleLeave}>{t`Leave Faction`}</button>
        )}
      </div>

      {isOwner && editMode && (
        <div className="fa-form-panel">
          <div className="fa-form-title">{t`Edit Faction`}</div>
          <div className="fa-form-row">
            <label className="fa-form-label">{t`Name`}</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="fa-form-input"
            />
          </div>
          <div className="fa-form-row">
            <label className="fa-form-label">{t`Tag`}</label>
            <input
              type="text"
              value={editTag}
              onChange={(e) => setEditTag(e.target.value)}
              className="fa-form-input fa-form-input--short"
              maxLength={8}
            />
          </div>
          <div className="fa-form-row">
            <label className="fa-form-label">{t`Access`}</label>
            <select
              value={editAccess}
              onChange={(e) => setEditAccess(Number(e.target.value))}
              className="fa-form-select"
            >
              <option value={FACTION_ACCESS.OPEN}>{ACCESS_LABELS[FACTION_ACCESS.OPEN]}</option>
              <option value={FACTION_ACCESS.REQUEST}>{ACCESS_LABELS[FACTION_ACCESS.REQUEST]}</option>
              <option value={FACTION_ACCESS.CLOSED}>{ACCESS_LABELS[FACTION_ACCESS.CLOSED]}</option>
            </select>
          </div>
          <div className="fa-form-actions">
            <button type="button" className="fa-btn fa-btn--primary" onClick={handleUpdate}>{t`Save`}</button>
            <button type="button" className="fa-btn" onClick={() => setEditMode(false)}>{t`Cancel`}</button>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="fa-form-panel">
          <div className="fa-form-title">{t`Transfer Ownership`}</div>
          <p className="fa-form-desc">{t`Select a member to transfer ownership to.`}</p>
          <div className="fa-form-row">
            <select
              value={transferId}
              onChange={(e) => setTransferId(e.target.value)}
              className="fa-form-select"
            >
              <option value="">{t`Select member...`}</option>
              {faction.members && faction.members
                .filter((m) => m.id !== userId)
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.name} (#{m.id})</option>
                ))}
            </select>
          </div>
          <div className="fa-form-actions">
            <button type="button" className="fa-btn fa-btn--primary" onClick={handleTransfer} disabled={!transferId}>{t`Transfer`}</button>
            <button type="button" className="fa-btn" onClick={() => setShowTransfer(false)}>{t`Cancel`}</button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fa-form-panel fa-form-panel--danger">
          <div className="fa-form-title">{t`Delete Faction`}</div>
          <p className="fa-form-desc">{t`This action cannot be undone. Enter your password to confirm.`}</p>
          <div className="fa-form-row">
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t`Password`}
              className="fa-form-input"
            />
          </div>
          <div className="fa-form-actions">
            <button type="button" className="fa-btn fa-btn--danger" onClick={handleDelete}>{t`Confirm Delete`}</button>
            <button type="button" className="fa-btn" onClick={() => setShowDeleteConfirm(false)}>{t`Cancel`}</button>
          </div>
        </div>
      )}

      {isOwner && faction.requests && faction.requests.length > 0 && (
        <div className="fa-subsection">
          <div className="fa-subsection-title">{t`Join Requests`} <span className="fa-count">({faction.requestCount})</span></div>
          <table className="fa-table">
            <thead>
              <tr>
                <th>{t`User`}</th>
                <th>{t`Date`}</th>
                <th>{t`Actions`}</th>
              </tr>
            </thead>
            <tbody>
              {faction.requests.map((req) => (
                <tr key={req.id}>
                  <td>{req.name}</td>
                  <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td className="fa-table-actions">
                    <button type="button" className="fa-btn fa-btn--sm fa-btn--primary" onClick={() => handleAcceptRequest(req.id)}>{t`Accept`}</button>
                    <button type="button" className="fa-btn fa-btn--sm fa-btn--danger" onClick={() => handleRejectRequest(req.id)}>{t`Reject`}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="fa-subsection">
        <div className="fa-subsection-title">{t`Members`} <span className="fa-count">({faction.memberCount})</span></div>
        <table className="fa-table">
          <thead>
            <tr>
              <th>{t`User`}</th>
              <th>{t`Role`}</th>
              <th>{t`Joined`}</th>
              {isOwner && <th>{t`Actions`}</th>}
            </tr>
          </thead>
          <tbody>
            {faction.members && faction.members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>
                  <span className={`fa-role-pill ${member.role === FACTION_ROLE.OWNER ? 'fa-role-pill--owner' : ''}`}>
                    {member.role === FACTION_ROLE.OWNER ? t`Owner` : t`Member`}
                  </span>
                </td>
                <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
                {isOwner && (
                  <td className="fa-table-actions">
                    {member.id !== userId && member.role !== FACTION_ROLE.OWNER && (
                      <button type="button" className="fa-btn fa-btn--sm fa-btn--danger" onClick={() => handleKick(member.id)}>{t`Kick`}</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fa-subsection">
        <div className="fa-subsection-title">{t`Member Statistics`}</div>
        {statsLoading ? (
          <p className="fa-loading">{t`Loading...`}</p>
        ) : stats && stats.memberStats && stats.memberStats.length > 0 ? (
          <>
            <table className="fa-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t`Member`}</th>
                  <th>{t`Total`}</th>
                  <th>{t`Today`}</th>
                </tr>
              </thead>
              <tbody>
                {stats.memberStats
                  .slice((statsPage - 1) * STATS_PER_PAGE, statsPage * STATS_PER_PAGE)
                  .map((c, i) => (
                    <tr key={c.id}>
                      <td>{(statsPage - 1) * STATS_PER_PAGE + i + 1}</td>
                      <td>{c.name}</td>
                      <td className="c-num">{numberToString(c.totalPixels)}</td>
                      <td className="c-num">{numberToString(c.dailyPixels)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {stats.memberStats.length > STATS_PER_PAGE && (
              <div className="fa-pagination">
                <button
                  type="button"
                  className="fa-btn fa-btn--sm"
                  disabled={statsPage <= 1}
                  onClick={() => setStatsPage((p) => p - 1)}
                >
                  {t`Previous`}
                </button>
                <span className="fa-page-info">
                  {statsPage} / {Math.ceil(stats.memberStats.length / STATS_PER_PAGE)}
                </span>
                <button
                  type="button"
                  className="fa-btn fa-btn--sm"
                  disabled={statsPage >= Math.ceil(stats.memberStats.length / STATS_PER_PAGE)}
                  onClick={() => setStatsPage((p) => p + 1)}
                >
                  {t`Next`}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="fa-empty">{t`No stats available`}</p>
        )}
      </div>
    </div>
  );
};

const FactionRankingsTab = () => {
  const link = useLink();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [daily, setDaily] = useState(false);

  const loadRankings = useCallback(async () => {
    setLoading(true);
    const res = await requestFactionRankings(page, 20, daily);
    if (!res.errors) {
      setRankings(res.rankings || []);
      setTotalPages(res.totalPages || 1);
    }
    setLoading(false);
  }, [page, daily]);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  const handleFactionClick = (factionId) => {
    link('FACTION_PUBLIC', { target: 'blank', args: { factionId } });
  };

  return (
    <div className="fa-manage">
      <div className="fa-actions-row">
        <button
          type="button"
          className={!daily ? 'fa-btn fa-btn--primary' : 'fa-btn'}
          onClick={() => { setDaily(false); setPage(1); }}
        >
          {t`Total`}
        </button>
        <button
          type="button"
          className={daily ? 'fa-btn fa-btn--primary' : 'fa-btn'}
          onClick={() => { setDaily(true); setPage(1); }}
        >
          {t`Today`}
        </button>
      </div>

      {loading ? (
        <p className="fa-loading">{t`Loading...`}</p>
      ) : (
        <>
          <table className="fa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t`Faction`}</th>
                <th>{t`Members`}</th>
                <th>{daily ? t`Today` : t`Total`}</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((faction) => (
                <tr key={faction.id}>
                  <td>{faction.rank}</td>
                  <td>
                    <span
                      role="button"
                      tabIndex={-1}
                      className="fa-faction-name"
                      onClick={() => handleFactionClick(faction.id)}
                    >
                      {faction.avatar && (
                        <img
                          src={faction.avatar}
                          alt=""
                          style={{ width: 18, height: 18, marginRight: 4, verticalAlign: 'middle', borderRadius: 2 }}
                        />
                      )}
                      [{faction.tag}] {faction.name}
                    </span>
                  </td>
                  <td>{faction.memberCount}</td>
                  <td className="c-num">
                    {numberToString(daily ? faction.dailyPixels : faction.totalPixels)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rankings.length === 0 && (
            <p className="fa-empty">{t`No factions found.`}</p>
          )}

          <div className="fa-pagination">
            <button
              type="button"
              className="fa-btn fa-btn--sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t`Previous`}
            </button>
            <span className="fa-page-info">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="fa-btn fa-btn--sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t`Next`}
            </button>
          </div>
        </>
      )}

      <p className="fa-empty">{t`Ranking updates every 5 minutes.`}</p>
    </div>
  );
};

const FactionArea = () => {
  const userId = useSelector((state) => state.user.id);
  const [faction, setFaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasFaction, setHasFaction] = useState(false);
  const [activeTab, setActiveTab] = useState('my');

  const loadFaction = useCallback(async () => {
    setLoading(true);
    const res = await requestMyFaction();
    if (res.errors) {
      setFaction(null);
      setHasFaction(false);
    } else {
      setFaction(res);
      setHasFaction(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) {
      loadFaction();
    } else {
      setLoading(false);
      setFaction(null);
      setHasFaction(false);
    }
  }, [userId, loadFaction]);

  const renderTabs = () => (
    <div className="fa-actions-row">
      <button
        type="button"
        className={activeTab === 'my' ? 'fa-btn fa-btn--primary' : 'fa-btn'}
        onClick={() => setActiveTab('my')}
      >
        {t`My Faction`}
      </button>
      <button
        type="button"
        className={activeTab === 'rankings' ? 'fa-btn fa-btn--primary' : 'fa-btn'}
        onClick={() => setActiveTab('rankings')}
      >
        {t`Rankings`}
      </button>
    </div>
  );

  if (activeTab === 'rankings') {
    return (
      <div className="fa-manage">
        {renderTabs()}
        <FactionRankingsTab />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="fa-manage">
        {renderTabs()}
        <p className="fa-empty">{t`You must be logged in to manage factions.`}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fa-manage">
        {renderTabs()}
        <p className="fa-loading">{t`Loading...`}</p>
      </div>
    );
  }

  if (!hasFaction) {
    return (
      <div className="fa-manage">
        {renderTabs()}
        <FactionCreateForm onCreated={loadFaction} />
      </div>
    );
  }

  return (
    <div className="fa-manage">
      {renderTabs()}
      <FactionManage
        faction={faction}
        onUpdate={loadFaction}
        onDeleted={() => {
          setFaction(null);
          setHasFaction(false);
        }}
      />
    </div>
  );
};

export default React.memo(FactionArea);
