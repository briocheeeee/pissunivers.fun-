/*
 * worker thread for creating Captchas
 */

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';
import ppfunCaptcha from 'ppfun-captcha';
import { isMainThread, parentPort } from 'worker_threads';

import { getRandomString } from '../core/utils.js';

const FONT_FOLDER = path.resolve(__dirname, '..', 'captchaFonts');

if (isMainThread) {
  throw new Error(
    'CaptchaLoader is run as a worker thread, not as own process',
  );
}

let font;

function setCaptchaFonts(fontFilenames) {
  let newFont = fontFilenames
    .map((f) => path.join(FONT_FOLDER, f))
    .filter((f) => fs.existsSync(f));
  if (!newFont.length) {
    newFont = fs.readdirSync(FONT_FOLDER)
      .filter((e) => e.endsWith('.ttf') || e.endsWith('.otf'))
      .slice(0, 3)
      .map((f) => path.join(FONT_FOLDER, f));
  }
  font = newFont.map((f) => ppfunCaptcha.loadFont(f));
  console.info(`CAPTCHAS: change fonts to ${newFont.map((f) => f.slice(-15)).join(',')}`);
}

function generateSvgDefs(width, height) {
  const filterId = `f${Math.random().toString(36).slice(2, 8)}`;
  const gradientId = `g${Math.random().toString(36).slice(2, 8)}`;
  const maskId = `m${Math.random().toString(36).slice(2, 8)}`;
  const noiseId = `n${Math.random().toString(36).slice(2, 8)}`;

  return {
    ids: { filterId, gradientId, maskId, noiseId },
    defs: `<defs>
      <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.01"/>
        <stop offset="50%" style="stop-color:rgb(0,0,0);stop-opacity:0.03"/>
        <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.01"/>
      </linearGradient>
      <mask id="${maskId}">
        <rect width="100%" height="100%" fill="white"/>
        <circle cx="${(width * 0.3).toFixed(1)}" cy="${(height * 0.5).toFixed(1)}" r="30" fill="black" opacity="0.1"/>
        <circle cx="${(width * 0.7).toFixed(1)}" cy="${(height * 0.5).toFixed(1)}" r="25" fill="black" opacity="0.1"/>
      </mask>
      <filter id="${noiseId}">
        <feTurbulence type="turbulence" baseFrequency="0.5" numOctaves="2" result="turbulence"/>
        <feComposite in="SourceGraphic" in2="turbulence" operator="in"/>
      </filter>
    </defs>`,
  };
}

