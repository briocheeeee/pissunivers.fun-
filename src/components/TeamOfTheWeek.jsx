import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  requestTOTWNominees,
  requestTOTWVote,
  requestTOTWHallOfFame,
  requestTOTWTopFactions,
  requestTOTWMyHistory,
} from '../store/actions/fetch.js';
import { pAlert } from '../store/actions/index.js';
import { numberToString } from '../core/utils.js';
import useLink from './hooks/link.js';

const CATEGORY_NAMES = { 0: 'Small', 1: 'Medium', 2: 'Large' };
const CATEGORY_DESC = { 0: '2-10', 1: '11-30', 2: '31+' };
const AWARD_NAMES = { 0: 'Winner', 1: 'Most Improved', 2: 'Underdog', 3: 'Community Choice' };

const getCountdown = (target) => {
  const diff = target - new Date();
  if (diff <= 0) return t`Now`;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
};

const getVotingDates = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const hr = now.getUTCHours();
  const start = new Date(now);
  start.setUTCHours(12, 0, 0, 0);
  const toFri = (5 - day + 7) % 7;
  if (day === 5 && hr >= 12) start.setUTCDate(start.getUTCDate() + 7);
  else start.setUTCDate(start.getUTCDate() + toFri);
  const end = new Date(now);
  end.setUTCHours(23, 0, 0, 0);
  const toSun = (7 - day) % 7;
  if (day === 0 && hr >= 23) end.setUTCDate(end.getUTCDate() + 7);
  else if (day !== 0) end.setUTCDate(end.getUTCDate() + toSun);
  return { start, end };
};

const NomineeCard = ({ nominee, onVote, canVote, userVote, rank }) => {
  const link = useLink();
  const voted = userVote === nominee.id;
  const { isWinner } = nominee;

  const handleClick = () => {
    link('FACTION_PUBLIC', { target: 'blank', args: { factionId: nominee.factionId } });
  };

  return (
    <div className={`totw-card ${isWinner ? 'winner' : ''} ${voted ? 'voted' : ''}`}>
      {isWinner && <div className="totw-card-badge">{t`Winner`}</div>}
      <div className="totw-card-rank">#{rank}</div>
      <div className="totw-card-header" onClick={handleClick}>
        {nominee.factionAvatar ? (
          <img className="totw-card-avatar" src={nominee.factionAvatar} alt="" />
        ) : (
          <div className="totw-card-avatar-placeholder">
            {nominee.factionTag?.substring(0, 2)}
          </div>
        )}
        <div className="totw-card-info">
          <div className="totw-card-name">[{nominee.factionTag}] {nominee.factionName}</div>
          <div className="totw-card-members">{nominee.memberCount} {t`members`}</div>
        </div>
      </div>
      <div className="totw-card-stats">
        <div className="totw-card-stat">
          <span className="totw-card-stat-value">{numberToString(nominee.pixelsCaptured)}</span>
          <span className="totw-card-stat-label">{t`Pixels`}</span>
        </div>
        <div className="totw-card-stat">
          <span className="totw-card-stat-value">{nominee.voteCount || 0}</span>
          <span className="totw-card-stat-label">{t`Votes`}</span>
        </div>
      </div>
      {canVote && !userVote && (
        <button className="totw-card-vote" onClick={() => onVote(nominee.id)}>
          {t`Vote`}
        </button>
      )}
      {voted && <div className="totw-card-voted">✓ {t`Your Vote`}</div>}
    </div>
  );
};

const CategorySection = ({ category, nominees, onVote, canVote, userVote }) => {
  if (!nominees?.length) return null;

  return (
    <div className="totw-section">
      <div className="totw-section-header">
        <h3>{CATEGORY_NAMES[category]} {t`Factions`}</h3>
        <span className="totw-section-desc">{CATEGORY_DESC[category]} {t`members`}</span>
      </div>
      <div className="totw-cards">
        {nominees.map((n, i) => (
          <NomineeCard
            key={n.id}
            nominee={n}
            rank={i + 1}
            onVote={onVote}
            canVote={canVote}
            userVote={userVote}
          />
        ))}
      </div>
    </div>
  );
};

