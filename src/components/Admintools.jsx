/*
 * Admintools
 */

import React, { useState, useEffect, useCallback } from 'react';
import { t } from 'ttag';

import DeleteList from './DeleteList.jsx';
import AdminBadgeManager from './AdminBadgeManager.jsx';
import { api } from '../utils/utag.js';
import { USERLVL } from '../core/constants.js';

async function submitTextAction(
  action,
  text,
  callback,
) {
  const data = new FormData();
  data.append('textaction', action);
  data.append('text', text);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(await resp.text());
}

async function getModList(callback) {
  const data = new FormData();
  data.append('modlist', true);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback([]);
  }
}

async function submitRemMod(userId, callback) {
  const data = new FormData();
  data.append('remmod', userId);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(resp.ok, await resp.text());
}

async function submitMakeMod(userName, userlvl, callback) {
  const data = new FormData();
  data.append('makemod', userName);
  data.append('userlvl', userlvl);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback(await resp.text());
  }
}

async function submitQuickAction(action, callback) {
  const data = new FormData();
  data.append('quickaction', action);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(await resp.text());
}

async function getGameState(
  callback,
) {
  const data = new FormData();
  data.append('gamestate', true);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback({
    });
  }
}

async function listFactions(search, page, callback) {
  const data = new FormData();
  data.append('listfactions', true);
  if (search) data.append('search', search);
  data.append('page', page || 1);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback({ factions: [], total: 0 });
  }
}

async function dissolveFaction(factionId, reason, callback) {
  const data = new FormData();
  data.append('dissolvefaction', true);
  data.append('factionId', factionId);
  if (reason) data.append('reason', reason);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(resp.ok, resp.ok ? await resp.json() : await resp.text());
}

async function sendAdminMessage(toUserId, message, callback) {
  const data = new FormData();
  data.append('sendadminmessage', true);
  data.append('toUserId', toUserId);
  data.append('message', message);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(true, await resp.json());
  } else {
    const result = await resp.json();
    callback(false, result.error || 'Failed to send message');
  }
}

