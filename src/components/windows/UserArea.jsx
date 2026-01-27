/**
 *
 */

import React, { Suspense, useCallback, useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { fetchStats } from '../../store/actions/thunks.js';
import WindowContext from '../context/window.js';
import useInterval from '../hooks/interval.js';
import Tabs from '../Tabs.jsx';
import UserAreaContent from '../UserAreaContent.jsx';
import { USERLVL } from '../../core/constants.js';

// eslint-disable-next-line max-len
const Rankings = React.lazy(() => import(/* webpackChunkName: "stats" */ '../Rankings.jsx'));
// eslint-disable-next-line max-len
const Converter = React.lazy(() => import(/* webpackChunkName: "converter" */ '../Converter.jsx'));
// eslint-disable-next-line max-len
const Modtools = React.lazy(() => import(/* webpackChunkName: "modtools" */ '../Modtools.jsx'));
// eslint-disable-next-line max-len
const FactionArea = React.lazy(() => import(/* webpackChunkName: "faction" */ '../FactionArea.jsx'));
// eslint-disable-next-line max-len
const TeamOfTheWeek = React.lazy(() => import(/* webpackChunkName: "totw" */ '../TeamOfTheWeek.jsx'));
// eslint-disable-next-line max-len
const DailyObjectives = React.lazy(() => import(/* webpackChunkName: "objectives" */ '../DailyObjectives.jsx'));

const UserArea = () => {
  const userlvl = useSelector((state) => state.user.userlvl);
  const lastStatsFetch = useSelector((state) => state.ranks.lastFetch);

  const {
    args,
    setArgs,
    setTitle,
  } = useContext(WindowContext);
  const {
    activeTab = t`Profile`,
  } = args;
  const dispatch = useDispatch();

  const setActiveTab = useCallback((label) => {
    setArgs({
      activeTab: label,
    });
    setTitle(label);
  }, [setArgs, setTitle]);

  useInterval(() => {
    if (Date.now() - 300000 > lastStatsFetch) {
      dispatch(fetchStats());
    }
  }, 300000);

  return (
    <div style={{ textAlign: 'center' }}>
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab}>
        <div label={t`Profile`}>
          <UserAreaContent />
        </div>
        <div label={t`Statistics`}>
          <Suspense fallback={<div>Loading...</div>}>
            <Rankings />
          </Suspense>
        </div>
        <div label={t`Converter`}>
          <Suspense fallback={<div>Loading...</div>}>
            <Converter />
          </Suspense>
        </div>
        <div label={t`Faction`}>
          <Suspense fallback={<div>{t`Loading...`}</div>}>
            <FactionArea />
          </Suspense>
        </div>
        <div label={t`TOTW`}>
          <Suspense fallback={<div>{t`Loading...`}</div>}>
            <TeamOfTheWeek />
          </Suspense>
        </div>
        <div label={t`Objectives`}>
          <Suspense fallback={<div>{t`Loading...`}</div>}>
            <DailyObjectives />
          </Suspense>
        </div>
        {(userlvl >= USERLVL.JANNY) && (
        <div label={(userlvl >= USERLVL.ADMIN) ? t`Admintools` : t`Modtools`}>
          <Suspense fallback={<div>{t`Loading...`}</div>}>
            <Modtools />
          </Suspense>
        </div>
        )}
      </Tabs>
      <br />
      {t`Consider joining us on Discord:`}&nbsp;
      <a href="./guilded" target="_blank">{t`Invited to Chat`}</a>
      <br />
    </div>
  );
};

export default React.memo(UserArea);
