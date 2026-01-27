/*
 * Admintools
 */

/* eslint-disable max-len */

import React, { useState } from 'react';
import { t } from 'ttag';

import { parseInterval } from '../core/utils.js';
import { api, cdn } from '../utils/utag.js';

async function submitIIDAction(
  action,
  iid,
  bid,
  iidoruser,
  identifierList,
  reason,
  duration,
  username,
) {
  const data = new FormData();
  data.append('iidaction', action);
  switch (action) {
    case 'givecaptcha':
    case 'whitelist':
    case 'unwhitelist': {
      if (!iid) {
        return t`You must enter an IID`;
      }
      data.append('iid', iid);
      break;
    }
    case 'baninfo': {
      if (!bid) {
        return t`You must enter an BID`;
      }
      data.append('bid', bid);
      break;
    }
    case 'searchalts':
    case 'status': {
      if (!iidoruser) {
        return t`You must enter an IID or UserId`;
      }
      data.append('iidoruser', iidoruser);
      break;
    }
    case 'flagbyID': {
      if (!iidoruser) {
        return { error: t`You must enter an IID or UserId or Name` };
      }
      const flagData = new FormData();
      flagData.append('watchaction', 'flagbyID');
      flagData.append('canvasid', '0');
      flagData.append('time', Date.now() - 86400000);
      flagData.append('iidoruser', iidoruser);
      const flagResp = await fetch(api`/api/modtools`, {
        credentials: 'include',
        method: 'POST',
        body: flagData,
      });
      const result = await flagResp.json();
      if (typeof result === 'string') {
        return { error: result };
      }
      if (result.rows && result.rows.length > 0) {
        return { flags: result.rows.map((row) => row[1]), users: result.users || [], info: result.info };
      }
      return { error: result.info || 'No countries found' };
    }
    case 'changeusername': {
      if (!iidoruser) {
        return t`You must enter a UserId`;
      }
      if (!username) {
        return t`You must enter a username`;
      }
      data.append('iidoruser', iidoruser);
      data.append('username', username);
      break;
    }
    case 'ban': {
      const time = parseInterval(duration);
      if (time === 0 && duration !== '0') {
        return t`You must enter a duration`;
      }
      if (!reason) {
        return t`You must enter a reason`;
      }
      data.append('reason', reason);
      data.append('time', time);
      // fall through
    }
    case 'unban': {
      if (!identifierList) {
        return t`You must enter at least one IID, User Id or BID`;
      }
      data.append('identifiers', identifierList);
      break;
    }
    default:
      // nothing
  }
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  return resp.text();
}

