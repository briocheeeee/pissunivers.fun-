import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import { requestUpdateDescription } from '../store/actions/fetch.js';
import { setDescription } from '../store/actions/index.js';

const MAX_LENGTH = 200;

const ChangeDescription = ({ done }) => {
  const dispatch = useDispatch();
  const currentDescription = useSelector((state) => state.user.description);
  const [value, setValue] = useState(currentDescription || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    const result = await requestUpdateDescription(value.trim() || null);

    if (result.errors) {
      setError(result.errors[0]);
      setSaving(false);
      return;
    }

    dispatch(setDescription(result.description));
    setSaving(false);
    done();
  }, [value, dispatch, done]);

  return (
    <div className="inarea">
      <div style={{ padding: '8px 0' }}>
        <textarea
          className="description-textarea"
          value={value}
          maxLength={MAX_LENGTH}
          rows={4}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t`Write something about yourself...`}
          style={{
            width: '100%',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            fontSize: 14,
            padding: 6,
          }}
        />
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
          {value.length}/{MAX_LENGTH}
        </div>
      </div>
      {error && <p className="errormessage">{error}</p>}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t`Saving...` : t`Save`}
        </button>
        <button
          type="button"
          onClick={done}
          disabled={saving}
        >
          {t`Cancel`}
        </button>
      </div>
    </div>
  );
};

export default ChangeDescription;
