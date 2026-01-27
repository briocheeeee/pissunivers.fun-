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
    <div className="content">
      <h3 style={{ marginBottom: 16 }}>{t`Create a Faction`}</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>{t`Faction Name`}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t`3-32 characters`}
            maxLength={32}
            style={{ width: '100%', maxWidth: 250 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>{t`Tag`}</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            placeholder={t`2-8 characters`}
            maxLength={8}
            style={{ width: '100%', maxWidth: 100 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>{t`Access Mode`}</label>
          <select
            value={access}
            onChange={(e) => setAccess(Number(e.target.value))}
          >
            <option value={FACTION_ACCESS.OPEN}>{ACCESS_LABELS[FACTION_ACCESS.OPEN]}</option>
            <option value={FACTION_ACCESS.REQUEST}>{ACCESS_LABELS[FACTION_ACCESS.REQUEST]}</option>
            <option value={FACTION_ACCESS.CLOSED}>{ACCESS_LABELS[FACTION_ACCESS.CLOSED]}</option>
          </select>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? t`Creating...` : t`Create Faction`}
        </button>
      </form>
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
    <div className="content">
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ position: 'relative' }}>
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
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                style={{
                  position: 'absolute',
                  bottom: -8,
                  right: -8,
                  fontSize: 10,
                  padding: '2px 6px',
                }}
              >
                {uploadingAvatar ? '...' : t`Edit`}
              </button>
            </>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>
            <span
              role="button"
              tabIndex={0}
              onClick={openPublicPage}
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
              [{faction.tag}] {faction.name}
            </span>
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
          <p style={{ margin: '4px 0' }}>
            <span className="stattext">{t`Your Role`}:</span>
            &nbsp;
            <span className="statvalue">{isOwner ? t`Owner` : t`Member`}</span>
          </p>
        </div>
      </div>


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

      <div style={{ marginBottom: 16 }}>
        {isOwner && !editMode && (
          <>
            <button type="button" onClick={() => setEditMode(true)}>{t`Edit Faction`}</button>
            <button type="button" onClick={() => setShowTransfer(!showTransfer)} style={{ marginLeft: 8 }}>
              {t`Transfer Ownership`}
            </button>
            <button type="button" onClick={() => setShowDeleteConfirm(!showDeleteConfirm)} style={{ marginLeft: 8 }}>
              {t`Delete Faction`}
            </button>
          </>
        )}
        {!isOwner && (
          <button type="button" onClick={handleLeave}>{t`Leave Faction`}</button>
        )}
      </div>

      {showTransfer && (
        <div style={{ marginBottom: 16, padding: 8, border: '1px solid #ccc' }}>
          <h4>{t`Transfer Ownership`}</h4>
          <p>{t`Select a member from the list below to transfer ownership.`}</p>
          <div style={{ marginBottom: 8 }}>
            <select
              value={transferId}
              onChange={(e) => setTransferId(e.target.value)}
            >
              <option value="">{t`Select member...`}</option>
              {faction.members && faction.members
                .filter((m) => m.id !== userId)
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.name} (ID: {m.id})</option>
                ))}
            </select>
          </div>
          <button type="button" onClick={handleTransfer} disabled={!transferId}>{t`Transfer`}</button>
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
                <th>{t`Date`}</th>
                <th>{t`Actions`}</th>
              </tr>
            </thead>
            <tbody>
              {faction.requests.map((req) => (
                <tr key={req.id}>
                  <td>{req.name}</td>
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
              <th>{t`Role`}</th>
              <th>{t`Joined`}</th>
              {isOwner && <th>{t`Actions`}</th>}
            </tr>
          </thead>
          <tbody>
            {faction.members && faction.members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
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

      <div className="modaldivider" />

      <div>
        <h4>{t`Member Statistics`}</h4>
        {statsLoading ? (
          <p>{t`Loading...`}</p>
        ) : stats && stats.memberStats && stats.memberStats.length > 0 ? (
          <>
            <table style={{ width: '100%' }}>
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
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  disabled={statsPage <= 1}
                  onClick={() => setStatsPage((p) => p - 1)}
                >
                  {t`Previous`}
                </button>
                <span style={{ alignSelf: 'center' }}>
                  {statsPage} / {Math.ceil(stats.memberStats.length / STATS_PER_PAGE)}
                </span>
                <button
                  type="button"
                  disabled={statsPage >= Math.ceil(stats.memberStats.length / STATS_PER_PAGE)}
                  onClick={() => setStatsPage((p) => p + 1)}
                >
                  {t`Next`}
                </button>
              </div>
            )}
          </>
        ) : (
          <p>{t`No stats available`}</p>
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
    <div className="content">
      <div style={{ marginBottom: 12 }}>
        <span
          role="button"
          tabIndex={-1}
          className={!daily ? 'modallink selected' : 'modallink'}
          onClick={() => { setDaily(false); setPage(1); }}
        >
          {t`Total`}
        </span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={daily ? 'modallink selected' : 'modallink'}
          onClick={() => { setDaily(true); setPage(1); }}
        >
          {t`Today`}
        </span>
      </div>

      {loading ? (
        <p>{t`Loading...`}</p>
      ) : (
        <>
          <table style={{ width: '100%' }}>
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
                      className="modallink"
                      onClick={() => handleFactionClick(faction.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {faction.avatar && (
                        <img
                          src={faction.avatar}
                          alt=""
                          style={{ width: 20, height: 20, marginRight: 4, verticalAlign: 'middle', borderRadius: 2 }}
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
            <p>{t`No factions found.`}</p>
          )}

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t`Previous`}
            </button>
            <span style={{ margin: '0 12px' }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t`Next`}
            </button>
          </div>
        </>
      )}

      <p style={{ marginTop: 16, fontSize: '0.9em', color: '#666' }}>
        {t`Ranking updates every 5 minutes.`}
      </p>
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
    <div style={{ marginBottom: 16 }}>
      <span
        role="button"
        tabIndex={-1}
        className={activeTab === 'my' ? 'modallink selected' : 'modallink'}
        onClick={() => setActiveTab('my')}
      >
        {t`My Faction`}
      </span>
      <span className="hdivider" />
      <span
        role="button"
        tabIndex={-1}
        className={activeTab === 'rankings' ? 'modallink selected' : 'modallink'}
        onClick={() => setActiveTab('rankings')}
      >
        {t`Rankings`}
      </span>
    </div>
  );

  if (activeTab === 'rankings') {
    return (
      <>
        {renderTabs()}
        <FactionRankingsTab />
      </>
    );
  }

  if (!userId) {
    return (
      <>
        {renderTabs()}
        <div className="content">
          <p>{t`You must be logged in to manage factions.`}</p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {renderTabs()}
        <div className="content">
          <p>{t`Loading...`}</p>
        </div>
      </>
    );
  }

  if (!hasFaction) {
    return (
      <>
        {renderTabs()}
        <FactionCreateForm onCreated={loadFaction} />
      </>
    );
  }

  return (
    <>
      {renderTabs()}
      <FactionManage
        faction={faction}
        onUpdate={loadFaction}
        onDeleted={() => {
          setFaction(null);
          setHasFaction(false);
        }}
      />
    </>
  );
};

export default React.memo(FactionArea);