function generateHoneypotElements(width, height) {
  const fakeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let honeypot = '';

  for (let i = 0; i < 6; i++) {
    const char = fakeChars[Math.floor(Math.random() * fakeChars.length)];
    const x = Math.random() * width;
    const y = Math.random() * height;
    honeypot += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="0" fill="transparent" aria-hidden="true" data-captcha="false">${char}</text>`;
  }

  honeypot += '<g style="position:absolute;left:-9999px;opacity:0;pointer-events:none;" aria-hidden="true">';
  for (let i = 0; i < 4; i++) {
    const fakeText = Array(6).fill(0).map(() => fakeChars[Math.floor(Math.random() * fakeChars.length)]).join('');
    honeypot += `<text x="0" y="${i * 50}" font-size="48">${fakeText}</text>`;
  }
  honeypot += '</g>';

  return honeypot;
}

function generateDecoyPaths(width, height, count) {
  let decoys = '';
  for (let i = 0; i < count; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const segments = 3 + Math.floor(Math.random() * 4);
    let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
    let cx = x1; let
      cy = y1;
    for (let s = 0; s < segments; s++) {
      const nx = cx + (Math.random() - 0.5) * 80;
      const ny = cy + (Math.random() - 0.5) * 60;
      const c1x = cx + (Math.random() - 0.5) * 40;
      const c1y = cy + (Math.random() - 0.5) * 40;
      const c2x = nx + (Math.random() - 0.5) * 40;
      const c2y = ny + (Math.random() - 0.5) * 40;
      d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
      cx = nx; cy = ny;
    }
    const opacity = 0.02 + Math.random() * 0.05;
    const strokeWidth = 2 + Math.random() * 3;
    decoys += `<path d="${d}" stroke="black" stroke-width="${strokeWidth.toFixed(1)}" fill="none" opacity="${opacity.toFixed(3)}"/>`;
  }
  return decoys;
}

function generateFragmentedFakeLetters(width, height) {
  const fakeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let fragments = '';

  for (let i = 0; i < 3; i++) {
    const char = fakeChars[Math.floor(Math.random() * fakeChars.length)];
    const x = 50 + Math.random() * (width - 100);
    const y = 80 + Math.random() * (height - 160);
    const fontSize = 100 + Math.random() * 60;
    const rotation = (Math.random() - 0.5) * 40;
    const clipId = `clip${Math.random().toString(36).slice(2, 8)}`;

    const clipX = Math.random() * 0.6;
    const clipW = 0.2 + Math.random() * 0.3;

    fragments += `<defs><clipPath id="${clipId}"><rect x="${(x - fontSize / 2 + clipX * fontSize).toFixed(1)}" y="${(y - fontSize).toFixed(1)}" width="${(clipW * fontSize).toFixed(1)}" height="${(fontSize * 1.2).toFixed(1)}"/></clipPath></defs>`;
    fragments += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontSize.toFixed(0)}" fill="rgba(0,0,0,0.025)" transform="rotate(${rotation.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" clip-path="url(#${clipId})">${char}</text>`;
  }

  return fragments;
}

