import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { pAlert } from '../store/actions/index.js';

const ObjectiveItem = ({ objective, onClaim, isExpanded, onToggle }) => {
  const isCompleted = objective.completed;
  const isClaimed = objective.rewardClaimed;
  const progressPercent = Math.min(100, Math.round((objective.currentValue / objective.targetValue) * 100));

  return (
    <>
      <tr
        className={`objrow ${isCompleted ? 'objdone' : ''} ${isClaimed ? 'objclaimed' : ''}`}
        onClick={onToggle}
      >
        <td className="objname">
          <span className={`objexpand ${isExpanded ? 'objexpanded' : ''}`}>▶</span>
          {objective.name}
        </td>
        <td className="objprog">
          {objective.currentValue.toLocaleString()}/{objective.targetValue.toLocaleString()}
        </td>
        <td className="objact">
          {isCompleted && !isClaimed && (
            <button
              type="button"
              className="objclaimbtn"
              onClick={(e) => { e.stopPropagation(); onClaim(objective.id); }}
            >
              {t`Claim`}
            </button>
          )}
          {isClaimed && <span className="objcheck">✓</span>}
          {!isCompleted && !isClaimed && <span className="objpend">-</span>}
        </td>
      </tr>
      {isExpanded && (
        <tr className="objdetailrow">
          <td colSpan="3" className="objdetail">
            <div className="objdesc">{objective.description}</div>
            <div className="objprogbar">
              <div className="objprogfill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="objprogtext">{progressPercent}%</div>
          </td>
        </tr>
      )}
    </>
  );
};

const DailyObjectives = () => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.id);

  const [objectives, setObjectives] = useState({ daily: [], weekly: [] });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchObjectives = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/objectives', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setObjectives(data);
      }
    } catch (err) {
      console.error('Failed to fetch objectives:', err);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const handleClaim = useCallback(async (objectiveId) => {
    if (claiming) return;

    setClaiming(true);

    try {
      const response = await fetch('/api/objectives/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ objectiveId }),
      });

      const data = await response.json();

      if (response.ok) {
        dispatch(pAlert(t`Reward Claimed!`, t`You received your reward!`, 'success'));
        fetchObjectives();
      } else {
        dispatch(pAlert(t`Error`, data.error || t`Failed to claim reward`, 'error'));
      }
    } catch (err) {
      dispatch(pAlert(t`Error`, err.message, 'error'));
    }

    setClaiming(false);
  }, [claiming, dispatch, fetchObjectives]);

  if (!userId) {
    return (
      <div className="objwrap">
        <p className="objmsg">{t`Log in to see your objectives`}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="objwrap">
        <p className="objmsg">{t`Loading...`}</p>
      </div>
    );
  }

  const dailyCompleted = objectives.daily.filter((o) => o.completed).length;
  const weeklyCompleted = objectives.weekly.filter((o) => o.completed).length;

  const totalCompleted = dailyCompleted + weeklyCompleted;
  const totalCount = objectives.daily.length + objectives.weekly.length;

  return (
    <div className="objwrap">
      <div className="obj-summary">
        <div className="obj-summary-stat">
          <span className="obj-summary-value">{totalCompleted}</span>
          <span className="obj-summary-label">{t`Completed`}</span>
        </div>
        <div className="obj-summary-stat">
          <span className="obj-summary-value">{totalCount - totalCompleted}</span>
          <span className="obj-summary-label">{t`Remaining`}</span>
        </div>
        <div className="obj-summary-bar-wrap">
          <div
            className="obj-summary-bar-fill"
            style={{ width: totalCount > 0 ? `${Math.round((totalCompleted / totalCount) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      <div className="objsec">
        <div className="objhead">
          <span>{t`Daily`}</span>
          <span className="objcnt">{dailyCompleted}/{objectives.daily.length}</span>
        </div>
        {objectives.daily.length === 0 ? (
          <p className="objmsg">{t`No daily objectives`}</p>
        ) : (
          <table className="objtbl">
            <tbody>
              {objectives.daily.map((obj) => (
                <ObjectiveItem
                  key={obj.id}
                  objective={obj}
                  onClaim={handleClaim}
                  isExpanded={expandedId === obj.id}
                  onToggle={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="objsec">
        <div className="objhead">
          <span>{t`Weekly`}</span>
          <span className="objcnt">{weeklyCompleted}/{objectives.weekly.length}</span>
        </div>
        {objectives.weekly.length === 0 ? (
          <p className="objmsg">{t`No weekly objectives`}</p>
        ) : (
          <table className="objtbl">
            <tbody>
              {objectives.weekly.map((obj) => (
                <ObjectiveItem
                  key={obj.id}
                  objective={obj}
                  onClaim={handleClaim}
                  isExpanded={expandedId === obj.id}
                  onToggle={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default React.memo(DailyObjectives);
