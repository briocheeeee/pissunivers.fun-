/*
 * media upload API, multipart form data requests with json responses
 */
import express from 'express';
import busboy from 'busboy';
import logger from '../../core/logger.js';

import {
  storeMediaStream, isMimeTypeAllowed, mimeTypeFitsToExt, splitFilename,
} from '../../utils/media/index.js';
import { MAX_MEDIA_SIZE, MAX_UPLOAD_AMOUNT } from '../../core/constants.js';
import { hasMedia } from '../../data/sql/Media.js';

const router = express.Router();

/*
 * preflight route tells whether or not the upload is likely to succeed,
 * and if the file is already uploaded
 */
router.post('/preflight', (req, res) => {
  const { ttag: { t } } = req;
  const bb = busboy({
    headers: req.headers,
    limits: {
      fileSize: 120 * 1024,
      files: 0,
      fields: 50,
    },
  });

  const errors = [];
  const mimeTypes = [];
  const filenames = [];
  const hashes = [];
  const sizes = [];

  bb.on('field', (name, value) => {
    switch (name) {
      case 'mimeType':
        mimeTypes.push(value);
        break;
      case 'filename':
        filenames.push(value);
        break;
      case 'size':
        sizes.push(Number(value));
        break;
      case 'hash':
        hashes.push(value);
        break;
      default:
        // nothing
    }
  });

  bb.on('error', () => {
    if (res.headersSent) {
      return;
    }
    res.status(500).json({
      readyToUpload: [],
      availableFiles: {},
      errors: ['Processing failed'],
    });
  });

  bb.on('close', () => {
    if (res.headersSent) {
      return;
    }

    // eslint-disable-next-line max-len
    if (mimeTypes.length !== filenames.length || filenames.length !== hashes.length || hashes.length !== sizes.length) {
      errors.push(t`You did not provide all neccessary information`);
      return;
    }
    if (mimeTypes.length > MAX_UPLOAD_AMOUNT) {
      const amountOfFiles = mimeTypes.length;
      errors.push(
        // eslint-disable-next-line max-len
        t`Can not upload this many files at once, only 5 are allowed, you have ${amountOfFiles}`,
      );
    }

    const models = [];

    while (mimeTypes.length) {
      let fileErrors = false;
      const mimeType = mimeTypes.shift();
      const filename = filenames.shift();
      const hash = hashes.shift();
      const size = sizes.shift();

      if (size > MAX_MEDIA_SIZE) {
        const maxSizeMB = Math.floor(MAX_MEDIA_SIZE / 1024 / 10.24) / 100;
        const sizeMB = Math.floor(size / 1024 / 10.24) / 100;
        errors.push(
          // eslint-disable-next-line max-len
          t`File ${filename} has ${sizeMB} and is too large. It may only be ${maxSizeMB} MB`,
        );
        fileErrors = true;
      }
      if (!isMimeTypeAllowed(mimeType)) {
        errors.push(
          t`Mimetype ${mimeType} of file ${filename} is invalid or not allowed`,
        );
        fileErrors = true;
      } else if (!mimeTypeFitsToExt(mimeType, filename)) {
        errors.push(
          t`File ${filename} has an invalid extension`,
        );
        fileErrors = true;
      }

      if (!fileErrors) {
        const [name, extension] = splitFilename(filename);
        models.push({
          hash, name, mimeType, extension,
          originalFilename: filename,
        });
      }
    }

    hasMedia(models).then((success) => {
      if (!success) {
        errors.push(t`Server Eror`);
      }
      const readyToUpload = [];
      const availableFiles = [];
      let i = models.length;
      while (i > 0) {
        i -= 1;
        const model = models[i];
        /*
          *  [{
          *    hash, name, mimeType, extension, shortId, originalFilename,
          *  }, ... ]
          */
        if (model.shortId) {
          availableFiles.push(model);
        } else {
          readyToUpload.push(model);
        }
      }

      if (readyToUpload.length > MAX_UPLOAD_AMOUNT) {
        readyToUpload.splice(MAX_UPLOAD_AMOUNT);
      }

      const data = { readyToUpload, availableFiles };
      if (errors.length) {
        data.errors = errors;
        res.status(400);
      }
      res.json(data);
    });
  });

  req.pipe(busboy);
});

