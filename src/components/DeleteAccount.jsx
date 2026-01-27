/*
 * Change Password Form
 */

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { validatePassword } from '../utils/validation.js';
import { requestDeleteAccount } from '../store/actions/fetch.js';
import { logoutUser } from '../store/actions/index.js';

function validate(havePassword, password) {
  const errors = [];
  if (!havePassword) {
    return errors;
  }

  const passworderror = validatePassword(password);
  if (passworderror) errors.push(passworderror);

  return errors;
}

const DeleteAccount = ({ done }) => {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const havePassword = useSelector((state) => state.user.havePassword);
  const dispatch = useDispatch();

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }

    const valErrors = validate(havePassword, password);
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors } = await requestDeleteAccount(password);
    setSubmitting(false);
    if (respErrors) {
      setErrors(respErrors);
      return;
    }
    dispatch(logoutUser());
  };

  return (
    <div className="inarea" style={{ backgroundColor: '#ff6666' }}>
      <form onSubmit={handleSubmit}>
        {errors.map((error) => (
          <p key={error} className="errormessage"><span>{t`Error`}</span>
            :&nbsp;{error}</p>
        ))}
        {(havePassword)
        && (
          <React.Fragment key="pass">
            <input
              value={password}
              onChange={(evt) => setPassword(evt.target.value)}
              type="password"
              placeholder={t`Password`}
            />
            <br />
          </React.Fragment>
        )}
        <button type="submit">
          {(submitting) ? '...' : t`Yes, Delete My Account!`}
        </button>
        <button type="button" onClick={done}>{t`Cancel`}</button>
      </form>
    </div>
  );
};

export default React.memo(DeleteAccount);
