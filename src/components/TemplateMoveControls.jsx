import React, {
  useState, useCallback, useEffect, useRef,
} from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import {
  PiArrowFatLeft,
  PiArrowFatRight,
  PiArrowFatUp,
  PiArrowFatDown,
  PiCursorClick,
  PiCheck,
} from 'react-icons/pi';

import { changeTemplate, setTemplateMoveMode } from '../store/actions/templates.js';
import { getRenderer } from '../ui/rendererFactory.js';

const LONG_PRESS_DELAY = 250;
const ACCELERATION_INTERVAL = 50;
const MAX_SPEED = 8;

const TemplateMoveControls = () => {
  const dispatch = useDispatch();
  const moveMode = useSelector((state) => state.templates.moveMode, shallowEqual);
  const canvasSize = useSelector((state) => state.canvas.canvasSize);
  const templateList = useSelector((state) => state.templates.list);

  const [mouseMode, setMouseMode] = useState(false);
  const [render, setRender] = useState(false);

  const pressTimerRef = useRef(null);
  const intervalRef = useRef(null);
  const speedRef = useRef(1);
  const directionRef = useRef({ dx: 0, dy: 0 });
  const moveModeRef = useRef(moveMode);
  const templateListRef = useRef(templateList);
  const canvasSizeRef = useRef(canvasSize);

  const open = !!moveMode;

  useEffect(() => {
    moveModeRef.current = moveMode;
  }, [moveMode]);

  useEffect(() => {
    templateListRef.current = templateList;
  }, [templateList]);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => setRender(true), 10);
    }
  }, [open]);

  const getTemplateFromRef = useCallback(() => {
    const mm = moveModeRef.current;
    if (!mm) return null;
    return templateListRef.current.find((tmp) => tmp.title === mm.title);
  }, []);

  const moveTemplateByDelta = useCallback((dx, dy) => {
    const template = getTemplateFromRef();
    if (!template) return;

    const halfCanvas = canvasSizeRef.current / 2;
    let newX = template.x + dx;
    let newY = template.y + dy;

    newX = Math.max(-halfCanvas, Math.min(halfCanvas - template.width, newX));
    newY = Math.max(-halfCanvas, Math.min(halfCanvas - template.height, newY));

    dispatch(changeTemplate(template.title, { x: newX, y: newY }));
  }, [getTemplateFromRef, dispatch]);

  const startContinuousMove = useCallback((dx, dy) => {
    directionRef.current = { dx, dy };
    speedRef.current = 1;
    pressTimerRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        speedRef.current = Math.min(speedRef.current + 0.5, MAX_SPEED);
        const { dx: cdx, dy: cdy } = directionRef.current;
        moveTemplateByDelta(cdx * Math.floor(speedRef.current), cdy * Math.floor(speedRef.current));
      }, ACCELERATION_INTERVAL);
    }, LONG_PRESS_DELAY);
  }, [moveTemplateByDelta]);

  const stopContinuousMove = useCallback(() => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    speedRef.current = 1;
  }, []);

  const handlePressStart = useCallback((direction) => (event) => {
    event.preventDefault();
    let dx = 0;
    let dy = 0;
    switch (direction) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
      default: break;
    }
    moveTemplateByDelta(dx, dy);
    startContinuousMove(dx, dy);
  }, [moveTemplateByDelta, startContinuousMove]);

  const handlePressEnd = useCallback((event) => {
    event.preventDefault();
    stopContinuousMove();
  }, [stopContinuousMove]);

  const handleMouseModeClick = useCallback(() => {
    if (!moveMode) return;
    setMouseMode(true);
    dispatch(setTemplateMoveMode({
      ...moveMode,
      mouseActive: true,
    }));
  }, [moveMode, dispatch]);

  const handleDoneClick = useCallback(() => {
    stopContinuousMove();
    setMouseMode(false);
    dispatch(setTemplateMoveMode(null));
  }, [stopContinuousMove, dispatch]);

  useEffect(() => {
    if (!mouseMode || !moveMode) return undefined;

    const template = getTemplateFromRef();
    if (!template) return undefined;

    const halfCanvas = canvasSizeRef.current / 2;

    const handleMouseMove = (event) => {
      const renderer = getRenderer();
      if (!renderer) return;

      const viewport = renderer.getViewport();
      if (!viewport) return;

      const [x, y, scale] = renderer.view;

      const mouseCanvasX = (event.clientX - viewport.width / 2) / scale + x;
      const mouseCanvasY = (event.clientY - viewport.height / 2) / scale + y;

      const currentTemplate = getTemplateFromRef();
      if (!currentTemplate) return;

      let newX = Math.round(mouseCanvasX);
      let newY = Math.round(mouseCanvasY);

      newX = Math.max(-halfCanvas, Math.min(halfCanvas - currentTemplate.width, newX));
      newY = Math.max(-halfCanvas, Math.min(halfCanvas - currentTemplate.height, newY));

      dispatch(changeTemplate(currentTemplate.title, { x: newX, y: newY }));
    };

    const handleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMouseMode(false);
      dispatch(setTemplateMoveMode({
        ...moveModeRef.current,
        mouseActive: false,
      }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick, true);
    };
  }, [mouseMode, moveMode, getTemplateFromRef, dispatch]);

  useEffect(() => () => {
    stopContinuousMove();
  }, [stopContinuousMove]);

  if (!render && !open) return null;

  return (
    <div
      id="templatemvmctrls"
      className={render && open ? 'show' : ''}
      onTransitionEnd={() => !open && setRender(false)}
    >
      <div
        className="actionbuttons tmpmvmbtn tmpmvmbtn-done"
        role="button"
        tabIndex={0}
        style={{
          left: 16,
          bottom: 139,
        }}
        onClick={handleDoneClick}
      >
        <PiCheck />
      </div>
      <div
        className="actionbuttons tmpmvmbtn"
        role="button"
        tabIndex={0}
        style={{
          left: 57,
          bottom: 139,
        }}
        onMouseDown={handlePressStart('up')}
        onTouchStart={handlePressStart('up')}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        <PiArrowFatUp />
      </div>
      <div
        className="actionbuttons tmpmvmbtn"
        role="button"
        tabIndex={0}
        style={{
          left: 98,
          bottom: 139,
        }}
        onClick={handleMouseModeClick}
      >
        <PiCursorClick />
      </div>
      <div
        className="actionbuttons tmpmvmbtn"
        role="button"
        tabIndex={0}
        style={{
          left: 16,
          bottom: 98,
        }}
        onMouseDown={handlePressStart('left')}
        onTouchStart={handlePressStart('left')}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        <PiArrowFatLeft />
      </div>
      <div
        className="actionbuttons tmpmvmbtn"
        role="button"
        tabIndex={0}
        style={{
          left: 57,
          bottom: 98,
        }}
        onMouseDown={handlePressStart('down')}
        onTouchStart={handlePressStart('down')}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        <PiArrowFatDown />
      </div>
      <div
        className="actionbuttons tmpmvmbtn"
        role="button"
        tabIndex={0}
        style={{
          left: 98,
          bottom: 98,
        }}
        onMouseDown={handlePressStart('right')}
        onTouchStart={handlePressStart('right')}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        <PiArrowFatRight />
      </div>
    </div>
  );
};

export default TemplateMoveControls;
