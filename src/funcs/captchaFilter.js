function parsePathCommands(d) {
  const commands = [];
  const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;
  while ((match = regex.exec(d)) !== null) {
    const cmd = match[1];
    const args = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    commands.push({ cmd, args });
  }
  return commands;
}

function commandsToPath(commands) {
  return commands.map(({ cmd, args }) => cmd + args.join(' ')).join(' ');
}

function getBoundingBox(commands) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let
    maxY = -Infinity;
  let x = 0; let
    y = 0;
  for (const { cmd, args } of commands) {
    switch (cmd) {
      case 'M':
      case 'L':
        x = args[0]; y = args[1];
        break;
      case 'm':
      case 'l':
        x += args[0]; y += args[1];
        break;
      case 'H':
        x = args[0];
        break;
      case 'h':
        x += args[0];
        break;
      case 'V':
        y = args[0];
        break;
      case 'v':
        y += args[0];
        break;
      case 'C':
        x = args[4]; y = args[5];
        break;
      case 'c':
        x += args[4]; y += args[5];
        break;
      case 'Q':
        x = args[2]; y = args[3];
        break;
      case 'q':
        x += args[2]; y += args[3];
        break;
      default:
        break;
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function rotatePoint(px, py, cx, cy, angle) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function rotateCommands(commands, cx, cy, angle) {
  let x = 0; let
    y = 0;
  return commands.map(({ cmd, args }) => {
    const newArgs = [...args];
    switch (cmd) {
      case 'M':
      case 'L': {
        const [nx, ny] = rotatePoint(args[0], args[1], cx, cy, angle);
        newArgs[0] = nx; newArgs[1] = ny;
        x = args[0]; y = args[1];
        break;
      }
      case 'C': {
        const [nx1, ny1] = rotatePoint(args[0], args[1], cx, cy, angle);
        const [nx2, ny2] = rotatePoint(args[2], args[3], cx, cy, angle);
        const [nx3, ny3] = rotatePoint(args[4], args[5], cx, cy, angle);
        newArgs[0] = nx1; newArgs[1] = ny1;
        newArgs[2] = nx2; newArgs[3] = ny2;
        newArgs[4] = nx3; newArgs[5] = ny3;
        x = args[4]; y = args[5];
        break;
      }
      case 'Q': {
        const [nx1, ny1] = rotatePoint(args[0], args[1], cx, cy, angle);
        const [nx2, ny2] = rotatePoint(args[2], args[3], cx, cy, angle);
        newArgs[0] = nx1; newArgs[1] = ny1;
        newArgs[2] = nx2; newArgs[3] = ny2;
        x = args[2]; y = args[3];
        break;
      }
      case 'H': {
        const [nx, ny] = rotatePoint(args[0], y, cx, cy, angle);
        newArgs[0] = nx;
        x = args[0];
        break;
      }
      case 'V': {
        const [nx, ny] = rotatePoint(x, args[0], cx, cy, angle);
        newArgs[0] = ny;
        y = args[0];
        break;
      }
      default:
        break;
    }
    return { cmd, args: newArgs };
  });
}

function sliceAndRotatePath(pathData, sliceCount, rotationRange) {
  const commands = parsePathCommands(pathData);
  if (commands.length < 2) return pathData;

  const bbox = getBoundingBox(commands);
  const sliceSize = Math.ceil(commands.length / sliceCount);
  const slices = [];

  for (let i = 0; i < commands.length; i += sliceSize) {
    slices.push(commands.slice(i, i + sliceSize));
  }

  const transformedSlices = slices.map((slice, idx) => {
    if (slice.length === 0) return [];
    const angle = (Math.random() - 0.5) * rotationRange;
    return rotateCommands(slice, bbox.cx, bbox.cy, angle);
  });

  return commandsToPath(transformedSlices.flat());
}

function addWaveDistortion(pathData, amplitude, frequency) {
  const commands = parsePathCommands(pathData);
  let x = 0; let
    y = 0;

  const distorted = commands.map(({ cmd, args }) => {
    const newArgs = [...args];
    switch (cmd) {
      case 'M':
      case 'L': {
        const wave = Math.sin(args[0] * frequency) * amplitude;
        newArgs[1] = args[1] + wave;
        x = args[0]; y = args[1];
        break;
      }
      case 'C': {
        newArgs[1] = args[1] + Math.sin(args[0] * frequency) * amplitude;
        newArgs[3] = args[3] + Math.sin(args[2] * frequency) * amplitude;
        newArgs[5] = args[5] + Math.sin(args[4] * frequency) * amplitude;
        x = args[4]; y = args[5];
        break;
      }
      case 'Q': {
        newArgs[1] = args[1] + Math.sin(args[0] * frequency) * amplitude;
        newArgs[3] = args[3] + Math.sin(args[2] * frequency) * amplitude;
        x = args[2]; y = args[3];
        break;
      }
      default:
        break;
    }
    return { cmd, args: newArgs };
  });

  return commandsToPath(distorted);
}

function addJitter(pathData, jitterAmount) {
  const commands = parsePathCommands(pathData);

  const jittered = commands.map(({ cmd, args }) => {
    const newArgs = args.map((val, idx) => {
      if (cmd === 'Z' || cmd === 'z') return val;
      return val + (Math.random() - 0.5) * jitterAmount;
    });
    return { cmd, args: newArgs };
  });

  return commandsToPath(jittered);
}

function filter(paths) {
  console.log('CAPTCHA_FILTER:', typeof paths, Array.isArray(paths), JSON.stringify(paths).slice(0, 500));
  if (!Array.isArray(paths)) {
    return paths;
  }

  return paths.map((pathData, letterIndex) => {
    console.log('CAPTCHA_FILTER_ITEM:', letterIndex, typeof pathData, String(pathData).slice(0, 100));
    if (!pathData || typeof pathData !== 'string') {
      return pathData;
    }

    let d = pathData;

    const isCompleteReveal = Math.random() < 0.15;

    if (isCompleteReveal) {
      d = addJitter(d, 2);
    } else {
      const sliceCount = 3 + Math.floor(Math.random() * 3);
      const rotationRange = 25 + Math.random() * 35;
      d = sliceAndRotatePath(d, sliceCount, rotationRange);

      const waveAmplitude = 3 + Math.random() * 5;
      const waveFrequency = 0.02 + Math.random() * 0.03;
      d = addWaveDistortion(d, waveAmplitude, waveFrequency);

      d = addJitter(d, 1.5 + Math.random() * 2);
    }

    return d;
  });
}

module.exports = filter;
