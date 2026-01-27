/*
 * ModWatchtools
 * Tools to check who placed what where
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { t } from 'ttag';

import copyTextToClipboard from '../utils/clipboard.js';
import { parseInterval, coordsFromString } from '../core/utils.js';
import { api, cdn } from '../utils/utag.js';
import { selectCanvas } from '../store/actions/index.js';

const keepState = {
  tlcoords: '',
  brcoords: '',
  interval: '15m',
  iid: '',
};

const LEVEL_COLORS = {
  low: '#f0ad4e',
  medium: '#fd7e14',
  high: '#dc3545',
};

const LEVEL_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const STATUS_LABELS = {
  pending: 'Pending',
  dismissed: 'Dismissed',
  banned: 'Banned',
};

function compare(a, b, asc) {
  if (typeof a === 'string' && typeof b === 'string') {
    let ret = a.localeCompare(b);
    if (asc) ret *= -1;
    return ret;
  }
  if (!a || a === 'N/A') a = 0;
  if (!b || b === 'N/A') b = 0;
  if (a < b) return (asc) ? -1 : 1;
  if (a > b) return (asc) ? 1 : -1;
  return 0;
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
}

async function fetchDetections(filters) {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.level) params.append('level', filters.level);
  if (filters.page) params.append('page', filters.page);
  params.append('limit', '10');
  params.append('sortBy', filters.sortBy || 'createdAt');
  params.append('sortOrder', filters.sortOrder || 'DESC');

  const resp = await fetch(api`/api/botdetection/list?${params.toString()}`, {
    credentials: 'include',
  });
  return resp.json();
}

async function fetchDetectionDetail(id) {
  const resp = await fetch(api`/api/botdetection/detail/${id}`, {
    credentials: 'include',
  });
  return resp.json();
}

async function fetchStats() {
  const resp = await fetch(api`/api/botdetection/stats`, {
    credentials: 'include',
  });
  return resp.json();
}

async function dismissDetection(id) {
  const resp = await fetch(api`/api/botdetection/dismiss/${id}`, {
    credentials: 'include',
    method: 'POST',
  });
  return resp.json();
}

async function banUser(id) {
  const resp = await fetch(api`/api/botdetection/ban/${id}`, {
    credentials: 'include',
    method: 'POST',
  });
  return resp.json();
}

async function banAndRollback(id) {
  const resp = await fetch(api`/api/botdetection/ban-rollback/${id}`, {
    credentials: 'include',
    method: 'POST',
  });
  return resp.json();
}

async function submitWatchAction(
  action,
  canvas,
  tlcoords,
  brcoords,
  interval,
  iid,
  callback,
) {
  let time = parseInterval(interval);
  if (!time) {
    callback({ info: t`Interval is invalid` });
    return;
  }
  time = Date.now() - time;
  const data = new FormData();
  data.append('watchaction', action);
  data.append('canvasid', canvas);
  data.append('ulcoor', tlcoords);
  data.append('brcoor', brcoords);
  data.append('time', time);
  data.append('iid', iid);
  try {
    const resp = await fetch(api`/api/modtools`, {
      credentials: 'include',
      method: 'POST',
      body: data,
    });
    callback(await resp.json());
  } catch (err) {
    callback({
      info: `Error: ${err.message}`,
    });
  }
}

function BotDetectionSection() {
  const [detections, setDetections] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: 'pending',
    level: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  const loadDetections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDetections({ ...filters, page });
      setDetections(result.records || []);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [filters, page]);

  const loadStats = useCallback(async () => {
    try {
      const result = await fetchStats();
      setStats(result);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => {
    loadDetections();
    loadStats();
  }, [loadDetections, loadStats]);

  useEffect(() => {
    if (selectedId) {
      setDetailLoading(true);
      fetchDetectionDetail(selectedId)
        .then((detail) => {
          setSelectedDetail(detail);
          setDetailLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load detail:', err);
          setDetailLoading(false);
        });
    } else {
      setSelectedDetail(null);
    }
  }, [selectedId]);

  const handleAction = async (action) => {
    if (!selectedId || actionLoading) return;
    let confirmMsg;
    if (action === 'ban') {
      confirmMsg = t`Are you sure you want to ban this user for 30 days?`;
    } else if (action === 'ban-rollback') {
      confirmMsg = t`Are you sure you want to ban this user AND rollback their pixels from the last 24 hours?`;
    } else {
      confirmMsg = t`Are you sure you want to dismiss this detection?`;
    }
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(true);
    try {
      if (action === 'ban') {
        await banUser(selectedId);
      } else if (action === 'ban-rollback') {
        await banAndRollback(selectedId);
      } else {
        await dismissDetection(selectedId);
      }
      setSelectedId(null);
      setSelectedDetail(null);
      loadDetections();
      loadStats();
    } catch (err) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const details = selectedDetail?.detectionDetails || {};
  const timing = details.timing || {};
  const geometric = details.geometric || {};

  return (
    <>
      <p>
        {stats && (
          <span>
            <strong>{t`Total`}:</strong> {stats.total || 0}
            {' | '}
            <strong>{t`Pending`}:</strong>{' '}
            <span style={{ color: '#fd7e14' }}>{stats.pending || 0}</span>
            {' | '}
            <strong>{t`Banned`}:</strong>{' '}
            <span style={{ color: '#dc3545' }}>{stats.banned || 0}</span>
          </span>
        )}
      </p>
      <p>
        {t`Status`}:&nbsp;
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="">{t`All`}</option>
          <option value="pending">{t`Pending`}</option>
          <option value="dismissed">{t`Dismissed`}</option>
          <option value="banned">{t`Banned`}</option>
        </select>
        {' '}
        {t`Level`}:&nbsp;
        <select
          value={filters.level}
          onChange={(e) => handleFilterChange('level', e.target.value)}
        >
          <option value="">{t`All`}</option>
          <option value="low">{t`Low`}</option>
          <option value="medium">{t`Medium`}</option>
          <option value="high">{t`High`}</option>
        </select>
        {' '}
        <button type="button" onClick={loadDetections}>
          {t`Refresh`}
        </button>
      </p>
      {error && <p style={{ color: '#dc3545' }}>{error}</p>}
      {loading ? (
        <p>{t`Loading...`}</p>
      ) : detections.length === 0 ? (
        <p>{t`No detections found`}</p>
      ) : (
        <>
          <table className="watchtable">
            <thead>
              <tr>
                <th>{t`Username`}</th>
                <th>{t`Level`}</th>
                <th>{t`Score`}</th>
                <th>{t`Date`}</th>
                <th>{t`Location`}</th>
                <th>{t`Status`}</th>
              </tr>
            </thead>
            <tbody>
              {detections.map((detection) => (
                <tr
                  key={detection.id}
                  onClick={() => setSelectedId(detection.id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedId === detection.id
                      ? 'rgba(66, 139, 202, 0.2)'
                      : undefined,
                  }}
                >
                  <td>{detection.userUsername || detection.ipString}</td>
                  <td>
                    <span style={{
                      backgroundColor: LEVEL_COLORS[detection.level],
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                    }}
                    >
                      {LEVEL_LABELS[detection.level]}
                    </span>
                  </td>
                  <td>{detection.score}</td>
                  <td>{formatDate(detection.createdAt)}</td>
                  <td>
                    {detection.locationX !== null
                      && detection.locationY !== null ? (
                        <a
                          href={`/#d,${detection.locationX},${detection.locationY},20`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {detection.locationX}, {detection.locationY}
                        </a>
                      ) : 'N/A'}
                  </td>
                  <td>{STATUS_LABELS[detection.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t`Previous`}
            </button>
            {' '}
            {t`Page`} {page} / {totalPages}
            {' '}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t`Next`}
            </button>
          </p>
        </>
      )}
      {selectedId && selectedDetail && !detailLoading && (
        <>
          <div className="modaldivider" />
          <h4>{t`Detection Details`}</h4>
          <p>
            <strong>{t`Username`}:</strong>{' '}
            {selectedDetail.userUsername || 'N/A'}
            {' | '}
            <strong>{t`User ID`}:</strong> {selectedDetail.uid || 'N/A'}
            {' | '}
            <strong>{t`IP`}:</strong> {selectedDetail.ipString}
          </p>
          <p>
            <strong>{t`Score`}:</strong> {selectedDetail.score}
            {' | '}
            <strong>{t`Level`}:</strong>{' '}
            <span style={{
              backgroundColor: LEVEL_COLORS[selectedDetail.level],
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
            }}
            >
              {LEVEL_LABELS[selectedDetail.level]}
            </span>
            {' | '}
            <strong>{t`Type`}:</strong> {selectedDetail.detectionType}
          </p>
          {timing.avgInterval !== undefined && (
            <p>
              <strong>{t`Timing`}:</strong>{' '}
              Avg: {timing.avgInterval?.toFixed(2)}ms |{' '}
              Variance: {timing.variance?.toFixed(2)}
            </p>
          )}
          {geometric.hasLine && (
            <p>
              <strong>{t`Line Pattern`}:</strong>{' '}
              {geometric.lineDetails?.length}px {geometric.lineDetails?.direction}
            </p>
          )}
          {details.flags && details.flags.length > 0 && (
            <p>
              <strong>{t`Flags`}:</strong> {details.flags.join(', ')}
            </p>
          )}
          {selectedDetail.status === 'pending' && (
            <p>
              <button
                type="button"
                onClick={() => handleAction('dismiss')}
                disabled={actionLoading}
              >
                {actionLoading ? '...' : t`Dismiss`}
              </button>
              {' '}
              <button
                type="button"
                style={{ backgroundColor: '#dc3545', color: 'white' }}
                onClick={() => handleAction('ban')}
                disabled={actionLoading}
              >
                {actionLoading ? '...' : t`Ban 30 Days`}
              </button>
              {' '}
              <button
                type="button"
                style={{ backgroundColor: '#8b0000', color: 'white' }}
                onClick={() => handleAction('ban-rollback')}
                disabled={actionLoading}
              >
                {actionLoading ? '...' : t`Ban + Rollback`}
              </button>
            </p>
          )}
          {selectedDetail.status !== 'pending' && (
            <p>
              <strong>{t`Decision`}:</strong>{' '}
              {STATUS_LABELS[selectedDetail.status]}
              {selectedDetail.decidedAt
                && ` (${formatDate(selectedDetail.decidedAt)})`}
            </p>
          )}
        </>
      )}
    </>
  );
}

function ModWatchtools() {
  const [sortAsc, setSortAsc] = useState(true);
  const [sortBy, setSortBy] = useState(0);
  const [table, setTable] = useState({});
  const [resp, setResp] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkedValues, setCheckedValues] = useState(new Set());

  useEffect(() => {
    setCheckedValues(new Set());
  }, [table]);

  const checkValue = (evt) => {
    const { target } = evt;
    const newCheckedValues = new Set(checkedValues);
    if (target.checked) {
      newCheckedValues.add(target.value);
    } else {
      newCheckedValues.delete(target.value);
    }
    setCheckedValues(newCheckedValues);
  };

  const [
    canvasId,
    canvases,
  ] = useSelector((state) => [
    state.canvas.canvasId,
    state.canvas.canvases,
  ], shallowEqual);

  const dispatch = useDispatch();

  const {
    columns, types, rows, ts,
  } = table;
  const cidColumn = (types) ? (types.indexOf('cid')) : -1;

  return (
    <div className="content">
      {resp && (
        <div className="respbox">
          {resp.split('\n').map((line) => (
            <p key={line.slice(0, 3)}>
              {line}
            </p>
          ))}
          <span
            role="button"
            tabIndex={-1}
            className="modallink"
            onClick={() => setResp(null)}
          >
            {t`Close`}
          </span>
        </div>
      )}
      <h3>{t`Area Watch`}</h3>
      <p>{t`Check who placed in an area`}</p>
      <p>
        {t`Canvas`}:&nbsp;
        <select
          value={canvasId}
          onChange={(e) => {
            const sel = e.target;
            dispatch(selectCanvas(sel.options[sel.selectedIndex].value));
          }}
        >
          {Object.keys(canvases)
            .filter((c) => !canvases[c].v)
            .map((canvas) => (
              <option key={canvas} value={canvas}>
                {canvases[canvas].title}
              </option>
            ))}
        </select>
        {` ${t`Interval`}: `}
        <input
          defaultValue={keepState.interval}
          style={{
            display: 'inline-block',
            width: '100%',
            maxWidth: '5em',
          }}
          type="text"
          placeholder="15m"
          onChange={(evt) => {
            keepState.interval = evt.target.value.trim();
          }}
        />
        {` ${t`IID (optional)`}: `}
        <input
          defaultValue={keepState.iid}
          style={{
            display: 'inline-block',
            width: '100%',
            maxWidth: '10em',
          }}
          type="text"
          placeholder="xxxx-xxxxx-xxxx"
          onChange={(evt) => {
            keepState.iid = evt.target.value.trim();
          }}
        />
      </p>
      <p>
        {t`Top-left corner`}:&nbsp;
        <input
          defaultValue={keepState.tlcoords}
          style={{
            display: 'inline-block',
            width: '100%',
            maxWidth: '15em',
          }}
          type="text"
          placeholder="X_Y or URL"
          onChange={(evt) => {
            let co = evt.target.value.trim();
            co = coordsFromString(co);
            if (co) {
              co = co.join('_');
              evt.target.value = co;
            }
            keepState.tlcoords = co;
          }}
        />
      </p>
      <p>
        {t`Bottom-right corner`}:&nbsp;
        <input
          defaultValue={keepState.brcoords}
          style={{
            display: 'inline-block',
            width: '100%',
            maxWidth: '15em',
          }}
          type="text"
          placeholder="X_Y or URL"
          onChange={(evt) => {
            let co = evt.target.value.trim();
            co = coordsFromString(co);
            if (co) {
              co = co.join('_');
              evt.target.value = co;
            }
            keepState.brcoords = co;
          }}
        />
      </p>
      <button
        type="button"
        onClick={() => {
          if (submitting) return;
          setSubmitting(true);
          submitWatchAction(
            'all',
            canvasId,
            keepState.tlcoords,
            keepState.brcoords,
            keepState.interval,
            keepState.iid,
            (ret) => {
              setSubmitting(false);
              setResp(ret.info);
              if (ret.rows) {
                setSortBy(0);
                setTable({
                  columns: ret.columns,
                  types: ret.types,
                  rows: ret.rows,
                  ts: Date.now(),
                });
              }
            },
          );
        }}
      >
        {(submitting) ? '...' : t`Get Pixels`}
      </button>
      <button
        type="button"
        onClick={() => {
          if (submitting) return;
          setSubmitting(true);
          submitWatchAction(
            'summary',
            canvasId,
            keepState.tlcoords,
            keepState.brcoords,
            keepState.interval,
            keepState.iid,
            (ret) => {
              setSubmitting(false);
              setResp(ret.info);
              if (ret.rows) {
                setSortBy(0);
                setTable({
                  columns: ret.columns,
                  types: ret.types,
                  rows: ret.rows,
                  ts: Date.now(),
                });
              }
            },
          );
        }}
      >
        {(submitting) ? '...' : t`Get Users`}
      </button>
      {(rows && columns && types) && (
        <React.Fragment key={ts}>
          <div className="modaldivider" />
          <table className="watchtable">
            <thead>
              <tr>
                {columns.slice(1).map((col, ind) => (
                  <th
                    key={col}
                    style={
                      (sortBy - 1 === ind) ? {
                        cursor: 'pointer',
                        fontWeight: 'normal',
                      } : {
                        cursor: 'pointer',
                      }
                    }
                    onClick={() => {
                      if (sortBy - 1 === ind) {
                        setSortAsc(!sortAsc);
                      } else {
                        setSortBy(ind + 1);
                      }
                    }}
                  >{col}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ userSelect: 'text' }}>
              {rows.sort((a, b) => compare(a[sortBy], b[sortBy], sortAsc))
                .map((row) => (
                  <tr key={row[0]}>
                    {row.slice(1).map((val, ind) => {
                      const type = types[ind + 1];
                      if (val === null) {
                        return (<td key={type}>N/A</td>);
                      }
                      switch (type) {
                        case 'ts': {
                          const date = new Date(val);
                          const hours = date.getHours();
                          const minutes = `0${date.getMinutes()}`.slice(-2);
                          const seconds = `0${date.getSeconds()}`.slice(-2);
                          const ms = `00${date.getMilliseconds()}`.slice(-3);
                          return (
                            <td key={type} title={date.toLocaleDateString()}>
                              {`${hours}:${minutes}:${seconds}.${ms}`}
                            </td>
                          );
                        }
                        case 'clr': {
                          const cid = (cidColumn > 0)
                            ? row[cidColumn] : canvasId;
                          const rgb = canvases[cid]
                            && canvases[cid].colors
                            && canvases[cid].colors[val];
                          if (!rgb) {
                            return (<td key={type}>{val}</td>);
                          }
                          const color = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
                          return (
                            <td
                              key={type}
                              style={{ backgroundColor: color }}
                            >{val}</td>
                          );
                        }
                        case 'coord': {
                          const cid = (cidColumn > 0)
                            ? row[cidColumn] : canvasId;
                          const ident = canvases[cid] && canvases[cid].ident;
                          const coords = `./#${ident},${val},47`;
                          return (
                            <td key={type}>
                              <a href={coords}>{val}</a>
                            </td>
                          );
                        }
                        case 'flag': {
                          const flag = val.toLowerCase();
                          return (
                            <td key={type} title={val}>
                              <img
                                style={{
                                  height: '1em',
                                  imageRendering: 'crisp-edges',
                                }}
                                alt={val}
                                src={cdn`/cf/${flag}.gif`}
                              />
                            </td>
                          );
                        }
                        case 'cid': {
                          const ident = canvases[val]?.ident;
                          return (<td key={type}>{ident}</td>);
                        }
                        case 'cidr': {
                          return (
                            <td key={type}>
                              <span
                                role="button"
                                tabIndex={-1}
                                style={{
                                  cursor: 'pointer',
                                  whiteSpace: 'initial',
                                }}
                                title={t`Copy to Clipboard`}
                                onClick={() => copyTextToClipboard(
                                  val.slice(0, val.indexOf('/')),
                                )}
                              >{val}</span>
                            </td>
                          );
                        }
                        case 'uuid': {
                          return (
                            <td key={type}>
                              <div className="checkcontainer">
                                <input
                                  type="checkbox"
                                  value={val}
                                  checked={checkedValues.has(val)}
                                  onChange={checkValue}
                                />
                                <span
                                  role="button"
                                  tabIndex={-1}
                                  className="modallink"
                                  style={{ whiteSpace: 'initial' }}
                                  title={t`Copy to Clipboard`}
                                  onClick={() => copyTextToClipboard(val)}
                                >{val}</span>
                              </div>
                            </td>
                          );
                        }
                        case 'user': {
                          const seperator = val.lastIndexOf(',');
                          if (seperator === -1) {
                            return (<td key={type}><span>{val}</span></td>);
                          }
                          const uid = val.slice(seperator + 1);
                          return (
                            <td key={type}>
                              <div className="checkcontainer">
                                <input
                                  type="checkbox"
                                  value={uid}
                                  checked={checkedValues.has(uid)}
                                  onChange={checkValue}
                                />
                                <span
                                  role="button"
                                  tabIndex={-1}
                                  className="modallink"
                                  title={t`Copy UserId to Clipboard`}
                                  onClick={() => copyTextToClipboard(uid)}
                                >
                                  {`${val.slice(0, seperator)} [${uid}]`}
                                </span>
                              </div>
                            </td>
                          );
                        }
                        default: {
                          return (<td key={type}>{val}</td>);
                        }
                      }
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
          <br />
          <button
            type="button"
            onClick={() => copyTextToClipboard(
              Array.from(checkedValues).join('\n'),
            )}
            disabled={checkedValues.size === 0}
          >
            {t`Copy Selected to Clipboard`}
          </button>
        </React.Fragment>
      )}
      <div className="modaldivider" />
      <h3>{t`Bot Detection`}</h3>
      <p>{t`Automatic detection of suspicious pixel placement patterns`}</p>
      <BotDetectionSection />
    </div>
  );
}

export default React.memo(ModWatchtools);
