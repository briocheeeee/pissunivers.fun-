/**
 *
 * http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
 *
 */

import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { PORT } from './config.js';

export const PIXELLOGGER_PREFIX = `./log/pixels-${PORT}-`;
const PROXYLOGGER_PREFIX = `./log/proxycheck-${PORT}-`;
const MODTOOLLOGGER_PREFIX = `./log/moderation/modtools-${PORT}-`;

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.splat(),
    format.simple(),
  ),
  transports: [
    new transports.Console(),
  ],
});

export const pixelLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      filename: `${PIXELLOGGER_PREFIX}%DATE%.log`,
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

export const proxyLogger = createLogger({
  format: format.combine(
    format.splat(),
    format.simple(),
  ),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${PROXYLOGGER_PREFIX}%DATE%.log`,
      maxsize: '10m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

export const modtoolsLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${MODTOOLLOGGER_PREFIX}%DATE%.log`,
      maxSize: '20m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});



export default logger;
