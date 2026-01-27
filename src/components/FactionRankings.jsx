import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import { requestFactionRankings } from '../store/actions/fetch.js';
import { numberToString } from '../core/utils.js';
import useLink from './hooks/link.js';

const FactionRankings = () => {
  const dispatch = useDispatch();
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
    <>
      <div className="content">
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
      <br />
      <h3>{daily ? t`Daily Faction Rankings` : t`Total Faction Rankings`}</h3>

      {loading ? (
        <p>{t`Loading...`}</p>
      ) : (
        <>
          <table style={{ display: 'inline' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t`Tag`}</th>
                <th>{t`Name`}</th>
                <th>{t`Members`}</th>
                <th>{daily ? t`Pixels Today` : t`Total Pixels`}</th>
                <th>{daily ? t`Total Pixels` : t`Pixels Today`}</th>
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
                      [{faction.tag}]
                    </span>
                  </td>
                  <td>
                    <span
                      role="button"
                      tabIndex={-1}
                      className="modallink"
                      onClick={() => handleFactionClick(faction.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {faction.name}
                    </span>
                  </td>
                  <td>{faction.memberCount}</td>
                  <td className="c-num">
                    {numberToString(daily ? faction.dailyPixels : faction.totalPixels)}
                  </td>
                  <td className="c-num">
                    {numberToString(daily ? faction.totalPixels : faction.dailyPixels)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rankings.length === 0 && (
            <p>{t`No factions found.`}</p>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t`Previous`}
            </button>
            <span style={{ margin: '0 12px' }}>
              {t`Page`} {page} / {totalPages}
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
    </>
  );
};

export default React.memo(FactionRankings);