const CurrentWeekTab = () => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState(null);
  const [countdown, setCountdown] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await requestTOTWNominees();
    if (!res.errors) setData(res);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data?.week) return undefined;
    const { start, end } = getVotingDates();
    const update = () => {
      if (data.week.finalized) setCountdown('');
      else if (data.week.votingOpen) setCountdown(getCountdown(end));
      else setCountdown(getCountdown(start));
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [data]);

  const handleVote = async (nomineeId) => {
    if (!userId) {
      dispatch(pAlert(t`Error`, t`You must be logged in to vote`, 'error'));
      return;
    }
    const res = await requestTOTWVote(nomineeId);
    if (res.errors) dispatch(pAlert(t`Error`, res.errors[0], 'error'));
    else {
      dispatch(pAlert(t`Success`, t`Vote recorded`, 'info'));
      setUserVote(nomineeId);
      load();
    }
  };

  if (loading) return <div className="totw-loading">{t`Loading...`}</div>;
  if (!data?.week) return <div className="totw-empty">{t`No data available`}</div>;

  const { week, categories, specialAwards } = data;
  const canVote = week.votingOpen && !week.finalized && userId && !userVote;

  return (
    <div className="totw-current">
      <div className="totw-status-box">
        <div className="totw-status-main">
          <span className="totw-status-week">{t`Week`} {week.weekNumber}, {week.year}</span>
          <span className={`totw-status-badge ${week.finalized ? 'finalized' : week.votingOpen ? 'voting' : 'pending'}`}>
            {week.finalized ? t`Finalized` : week.votingOpen ? t`Voting Open` : t`In Progress`}
          </span>
        </div>
        {countdown && (
          <div className="totw-status-countdown">
            {week.votingOpen ? t`Voting closes in:` : t`Voting opens in:`} <strong>{countdown}</strong>
          </div>
        )}
      </div>

      <div className="totw-info-box">
        <h4>{t`How It Works`}</h4>
        <p>{t`Factions are ranked by total pixels placed during the week.`}</p>
        <p>{t`Community voting: Friday 12:00 UTC - Sunday 23:00 UTC`}</p>
      </div>

      {!week.votingOpen && !week.finalized && (
        <div className="totw-notice-box">
          {t`Nominees will appear when voting opens on Friday.`}
        </div>
      )}

      {(week.votingOpen || week.finalized) && (
        <>
          <CategorySection category={2} nominees={categories?.[2]} onVote={handleVote} canVote={canVote} userVote={userVote} />
          <CategorySection category={1} nominees={categories?.[1]} onVote={handleVote} canVote={canVote} userVote={userVote} />
          <CategorySection category={0} nominees={categories?.[0]} onVote={handleVote} canVote={canVote} userVote={userVote} />

          {specialAwards?.length > 0 && (
            <div className="totw-section">
              <div className="totw-section-header">
                <h3>{t`Special Awards`}</h3>
              </div>
              <div className="totw-cards">
                {specialAwards.map((n) => (
                  <div key={n.id} className="totw-special-card">
                    <div className="totw-special-type">{AWARD_NAMES[n.awardType]}</div>
                    <NomineeCard nominee={n} rank="-" onVote={handleVote} canVote={canVote} userVote={userVote} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const HallOfFameTab = () => {
  const link = useLink();
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await requestTOTWHallOfFame(page, 10);
      if (!res.errors) {
        setWinners(res.winners || []);
        setTotalPages(res.totalPages || 1);
      }
      setLoading(false);
    };
    load();
  }, [page]);

  const handleClick = (factionId) => {
    link('FACTION_PUBLIC', { target: 'blank', args: { factionId } });
  };

  if (loading) return <div className="totw-loading">{t`Loading...`}</div>;

  return (
    <div className="totw-hall">
      {winners.length === 0 ? (
        <div className="totw-empty">{t`No winners yet`}</div>
      ) : (
        <>
          <div className="totw-hall-list">
            {winners.map((w) => (
              <div key={w.winnerId} className="totw-hall-item">
                <div className="totw-hall-week">{t`Week`} {w.weekNumber}, {w.year}</div>
                <div className="totw-hall-faction" onClick={() => handleClick(w.factionId)}>
                  {w.factionAvatar && <img className="totw-hall-avatar" src={w.factionAvatar} alt="" />}
                  <span className="totw-hall-name">[{w.factionTag}] {w.factionName}</span>
                </div>
                <div className="totw-hall-category">{CATEGORY_NAMES[w.category]}</div>
                <div className={`totw-hall-award award-${w.awardType}`}>{AWARD_NAMES[w.awardType]}</div>
              </div>
            ))}
          </div>
          <div className="totw-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t`Previous`}
            </button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t`Next`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const TopFactionsTab = () => {
  const link = useLink();
  const [factions, setFactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await requestTOTWTopFactions(10);
      if (!res.errors) setFactions(res.topFactions || []);
      setLoading(false);
    };
    load();
  }, []);

  const handleClick = (factionId) => {
    link('FACTION_PUBLIC', { target: 'blank', args: { factionId } });
  };

  if (loading) return <div className="totw-loading">{t`Loading...`}</div>;

  return (
    <div className="totw-top">
      {factions.length === 0 ? (
        <div className="totw-empty">{t`No data yet`}</div>
      ) : (
        <div className="totw-top-list">
          {factions.map((f, i) => (
            <div key={f.factionId} className={`totw-top-item rank-${i + 1}`} onClick={() => handleClick(f.factionId)}>
              <div className="totw-top-rank">#{i + 1}</div>
              {f.factionAvatar ? (
                <img className="totw-top-avatar" src={f.factionAvatar} alt="" />
              ) : (
                <div className="totw-top-avatar-placeholder">{f.factionTag?.substring(0, 2)}</div>
              )}
              <div className="totw-top-info">
                <div className="totw-top-name">[{f.factionTag}] {f.factionName}</div>
                <div className="totw-top-wins">{f.winCount} {f.winCount === 1 ? t`win` : t`wins`}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MyHistoryTab = () => {
  const userId = useSelector((state) => state.user.id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await requestTOTWMyHistory();
      if (!res.errors) setData(res);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (!userId) return <div className="totw-empty">{t`Log in to see your history`}</div>;
  if (loading) return <div className="totw-loading">{t`Loading...`}</div>;
  if (!data?.hasFaction) return <div className="totw-empty">{t`Join a faction to participate`}</div>;

  return (
    <div className="totw-my">
      <div className="totw-my-header">
        <div className="totw-my-faction">[{data.factionTag}] {data.factionName}</div>
        <div className="totw-my-stats">
          <div className="totw-my-stat">
            <span className="totw-my-stat-value">{data.nominations}</span>
            <span className="totw-my-stat-label">{t`Nominations`}</span>
          </div>
          <div className="totw-my-stat">
            <span className="totw-my-stat-value">{data.wins}</span>
            <span className="totw-my-stat-label">{t`Wins`}</span>
          </div>
        </div>
      </div>

      {data.history?.length > 0 ? (
        <div className="totw-my-list">
          {data.history.map((h, i) => (
            <div key={i} className={`totw-my-item ${h.isWinner ? 'winner' : ''}`}>
              <div className="totw-my-week">{t`Week`} {h.weekNumber}, {h.year}</div>
              <div className="totw-my-category">{CATEGORY_NAMES[h.category]}</div>
              <div className="totw-my-pixels">{numberToString(h.pixelsCaptured)} px</div>
              <div className="totw-my-result">
                {h.isWinner ? (
                  <span className="totw-my-win">★ {AWARD_NAMES[h.winAwardType || 0]}</span>
                ) : (
                  <span className="totw-my-nom">{t`Nominated`}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="totw-empty">{t`No participation yet`}</div>
      )}
    </div>
  );
};

const TeamOfTheWeek = () => {
  const [tab, setTab] = useState('current');

  return (
    <div className="totw-container">
      <div className="totw-tabs">
        <span
          role="button"
          tabIndex={-1}
          className={tab === 'current' ? 'modallink selected' : 'modallink'}
          onClick={() => setTab('current')}
        >
          {t`This Week`}
        </span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={tab === 'hall' ? 'modallink selected' : 'modallink'}
          onClick={() => setTab('hall')}
        >
          {t`Hall of Fame`}
        </span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={tab === 'top' ? 'modallink selected' : 'modallink'}
          onClick={() => setTab('top')}
        >
          {t`Most Wins`}
        </span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={tab === 'my' ? 'modallink selected' : 'modallink'}
          onClick={() => setTab('my')}
        >
          {t`My History`}
        </span>
      </div>
      <div className="totw-content">
        {tab === 'current' && <CurrentWeekTab />}
        {tab === 'hall' && <HallOfFameTab />}
        {tab === 'top' && <TopFactionsTab />}
        {tab === 'my' && <MyHistoryTab />}
      </div>
    </div>
  );
};

export default React.memo(TeamOfTheWeek);