function generateOverlappingShapes(width, height) {
  let shapes = '';
  const shapeCount = 12 + Math.floor(Math.random() * 8);

  for (let i = 0; i < shapeCount; i++) {
    const shapeType = Math.floor(Math.random() * 4);
    const opacity = 0.01 + Math.random() * 0.03;
    const x = Math.random() * width;
    const y = Math.random() * height;

    switch (shapeType) {
      case 0: {
        const r = 5 + Math.random() * 25;
        shapes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" stroke="black" stroke-width="1" fill="none" opacity="${opacity.toFixed(3)}"/>`;
        break;
      }
      case 1: {
        const w = 10 + Math.random() * 40;
        const h = 10 + Math.random() * 30;
        const rot = Math.random() * 360;
        shapes += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" stroke="black" stroke-width="0.8" fill="none" opacity="${opacity.toFixed(3)}" transform="rotate(${rot.toFixed(1)} ${(x + w / 2).toFixed(1)} ${(y + h / 2).toFixed(1)})"/>`;
        break;
      }
      case 2: {
        const x2 = x + (Math.random() - 0.5) * 60;
        const y2 = y + (Math.random() - 0.5) * 40;
        shapes += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="black" stroke-width="1.5" opacity="${opacity.toFixed(3)}"/>`;
        break;
      }
      case 3: {
        const points = [];
        const sides = 3 + Math.floor(Math.random() * 3);
        const r = 8 + Math.random() * 20;
        for (let p = 0; p < sides; p++) {
          const angle = (p / sides) * Math.PI * 2 + Math.random() * 0.5;
          points.push(`${(x + Math.cos(angle) * r).toFixed(1)},${(y + Math.sin(angle) * r).toFixed(1)}`);
        }
        shapes += `<polygon points="${points.join(' ')}" stroke="black" stroke-width="0.8" fill="none" opacity="${opacity.toFixed(3)}"/>`;
        break;
      }
    }
  }

  return shapes;
}

function generateNoiseTexture(width, height, ids) {
  let noise = '';
  const dotCount = 80 + Math.floor(Math.random() * 40);

  for (let i = 0; i < dotCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 0.3 + Math.random() * 1.2;
    const opacity = 0.03 + Math.random() * 0.05;
    noise += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="black" opacity="${opacity.toFixed(3)}"/>`;
  }

  return noise;
}

function generateWavyLines(width, height) {
  let lines = '';
  const lineCount = 4 + Math.floor(Math.random() * 3);

  for (let i = 0; i < lineCount; i++) {
    const startY = Math.random() * height;
    const amplitude = 5 + Math.random() * 15;
    const frequency = 0.02 + Math.random() * 0.03;
    const phase = Math.random() * Math.PI * 2;
    let d = `M0 ${startY.toFixed(1)}`;

    for (let x = 10; x <= width; x += 10) {
      const y = startY + Math.sin(x * frequency + phase) * amplitude;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    const opacity = 0.015 + Math.random() * 0.025;
    lines += `<path d="${d}" stroke="black" stroke-width="0.8" fill="none" opacity="${opacity.toFixed(3)}"/>`;
  }

  return lines;
}

function generateDataPoisoning() {
  const fakeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let poison = '';

  poison += `<!-- captcha: ${Array(6).fill(0).map(() => fakeChars[Math.floor(Math.random() * fakeChars.length)]).join('')} -->`;
  poison += `<!-- answer: ${Array(6).fill(0).map(() => fakeChars[Math.floor(Math.random() * fakeChars.length)]).join('')} -->`;
  poison += `<!-- text: ${Array(6).fill(0).map(() => fakeChars[Math.floor(Math.random() * fakeChars.length)]).join('')} -->`;

  for (let i = 0; i < 3; i++) {
    const fakeData = Array(6).fill(0).map(() => fakeChars[Math.floor(Math.random() * fakeChars.length)]).join('');
    poison += `<metadata data-text="${fakeData}" data-answer="${fakeData}" style="display:none"/>`;
  }

  return poison;
}

function addAntiBotLayers(svgData, width, height) {
  const closingTag = '</svg>';
  const insertPos = svgData.lastIndexOf(closingTag);
  if (insertPos === -1) return svgData;

  const { ids, defs } = generateSvgDefs(width, height);

  const svgOpenEnd = svgData.indexOf('>') + 1;
  const modifiedSvg = svgData.slice(0, svgOpenEnd) + defs + svgData.slice(svgOpenEnd, insertPos);

  let layers = '';
  layers += generateDataPoisoning();
  layers += generateHoneypotElements(width, height);
  layers += generateWavyLines(width, height);
  layers += generateOverlappingShapes(width, height);
  layers += generateDecoyPaths(width, height, 10 + Math.floor(Math.random() * 6));
  layers += generateFragmentedFakeLetters(width, height);
  layers += generateNoiseTexture(width, height, ids);

  return modifiedSvg + layers + closingTag;
}

function createCaptcha() {
  const captcha = ppfunCaptcha.create({
    width: 500,
    height: 300,
    fontSize: 180,
    stroke: 'black',
    fill: 'none',
    nodeDeviation: 2.5,
    connectionPathDeviation: 10.0,
    style: 'stroke-width: 4;',
    background: '#EFEFEF',
    font,
  });

  captcha.data = addAntiBotLayers(captcha.data, 500, 300);

  return captcha;
}

parentPort.on('message', (msg) => {
  try {
    if (msg === 'createCaptcha') {
      if (!font?.length) {
        throw new Error('No Fonts Loaded');
      }
      const captcha = createCaptcha();
      const captchaid = getRandomString();
      parentPort.postMessage([
        null,
        captcha.text,
        captcha.data,
        captchaid,
      ]);
      return;
    }

    const comma = msg.indexOf(',');
    if (comma === -1) {
      throw new Error('No comma');
    }
    const key = msg.slice(0, comma);
    const val = JSON.parse(msg.slice(comma + 1));
    switch (key) {
      case 'setCaptchaFonts': {
        setCaptchaFonts(val);
        break;
      }
      default:
        // nothing
    }
  } catch (error) {
    console.warn(
      // eslint-disable-next-line max-len
      `CAPTCHAS: Error on ${msg}: ${error.message}`,
    );
    parentPort.postMessage(['Failure!']);
  }
});