router.post('/upload', (req, res) => {
  logger.info('Media upload request received');
  const { ttag: { t } } = req;
  const bb = busboy({ headers: req.headers });

  /*
   * there might be a field with hashes given BEFORE sending files, which can
   * be used to cancel the upload if they already exist, it has the form:
   * filename=hash:mimeType;filename=hash:mimetype;...
   * If this field exists, it must contain the hashes for all files, files that
   * do not have a hash, may be dropped in that scenario.
   * Multiple files given with the same filename will be processed in order.
   */
  const hashes = [];
  /*
   * amount of files currently being read
   */
  const readingFiles = 0;
  /*
   * amount of files already read
   */
  let loadedFiles = 0;
  /*
   * whee reading the request body is done
   */
  let requestDone = false;
  /*
   * file modals
   * [{ hash, name, mimeType, extension, shortId}, ...]
   */
  const availableFiles = [];

  let ended = false;

  const finalize = (error) => {
    logger.debug('Media upload finalize');
    if (ended || (!error && (!requestDone || readingFiles > 0))) {
      return;
    }
    ended = true;

    if (error && typeof error !== 'string') {
      error = error.message;
    }

    logger.debug(`Media upload ending: ${error || 'success'}`);
    if (error && !bb.destroyed) {
      logger.debug('Destroying busboy instance');
      bb.destroy();
    }
    const data = { availableFiles };

    if (error) {
      switch (error) {
        case 'no_info':
          error = t`No file metadata given`;
          break;
        case 'unknown_type':
          error = t`MimeType or extension not known or supported`;
          break;
        case 'invalid_type':
          error = t`Invalid type of media`;
          break;
        case 'broken_file':
          error = t`File is broken`;
          break;
        case 'server_error':
          error = t`Server Eror`;
          break;
        case 'stalled':
          error = t`Request stalled`;
          break;
        case 'too_long':
          error = t`A filewas too large`;
          break;
        /*
         * according to MEDIA_BAN_REASONS in constants.js
         */
        case 'media_banned_reason_1':
          error = t`This media is banned for containing graphic violence`;
          break;
        case 'media_banned_reason_2':
          error = t`This media is banned for containing CSAM`;
          break;
        case 'media_banned_reason_3':
          error = t`This media is banned for being an attempt to scam people`;
          break;
        case 'media_banned_reason_4':
          error = t`This media is banned for glorifying terrorism`;
          break;
        case 'already_exists':
          /* this is not an error, but treated as one to cancel request */
          error = null;
          break;
        default:
          // nothing
      }
    }
    if (error) {
      data.errors = [error];
      res.status(400);
      res.on('finish', () => req.destroy());
    }
    res.json(data);
  };

  bb.on('file', async (name, fileStream, info) => {
    logger.debug(`Media file received [${name}]: ${info.filename}`);
    if (name !== 'file') {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
      finalize(t`Unknown field ${name} in request`);
      return;
    }
    /*
      * can be multiple files with same fieldname
      */
    loadedFiles += 1;
    if (loadedFiles > MAX_UPLOAD_AMOUNT) {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
      finalize(t`Could not upload all files`);
      return;
    }

    if (hashes.length) {
      /*
      * since the stream has to wait for consumption, we can async resolve hashes
      * here, which wouldn't have been possible in the 'field' event.
      */
      if (!hashes[hashes.length - 1].shortId) {
        await hasMedia(hashes);
      }
      const modelIndex = hashes.findIndex(
        (h) => h.originalFilename === info.filename,
      );
      if (modelIndex !== -1) {
        const model = hashes[modelIndex];
        hashes.splice(modelIndex, 1);
        if (model.shortId) {
          if (hashes.find((h) => h.shortId)) {
            /* another file exists that we don't have yet, roll forward */
            if (!fileStream.closed) {
              fileStream.resume();
            }
          } else {
            availableFiles.push(model);
            if (!fileStream.destroyed) {
              fileStream.destroy();
            }
            finalize('already_exists');
          }
          return;
        }
      }
    }

    let model;
    try {
      model = await storeMediaStream(fileStream, info, req.user, req.ip);
    } catch (error) {
      if (!fileStream.destroyed && !fileStream.closed) {
        fileStream.destroy();
      }
      finalize(error);
      return;
    }

    availableFiles.push(model);
    if (!fileStream.closed) {
      fileStream.resume();
    }
  });

  bb.on('field', (name, value) => {
    logger.debug(`Media field received [${name}]`);
    if (name === 'hashes') {
      /*
       * filename=hash:mimeType;filename=hash:mimetype;...
       */
      const pairs = value.split(';');
      for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i];
        const seperator = pair.indexOf('=');
        if (seperator !== -1) {
          let hash = pair.substring(seperator + 1);
          const hashSeperator = hash.indexOf(':');
          // eslint-disable-next-line max-len
          const mimeType = decodeURIComponent(hash.substring(hashSeperator + 1).trim());
          hash = hash.substring(0, hashSeperator).trim();
          if (hash.length === 64) {
            // eslint-disable-next-line max-len
            const filename = decodeURIComponent(pair.substring(0, seperator).trim());
            const [namePart, extension] = splitFilename(filename);
            hashes.push({
              hash, name: namePart, mimeType, extension,
              originalFilename: filename,
            });
          }
        }
      }
    } else {
      finalize(t`Unknown field ${name} in request`);
    }
  });

  bb.on('error', () => {
    finalize('server_error');
  });

  bb.on('close', () => {
    requestDone = true;
    finalize();
  });

  req.pipe(bb);
});

export default router;
