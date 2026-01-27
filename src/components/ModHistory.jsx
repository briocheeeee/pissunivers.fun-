import React, { useState, useEffect, useCallback } from 'react';
import { t } from 'ttag';

import { api } from '../utils/utag.js';

async function fetchHistory(filters) {
  const data = new FormData();
  data.append('gethistory', true);
  if (filters.action) data.append('action', filters.action);
  if (filters.muid) data.append('muid', filters.muid);
  if (filters.fromDate) data.append('fromDate', filters.fromDate);
  if (filters.toDate) data.append('toDate', filters.toDate);
  if (filters.search) data.append('search', filters.search);
  if (filters.page) data.append('page', filters.page);

  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    return resp.json();
  }
  return { total: 0, page: 1, totalPages: 1, actions: [] };
}

async function fetchFilters() {
  const data = new FormData();
  data.append('gethistoryfilters', true);

  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    return resp.json();
  }
  return { actions: [], moderators: [] };
}

function ModHistory() {
  const [history, setHistory] = useState({ total: 0, page: 1, totalPages: 1, actions: [] });
  const [filterOptions, setFilterOptions] = useState({ actions: [], moderators: [] });
  const [loading, setLoading] = useState(false);

  const [actionFilter, setActionFilter] = useState('');
  const [modFilter, setModFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const result = await fetchHistory({
      action: actionFilter,
      muid: modFilter,
      fromDate,
      toDate,
      search,
      page,
    });
    setHistory(result);
    setLoading(false);
  }, [actionFilter, modFilter, fromDate, toDate, search, page]);

  useEffect(() => {
    fetchFilters().then(setFilterOptions);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const clearFilters = () => {
    setActionFilter('');
    setModFilter('');
    setFromDate('');
    setToDate('');
    setSearch('');
    setPage(1);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="content modhistory">
      <h3>{t`Action History`}</h3>

      <div className="modhistory-filters">
        <label>
          {t`Action`}:
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          >
            <option value="">{t`All Actions`}</option>
            {filterOptions.actions.map((act) => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </label>

        <label>
          {t`Moderator`}:
          <select
            value={modFilter}
            onChange={(e) => { setModFilter(e.target.value); setPage(1); }}
          >
            <option value="">{t`All Moderators`}</option>
            {filterOptions.moderators.map((mod) => (
              <option key={mod.id} value={mod.id}>{mod.name}</option>
            ))}
          </select>
        </label>

        <label>
          {t`From`}:
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          />
        </label>

        <label>
          {t`To`}:
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          />
        </label>

        <label>
          {t`Search`}:
          <input
            type="text"
            value={search}
            placeholder={t`Search in target or details...`}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadHistory(); } }}
          />
        </label>

        <div className="modhistory-buttons">
          <button type="button" onClick={clearFilters}>
            {t`Clear Filters`}
          </button>
          <button type="button" onClick={loadHistory}>
            {t`Refresh`}
          </button>
        </div>
      </div>

      <div className="modhistory-info">
        {t`Total`}: {history.total} | {t`Page`}: {history.page}/{history.totalPages}
      </div>

      {loading ? (
        <p>{t`Loading...`}</p>
      ) : history.actions.length === 0 ? (
        <p>{t`No actions found`}</p>
      ) : (
        <table className="modhistory-table">
          <thead>
            <tr>
              <th>{t`Date`}</th>
              <th>{t`Moderator`}</th>
              <th>{t`Action`}</th>
              <th>{t`Target`}</th>
              <th>{t`Details`}</th>
            </tr>
          </thead>
          <tbody>
            {history.actions.map((action) => (
              <tr key={action.id}>
                <td>{formatDate(action.createdAt)}</td>
                <td>{action.mod ? action.mod.name : 'N/A'}</td>
                <td>{action.action}</td>
                <td>{action.target || '-'}</td>
                <td className="modhistory-details">{action.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {history.totalPages > 1 && (
        <div className="modhistory-pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ←
          </button>
          <span>{page} / {history.totalPages}</span>
          <button
            type="button"
            disabled={page >= history.totalPages}
            onClick={() => setPage(page + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(ModHistory);
