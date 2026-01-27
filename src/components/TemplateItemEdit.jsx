/**
 * Item for list of Tamplates
 */

import React, {
  useRef, useState, useEffect, useMemo, useCallback,
} from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import templateLoader from '../ui/templateLoader.js';
import { coordsFromString } from '../core/utils.js';
import { setTemplateMoveMode } from '../store/actions/templates.js';

const TemplateItemEdit = ({
  title: initTitle,
  canvasId: initCanvasId,
  x: initX, y: initY,
  imageId,
  stopEditing,
}) => {
  const dispatch = useDispatch();
  const [initCoords] = useMemo(() => [
    (Number.isNaN(parseInt(initX, 10))
      || Number.isNaN(parseInt(initY, 10))) ? null : [initX, initY],
  ], [initX, initY]);

  const [coords, setCoords] = useState(initCoords);
  const [dimensions, setDimensions] = useState(null);
  const [title, setTitle] = useState(initTitle || '');
  const [file, setFile] = useState(null);
  const [titleUnique, setTitleUnique] = useState(true);
  const savedStateRef = useRef(null);
  const coordsInputRef = useRef();
  const imgRef = useRef();
  const fileRef = useRef();
  const [
    storeCanvasId,
    canvases,
    templateList,
    showMvmCtrls,
    moveMode,
  ] = useSelector((state) => [
    state.canvas.canvasId,
    state.canvas.canvases,
    state.templates.list,
    state.gui.showMvmCtrls,
    state.templates.moveMode,
  ], shallowEqual);
  const [canvasId, selectCanvas] = useState(initCanvasId ?? storeCanvasId);

  const moveActive = initTitle && moveMode?.title === initTitle;

  const currentTemplate = useMemo(() => {
    if (!initTitle) return null;
    return templateList.find((tmp) => tmp.title === initTitle);
  }, [initTitle, templateList]);

  const enableMoveMode = useCallback(() => {
    if (!initTitle || !currentTemplate) return;
    savedStateRef.current = {
      showMvmCtrls,
      coords: [currentTemplate.x, currentTemplate.y],
    };
    dispatch(setTemplateMoveMode({
      title: initTitle,
      imageId,
      canvasId,
    }));
  }, [initTitle, currentTemplate, showMvmCtrls, imageId, canvasId, dispatch]);

  const disableMoveMode = useCallback(() => {
    if (currentTemplate) {
      setCoords([currentTemplate.x, currentTemplate.y]);
      if (coordsInputRef.current) {
        coordsInputRef.current.value = `${currentTemplate.x}_${currentTemplate.y}`;
      }
    }
    dispatch(setTemplateMoveMode(null));
    savedStateRef.current = null;
  }, [currentTemplate, dispatch]);

  useEffect(() => {
    if (!moveMode && currentTemplate && coordsInputRef.current) {
      coordsInputRef.current.value = `${currentTemplate.x}_${currentTemplate.y}`;
      setCoords([currentTemplate.x, currentTemplate.y]);
    }
  }, [moveMode, currentTemplate]);


  useEffect(() => {
    (async () => {
      if (!imageId || !imgRef.current) {
        return;
      }
      const previewImg = await templateLoader.getTemplate(imageId);
      if (!previewImg) {
        return;
      }
      const bitmap = await createImageBitmap(previewImg);
      const canvas = imgRef.current;
      const { width, height } = bitmap;
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('bitmaprenderer').transferFromImageBitmap(bitmap);
      setDimensions([width, height]);
      bitmap.close();
    })();
  }, [imageId]);

  useEffect(() => {
    if (!file || !imgRef.current) {
      return;
    }
    (async () => {
      const bitmap = await createImageBitmap(file);
      const canvas = imgRef.current;
      const { width, height } = bitmap;
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('bitmaprenderer').transferFromImageBitmap(bitmap);
      setDimensions([width, height]);
      bitmap.close();
    })();
  }, [file]);

  const canSubmit = (imgRef.current && (file || imageId)
    && titleUnique && coords && title && dimensions);

  return (
    <div className="tmpitm">
      <div className="tmpitm-preview">
        <div style={{ width: '100%', height: '100%' }}>
          <canvas
            className="tmpitm-img"
            ref={imgRef}
            key="editimg"
            style={{ opacity: 0.4 }}
          />
        </div>
        <div
          className="centered-on-img modallink"
          onClick={() => fileRef.current?.click()}
        >{t`Select File`}</div>
        <input
          type="file"
          key="hinpt"
          accept="image/*"
          ref={fileRef}
          style={{ display: 'none' }}
          onChange={(evt) => {
            setDimensions(null);
            setFile(evt.target.files?.[0]);
          }}
        />
      </div>
      <div className="tmpitm-desc">
        <h4><input
          value={title}
          style={{ width: '10em' }}
          type="text"
          onChange={(evt) => {
            const newTitle = evt.target.value;
            setTitleUnique(!templateList.some((z) => z.title === newTitle));
            setTitle(evt.target.value);
          }}
          placeholder={t`Template Name`}
        /></h4>
        <p>{t`Canvas`}:&nbsp;
          <span><select
            value={canvasId}
            onChange={(e) => {
              const sel = e.target;
              selectCanvas(sel.options[sel.selectedIndex].value);
            }}
          >
            {Object.keys(canvases)
              .filter((c) => !canvases[c].v && !canvases[c].ed)
              .map((canvas) => (
                <option key={canvas} value={canvas}>
                  {canvases[canvas].title}
                </option>
              ),
              )}
          </select></span>
        </p>
        <p>
          {t`Coordinates`}:&nbsp;
          <span><input
            type="text"
            ref={coordsInputRef}
            defaultValue={coords && coords.join('_')}
            style={{
              display: 'inline-block',
              maxWidth: '8em',
            }}
            placeholder="X_Y or URL"
            onChange={(evt) => {
              const co = coordsFromString(evt.target.value.trim());
              if (co) {
                evt.target.value = co.join('_');
              }
              setCoords(co);
            }}
          /></span>
        </p>
        <p>
          {t`Dimensions`}:&nbsp;<span>
            {(dimensions) ? dimensions.join(' x ') : 'N/A'}
          </span>
        </p>
      </div>
      <div className="tmpitm-actions">
        {(initTitle && !moveActive) && (
          <button
            onClick={enableMoveMode}
            type="button"
          >
            {t`Move`}
          </button>
        )}
        {(moveActive) && (
          <button
            onClick={disableMoveMode}
            type="button"
          >
            {t`Done`}
          </button>
        )}
        {(initTitle && !moveActive) && (
          <button
            onClick={() => {
              stopEditing(initTitle);
              templateLoader.deleteTemplate(initTitle);
            }}
            type="button"
          >
            {t`Delete`}
          </button>
        )}
        {(!moveActive) && (
          <button
            onClick={() => stopEditing(title)}
            type="button"
          >
            {t`Cancel`}
          </button>
        )}
        {(!moveActive) && (
          <button
            disabled={!canSubmit}
            onClick={async () => {
              if (!canSubmit) {
                return;
              }
              const [x, y] = coords;
              if (!initTitle) {
                await templateLoader.addFile(file, title, canvasId, x, y);
              } else {
                if (file && imageId) {
                  await templateLoader.updateFile(imageId, file);
                }
                if (initTitle
                  && (initTitle !== title || initX !== x
                  || initY !== y || initCanvasId !== canvasId
                  )) {
                  templateLoader.changeTemplate(initTitle, {
                    title, canvasId, x, y,
                  });
                }
              }
              stopEditing(initTitle);
            }}
            type="button"
          >
            {t`Save`}
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(TemplateItemEdit);
