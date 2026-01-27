import React from 'react';
import { t } from 'ttag';

const RefreshPrompt = ({ close }) => (
  <>
    <button
      type="button"
      style={{
        fontWeight: 'bold',
        animation: 'glowing 1300ms infinite',
      }}
      onClick={() => window.location.reload()}
    >
      {t`Refresh`}
    </button>&nbsp;
    <button type="submit" onClick={close}>{t`Cancel`}</button>
  </>
);

export default React.memo(RefreshPrompt);
