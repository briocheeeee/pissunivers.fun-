import logger from '../core/logger.js';

function isString(val) {
  return typeof val === 'string';
}

function isOptionalString(val) {
  return val === undefined || val === null || typeof val === 'string';
}

function isOptionalNumber(val) {
  return val === undefined || val === null || typeof val === 'number';
}

function isOptionalBoolean(val) {
  return val === undefined || val === null || typeof val === 'boolean';
}

export function validateAuthLocal(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!isString(body.nameoremail) || body.nameoremail.length === 0) {
    return 'nameoremail is required';
  }
  if (!isString(body.password) || body.password.length === 0) {
    return 'password is required';
  }
  if (body.nameoremail.length > 100) {
    return 'nameoremail too long';
  }
  if (body.password.length > 100) {
    return 'password too long';
  }
  return null;
}

export function validateAuthRegister(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!isString(body.email) || body.email.length === 0) {
    return 'email is required';
  }
  if (!isString(body.name) || body.name.length === 0) {
    return 'name is required';
  }
  if (!isString(body.password) || body.password.length === 0) {
    return 'password is required';
  }
  if (!isString(body.captcha) || body.captcha.length === 0) {
    return 'captcha is required';
  }
  if (!isString(body.captchaid) || body.captchaid.length === 0) {
    return 'captchaid is required';
  }
  if (body.email.length > 100) {
    return 'email too long';
  }
  if (body.name.length > 50) {
    return 'name too long';
  }
  if (body.password.length > 100) {
    return 'password too long';
  }
  if (!isOptionalString(body.username)) {
    return 'username must be a string';
  }
  return null;
}

export function validateRestorePassword(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!isString(body.email) || body.email.length === 0) {
    return 'email is required';
  }
  if (body.email.length > 100) {
    return 'email too long';
  }
  return null;
}

export function validateModtoolsProtAction(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!isString(body.protaction)) {
    return 'protaction is required';
  }
  if (!isString(body.ulcoor)) {
    return 'ulcoor is required';
  }
  if (!isString(body.brcoor)) {
    return 'brcoor is required';
  }
  if (!isString(body.canvasid) && typeof body.canvasid !== 'number') {
    return 'canvasid is required';
  }
  return null;
}

export function validateModtoolsRollback(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!isString(body.rollbackdate)) {
    return 'rollbackdate is required';
  }
  if (!/^\d{8}$/.test(body.rollbackdate)) {
    return 'rollbackdate must be YYYYMMDD format';
  }
  if (!isString(body.rollbacktime)) {
    return 'rollbacktime is required';
  }
  if (!/^\d{4}$/.test(body.rollbacktime)) {
    return 'rollbacktime must be HHMM format';
  }
  if (!isString(body.ulcoor)) {
    return 'ulcoor is required';
  }
  if (!isString(body.brcoor)) {
    return 'brcoor is required';
  }
  if (!isString(body.canvasid) && typeof body.canvasid !== 'number') {
    return 'canvasid is required';
  }
  return null;
}

export function validateModtoolsTextAction(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!isString(body.textaction)) {
    return 'textaction is required';
  }
  if (!isString(body.text)) {
    return 'text is required';
  }
  if (body.text.length > 10000) {
    return 'text too long';
  }
  return null;
}

export function validateModtoolsIIDAction(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!isString(body.iidaction)) {
    return 'iidaction is required';
  }
  if (!isString(body.iid)) {
    return 'iid is required';
  }
  if (body.iid.length > 100) {
    return 'iid too long';
  }
  return null;
}

export function createValidationMiddleware(validator) {
  return (req, res, next) => {
    const error = validator(req.body);
    if (error) {
      logger.info(`INPUT_VALIDATION: Rejected request - ${error}`);
      res.status(400).json({ errors: [error] });
      return;
    }
    next();
  };
}
