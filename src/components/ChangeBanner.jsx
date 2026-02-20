import React, { useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import { requestUploadBanner } from '../store/actions/fetch.js';
import { setBanner } from '../store/actions/index.js';

const ChangeBanner = ({ done }) => {
  const dispatch = useDispatch();
  const currentBanner = useSelector((state) => state.user.banner);
  const [preview, setPreview] = useState(currentBanner);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t`Please select an image file`);
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError(t`Image must be less than 4MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!preview || preview === currentBanner) {
      done();
      return;
    }

    setUploading(true);
    setError(null);

    const result = await requestUploadBanner(preview);

    if (result.errors) {
      setError(result.errors[0]);
      setUploading(false);
      return;
    }

    dispatch(setBanner(result.banner));
    setUploading(false);
    done();
  }, [preview, currentBanner, dispatch, done]);

  const handleRemove = useCallback(async () => {
    setUploading(true);
    setError(null);

    const result = await requestUploadBanner(null);

    if (result.errors) {
      setError(result.errors[0]);
      setUploading(false);
      return;
    }

    dispatch(setBanner(null));
    setPreview(null);
    setUploading(false);
  }, [dispatch]);

  return (
    <div className="inarea">
      <div className="banner-upload-container">
        <div className="banner-preview-wrap">
          {preview ? (
            <img src={preview} alt="Banner" className="banner-preview-img" />
          ) : (
            <div className="banner-preview-placeholder">{t`No banner`}</div>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div className="avatar-actions">
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
          >
            {t`Select Image`}
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
            >
              {t`Remove`}
            </button>
          )}
        </div>
      </div>
      {error && <p className="errormessage">{error}</p>}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? t`Uploading...` : t`Save`}
        </button>
        <button
          type="button"
          onClick={done}
          disabled={uploading}
          style={{ marginLeft: 8 }}
        >
          {t`Cancel`}
        </button>
      </div>
    </div>
  );
};

export default ChangeBanner;