function Admintools() {
  const [textAction, selectTextAction] = useState('iidtoip');
  const [modName, selectModName] = useState('');
  const [modType, selectModType] = useState(USERLVL.MOD);
  const [txtval, setTxtval] = useState('');
  const [resp, setResp] = useState(null);
  const [modlist, setModList] = useState({});
  const [gameState, setGameState] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [factions, setFactions] = useState([]);
  const [factionSearch, setFactionSearch] = useState('');
  const [factionPage, setFactionPage] = useState(1);
  const [factionTotal, setFactionTotal] = useState(0);
  const [dissolveId, setDissolveId] = useState(null);
  const [dissolveReason, setDissolveReason] = useState('');
  const [msgUserId, setMsgUserId] = useState('');
  const [msgText, setMsgText] = useState('');

  useEffect(() => {
    getModList((mods) => setModList(mods));
  }, []);

  useEffect(() => {
    getGameState((stats) => setGameState(stats));
  }, []);

  const reqQuickAction = useCallback((action) => () => {
    if (submitting) return;
    setSubmitting(true);
    submitQuickAction(action, (ret) => {
      setResp(ret);
      setSubmitting(false);
    });
  }, [submitting]);

  const promoteUser = useCallback(() => {
    if (submitting) return;
    setSubmitting(true);
    submitMakeMod(
      modName, modType,
      (ret) => {
        if (typeof ret === 'string') {
          setResp(ret);
        } else {
          const [id, name] = ret;
          setResp(`Made ${name} mod successfully.`);
          const newModList = {};
          /* make sure new mod is not in any other list already */
          Object.keys(modlist).forEach((lvl) => {
            newModList[lvl] = modlist[lvl].filter(
              (modl) => (modl[0] !== id),
            );
          });
          newModList[modType] = [...(newModList[modType] || []), ret];
          setModList(newModList);
        }
        setSubmitting(false);
      },
    );
  }, [submitting, modType, modName, modlist]);

  const demoteUser = useCallback((id) => {
    if (submitting) return;
    setSubmitting(true);
    submitRemMod(id, (success, ret) => {
      if (success) {
        const newModList = {};
        Object.keys(modlist).forEach((userlvl) => {
          newModList[userlvl] = modlist[userlvl].filter(
            (modl) => (modl[0] !== id),
          );
        });
        setModList(newModList);
      }
      setSubmitting(false);
      setResp(ret);
    });
  }, [submitting, modlist]);

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
      <div>
        <br />
        <h3>{t`IP Actions`}</h3>
        <p>
          {t`Do stuff with IPs (one IP per line)`}
        </p>
        <select
          value={textAction}
          onChange={(e) => {
            const sel = e.target;
            selectTextAction(sel.options[sel.selectedIndex].value);
          }}
        >
          {['iidtoip', 'iptoiid', 'markusersashacked', 'announce']
            .map((opt) => (
              <option
                key={opt}
                value={opt}
              >
                {opt}
              </option>
            ))}
        </select>
        <br />
        <textarea
          rows="15"
          cols="25"
          value={txtval}
          onChange={(e) => setTxtval(e.target.value)}
        /><br />
        <button
          type="button"
          onClick={() => {
            if (submitting) return;
            setSubmitting(true);
            submitTextAction(
              textAction,
              txtval,
              (ret) => {
                setSubmitting(false);
                setTxtval(ret);
              },
            );
          }}
        >
          {(submitting) ? '...' : t`Submit`}
        </button>
        <br />
        <div className="modaldivider" />

        <h3>{t`Quick Actions`}</h3>
        <button
          type="button"
          onClick={reqQuickAction('resetcaptchas')}
        >
          {(submitting) ? '...' : t`Reset Captchas of ALL Users`}
        </button>
        <br />
        <button
          type="button"
          onClick={reqQuickAction('rollcaptchafonts')}
        >
          {(submitting) ? '...' : t`Roll different Captcha Fonts`}
        </button>
        <br />
        {(gameState.needVerification) ? (
          <button
            key="disableverify"
            type="button"
            onClick={() => {
              reqQuickAction('disableverify')();
              setGameState({ ...gameState, needVerification: false });
            }}
          >
            {(submitting) ? '...' : t`Stop requiring Verification to Place`}
          </button>
        ) : (
          <button
            key="enableverify"
            type="button"
            onClick={() => {
              reqQuickAction('enableverify')();
              setGameState({ ...gameState, needVerification: true });
            }}
          >
            {(submitting) ? '...' : t`Require Verification to Place`}
          </button>
        )}
        <br />
        {(gameState.malwareCheck) ? (
          <button
            key="disablemalware"
            type="button"
            onClick={() => {
              reqQuickAction('disablemalware')();
              setGameState({ ...gameState, malwareCheck: false });
            }}
          >
            {(submitting) ? '...' : t`Stop checking for Malware`}
          </button>
        ) : (
          <button
            key="enablemalware"
            type="button"
            onClick={() => {
              reqQuickAction('enablemalware')();
              setGameState({ ...gameState, malwareCheck: true });
            }}
          >
            {(submitting) ? '...' : t`Start checking for Malware`}
          </button>
        )}
        <br />
        <div className="modaldivider" />

        <h3>{t`Manage Moderators`}</h3>
        {(modlist[USERLVL.MOD]?.length > 0) && (
          <React.Fragment key="mmod">
            <p>{t`Remove Moderator`}</p>
            <DeleteList
              list={modlist[USERLVL.MOD]}
              callback={demoteUser}
              enabled={!submitting}
              joinident
            />
            <br />
          </React.Fragment>
        )}
        {(modlist[USERLVL.JANNY]?.length > 0) && (
          <React.Fragment key="mjan">
            <p>{t`Remove Janny`}</p>
            <DeleteList
              list={modlist[USERLVL.JANNY]}
              callback={demoteUser}
              enabled={!submitting}
              joinident
            />
            <br />
          </React.Fragment>
        )}
        {(modlist[USERLVL.CLEANER]?.length > 0) && (
          <React.Fragment key="mcln">
            <p>{t`Remove Cleaner`}</p>
            <DeleteList
              list={modlist[USERLVL.CLEANER]}
              callback={demoteUser}
              enabled={!submitting}
              joinident
            />
            <br />
          </React.Fragment>
        )}
        <p>
          { t`Assign new Mod` }
        </p>
        <p>
          {t`Enter UserName of new Mod`}:&nbsp;
          <input
            value={modName}
            style={{
              display: 'inline-block',
              width: '100%',
              maxWidth: '20em',
            }}
            type="text"
            placeholder={t`User Name`}
            onChange={(evt) => {
              const co = evt.target.value.trim();
              selectModName(co);
            }}
          />
        </p>
        <p>
          {t`Type of Mod`}:&nbsp;
          <select
            value={modType}
            onChange={(e) => {
              const sel = e.target;
              selectModType(parseInt(sel.options[sel.selectedIndex].value, 10));
            }}
          >
            {['MOD', 'JANNY', 'CLEANER'].map((opt) => (
              <option
                key={opt}
                value={USERLVL[opt]}
              >
                {opt}
              </option>
            ))}
          </select>
        </p>
        <p>{(() => {
          switch (modType) {
            case USERLVL.MOD:
              return t`Moderators can access all Canvas, Watch and IID tools.`;
            case USERLVL.JANNY:
              return t`Jannies can rollback and protect, but not watch or ban.`;
            case USERLVL.CLEANER:
              return t`Cleaners can use 0cd blank colors.`;
            default:
              return null;
          }
        })()}</p>
        <button
          type="button"
          onClick={promoteUser}
        >
          {(submitting) ? '...' : t`Submit`}
        </button>
        <br />
        <div className="modaldivider" />

        <h3>{t`Faction Management`}</h3>
        <p>
          {t`Search Factions`}:&nbsp;
          <input
            type="text"
            value={factionSearch}
            onChange={(e) => setFactionSearch(e.target.value)}
            placeholder={t`Name or Tag`}
            style={{ width: '150px' }}
          />
          <button
            type="button"
            onClick={() => {
              setFactionPage(1);
              listFactions(factionSearch, 1, (res) => {
                setFactions(res.factions || []);
                setFactionTotal(res.total || 0);
              });
            }}
            style={{ marginLeft: 8 }}
          >
            {t`Search`}
          </button>
        </p>
        {factions.length > 0 && (
          <>
            <table style={{ width: '100%', fontSize: '0.9em' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t`Name`}</th>
                  <th>{t`Tag`}</th>
                  <th>{t`Owner`}</th>
                  <th>{t`Members`}</th>
                  <th>{t`Actions`}</th>
                </tr>
              </thead>
              <tbody>
                {factions.map((f) => (
                  <tr key={f.id}>
                    <td>{f.id}</td>
                    <td>{f.name}</td>
                    <td>[{f.tag}]</td>
                    <td>{f.ownerName}</td>
                    <td>{f.memberCount}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setDissolveId(f.id)}
                      >
                        {t`Dissolve`}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {t`Total`}: {factionTotal} |{' '}
              {factionPage > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newPage = factionPage - 1;
                    setFactionPage(newPage);
                    listFactions(factionSearch, newPage, (res) => {
                      setFactions(res.factions || []);
                    });
                  }}
                >{t`Prev`}</button>
              )}
              {' '}{t`Page`} {factionPage}{' '}
              {factions.length >= 50 && (
                <button
                  type="button"
                  onClick={() => {
                    const newPage = factionPage + 1;
                    setFactionPage(newPage);
                    listFactions(factionSearch, newPage, (res) => {
                      setFactions(res.factions || []);
                    });
                  }}
                >{t`Next`}</button>
              )}
            </p>
          </>
        )}
        {dissolveId && (
          <div style={{ padding: 8, border: '1px solid #c00', marginBottom: 8 }}>
            <p>{t`Dissolve Faction`} #{dissolveId}</p>
            <input
              type="text"
              value={dissolveReason}
              onChange={(e) => setDissolveReason(e.target.value)}
              placeholder={t`Reason (optional)`}
              style={{ width: '200px' }}
            />
            <button
              type="button"
              onClick={() => {
                if (submitting) return;
                setSubmitting(true);
                dissolveFaction(dissolveId, dissolveReason, (ok, result) => {
                  setSubmitting(false);
                  if (ok) {
                    setResp(t`Faction dissolved successfully`);
                    setFactions(factions.filter((f) => f.id !== dissolveId));
                    setDissolveId(null);
                    setDissolveReason('');
                  } else {
                    setResp(typeof result === 'string' ? result : t`Failed to dissolve faction`);
                  }
                });
              }}
              style={{ marginLeft: 8 }}
            >
              {submitting ? '...' : t`Confirm`}
            </button>
            <button
              type="button"
              onClick={() => { setDissolveId(null); setDissolveReason(''); }}
              style={{ marginLeft: 8 }}
            >
              {t`Cancel`}
            </button>
          </div>
        )}
        <br />
        <div className="modaldivider" />

        <h3>{t`Send Admin Message`}</h3>
        <p>
          {t`User ID`}:&nbsp;
          <input
            type="text"
            value={msgUserId}
            onChange={(e) => setMsgUserId(e.target.value)}
            placeholder="123"
            style={{ width: '80px' }}
          />
        </p>
        <p>
          {t`Message`}:
        </p>
        <textarea
          rows="4"
          cols="40"
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          placeholder={t`Enter message to send to user...`}
        />
        <br />
        <button
          type="button"
          onClick={() => {
            if (submitting || !msgUserId || !msgText) return;
            setSubmitting(true);
            sendAdminMessage(msgUserId, msgText, (ok, result) => {
              setSubmitting(false);
              if (ok) {
                setResp(t`Message sent successfully`);
                setMsgUserId('');
                setMsgText('');
              } else {
                setResp(typeof result === 'string' ? result : t`Failed to send message`);
              }
            });
          }}
        >
          {submitting ? '...' : t`Send Message`}
        </button>
        <p style={{ fontSize: '0.8em', color: '#888' }}>
          {t`Limit: 5 messages per user per day`}
        </p>
        <br />
        <div className="modaldivider" />

        <AdminBadgeManager />
      </div>
    </div>
  );
}

export default React.memo(Admintools);