function ModIIDtools() {
  const [iIDAction, selectIIDAction] = useState('status');
  const [iid, selectIid] = useState('');
  const [bid, selectBid] = useState('');
  const [iidOrUser, selectIidOrUser] = useState('');
  const [identifierList, setIdentifierList] = useState('');
  const [reason, setReason] = useState('');
  const [username, setUsername] = useState('');
  const [duration, setDuration] = useState('1d');
  const [resp, setResp] = useState('');
  const [flags, setFlags] = useState([]);
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={{ textAlign: 'center', paddingLeft: '5%', paddingRight: '5%' }}>
      <form
        onSubmit={async (evt) => {
          evt.preventDefault();
          if (submitting) {
            return;
          }
          setSubmitting(true);
          setFlags([]);
          setUsers([]);
          const ret = await submitIIDAction(
            iIDAction, iid, bid, iidOrUser, identifierList,
            reason, duration, username,
          );
          setSubmitting(false);
          if (typeof ret === 'object' && ret !== null) {
            if (ret.flags) {
              setFlags(ret.flags);
              setUsers(ret.users || []);
              setResp(ret.info || '');
            } else if (ret.error) {
              setResp(ret.error);
            }
          } else {
            setResp(ret);
          }
        }}
      >
        <h3>{t`IID Actions`}</h3>
        <select
          value={iIDAction}
          onChange={(e) => {
            const sel = e.target;
            selectIIDAction(sel.options[sel.selectedIndex].value);
          }}
        >
          {[
            'status', 'baninfo', 'ban', 'unban',
            'whitelist', 'unwhitelist',
            'givecaptcha', 'changeusername', 'searchalts', 'flagbyID',
          ].map((opt) => (
            <option
              key={opt}
              value={opt}
            >
              {opt}
            </option>
          ))}
        </select>
        {(iIDAction === 'ban') && (
          <React.Fragment key="ban">
            <p>{t`Reason`}</p>
            <input
              maxLength="200"
              style={{
                width: '100%',
              }}
              value={reason}
              placeholder={t`Enter Reason`}
              onChange={(evt) => setReason(evt.target.value)}
            />
            <p>
              {`${t`Duration`}: `}
              <input
                style={{
                  display: 'inline-block',
                  width: '100%',
                  maxWidth: '7em',
                }}
                value={duration}
                placeholder="1d"
                onChange={(evt) => {
                  setDuration(evt.target.value.trim());
                }}
              />
              {t`(0 = infinite)`}
            </p>
          </React.Fragment>
        )}
        {(iIDAction === 'whitelist' || iIDAction === 'unwhitelist' || iIDAction === 'givecaptcha' || iIDAction === 'ipstatus') && (
          <p key="iidactions">
            IID:&nbsp;
            <input
              value={iid}
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '37em',
              }}
              type="text"
              placeholder="xxxx-xxxxx-xxxx"
              onChange={(evt) => {
                selectIid(evt.target.value.trim());
              }}
            />
          </p>
        )}
        {(iIDAction === 'baninfo') && (
          <p key="baninfo">
            BID:&nbsp;
            <input
              value={bid}
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '37em',
              }}
              type="text"
              placeholder="xxxx-xxxxx-xxxx"
              onChange={(evt) => {
                selectBid(evt.target.value.trim());
              }}
            />
          </p>
        )}
        {(iIDAction === 'status' || iIDAction === 'searchalts' || iIDAction === 'flagbyID') && (
          <p key="status">
            IID or UserID or Name:&nbsp;
            <input
              value={iidOrUser}
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '37em',
              }}
              type="text"
              placeholder="xxxx-xxxxx-xxxx or UserID or Name"
              onChange={(evt) => {
                selectIidOrUser(evt.target.value.trim());
              }}
            />
          </p>
        )}
        {(iIDAction === 'changeusername') && (
          <React.Fragment key="changeusername">
            <p>
              UserID or Name:
              <input
                value={iidOrUser}
                style={{
                  display: 'inline-block',
                  width: '100%',
                  maxWidth: '37em',
                }}
                type="text"
                onChange={(evt) => {
                  selectIidOrUser(evt.target.value.trim());
                }}
              />
            </p>
            <p>{t`Username`}</p>
            <input
              maxLength="200"
              style={{
                width: '100%',
              }}
              value={username}
              placeholder={t`Enter Reason`}
              onChange={(evt) => setUsername(evt.target.value)}
            />
          </React.Fragment>
        )}
        {(iIDAction === 'ban' || iIDAction === 'unban') && (
          <p key="banunban">
            IID, UID or BID:
            <br />
            <textarea
              style={{
                width: '100%',
                maxWidth: '37em',
              }}
              rows="10"
              cols="17"
              value={identifierList}
              onChange={(e) => setIdentifierList(e.target.value)}
            />
          </p>
        )}
        <p>
          <button type="submit">
            {(submitting) ? '...' : t`Submit`}
          </button>
        </p>
      </form>
      {flags.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <p>{resp}</p>
          {users.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <strong>Users:</strong>
              <div style={{ marginTop: '5px' }}>
                {users.map((user) => (
                  <div key={user.id} style={{ marginBottom: '3px' }}>
                    {user.name && <span><strong>Name:</strong> {user.name} </span>}
                    {user.username && <span><strong>Username:</strong> {user.username} </span>}
                    <span><strong>ID:</strong> {user.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: '10px' }}>
            <strong>Countries:</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginTop: '5px' }}>
            {flags.map((flag) => (
              <img
                key={flag}
                style={{
                  height: '2em',
                  imageRendering: 'crisp-edges',
                }}
                alt={flag.toUpperCase()}
                title={flag.toUpperCase()}
                src={cdn`/cf/${flag}.gif`}
              />
            ))}
          </div>
        </div>
      )}
      {(flags.length === 0 || iIDAction !== 'flagbyID') && (
        <textarea
          style={{
            width: '100%',
          }}
          rows={(resp) ? resp.split('\n').length : 10}
          value={resp}
          readOnly
        />
      )}
    </div>
  );
}

export default React.memo(ModIIDtools);
