/*
 * general config that is also available from client code can be found in
 * src/core/constants.js
 */
import fs from 'fs';
import path from 'path';

if (process.env.BROWSER) {
  throw new Error(
    'Do not import `config.js` from inside the client-side code.',
  );
}

let config = {};

(() => {
  const variables = [
    ['ASSET_DIR', 'string', '/assets'],
    ['PORT', 'int', 8080],
    ['HOST', 'string', '127.0.0.1'],
    ['USE_MAILER', 'bool', false],
    ['MAIL_ADDRESS', 'string', 'donotreply@example.com'],
    ['CONTACT_ADDRESS', 'string', 'admin@example.com'],
    ['TILE_FOLDER_REL', 'string', 'tiles'],
    ['MEDIA_FOLDER_REL', 'string', 'media'],
    ['USE_XREALIP', 'bool', false],
    ['BACKUP_URL', 'string', null],
    ['OUTGOING_ADDRESS', 'string', null],
    ['PUNISH_DOMINATOR', 'bool', false],
    ['USE_PROXYCHECK', 'bool', false],
    ['PROXYCHECK_KEY', 'string', null],
    ['REDIS_URL', 'string', 'redis://localhost:6379'],
    ['IS_CLUSTER', 'bool', false],
    ['CDN_URL', 'string', ''],
    ['NO_CDN_COUNTRIES', 'array', null],
    ['API_URLS', 'array', null],
    ['UNSHARDED_HOST', 'string', null],
    ['BASENAME', 'string', ''],
    ['CORS_HOSTS', 'array', []],
    ['MYSQL_HOST', 'string', 'localhost'],
    ['MYSQL_DATABASE', 'string', 'pixelplanet'],
    ['MYSQL_USER', 'string', 'pixelplanet'],
    ['MYSQL_PW', 'string', 'sqlpassword'],
    ['LOG_MYSQL', 'bool', false],
    ['CHAT_INVITE', 'string', 'https://www.guilded.gg/'],
    ['HOURLY_EVENT', 'bool', false],
    ['FISHING', 'bool', false],
    ['FISH_AMOUNT', 'int', 3],
    ['APISOCKET_KEY', 'string', null],
    ['ADMIN_IDS', 'numarray', []],
    ['CAPTCHA_TIME', 'int', 30],
    ['CAPTCHA_TIMEOUT', 'int', 120],
    ['TRUSTED_TIME', 'int', 48],
    ['WHOIS_DURATION', 'int', 240],
    ['PROXYCHECK_DURATION', 'int', 72],
    ['PROXY_RISK_THRESHOLD', 'int', 50],
    ['PROXY_CACHE_HOURS', 'int', 168],
    ['STRICT_PROXY_MODE', 'bool', true],
    ['COOKIE_SECRET', 'string', 'dummy'],
    ['DISCORD_CLIENT_ID', 'string', null],
    ['DISCORD_CLIENT_SECRET', 'string', null],
    ['GOOGLE_CLIENT_ID', 'string', null],
    ['GOOGLE_CLIENT_SECRET', 'string', null],
    ['VK_CLIENT_ID', 'string', null],
    ['VK_CLIENT_SECRET', 'string', null],
    ['DISCORD_R_URI', 'string', null],
    ['GOOGLE_R_URI', 'string', null],
    ['VK_R_URI', 'string', null],
    ['BACKUP_REDIS_URL', 'string', null],
    ['BACKUP_DIR', 'string', null],
    ['BACKUP_CMD', 'string', null],
    ['BACKUP_INTERVAL', 'int', 30],
    ['RATE_LIMIT_CMD', 'string', null],
    ['TIMEBLOCKS', 'array', null],
    ['OIDC_URL', 'string', null],
    ['IMGBB_KEY', 'string', null],
    ['DISCORD_BOT_TOKEN', 'string', null],
    ['DISCORD_GUILD_ID', 'string', null],
    ['DISCORD_VIP_ROLE_ID', 'string', null],
    ['DISCORD_PREMIUM_ROLE_ID', 'string', null],
    ['PATREON_CLIENT_ID', 'string', null],
    ['PATREON_CLIENT_SECRET', 'string', null],
    ['PATREON_WEBHOOK_SECRET', 'string', null],
    ['PATREON_VIP_PRODUCT_ID', 'string', null],
    ['PATREON_PREMIUM_PRODUCT_ID', 'string', null],
  ];

  /*
   * read all config file values
   */
  const configFileValues = {};
  try {
    const configFile = path.resolve('config.ini');
    if (fs.existsSync(configFile)) {
      fs.readFileSync(path.resolve('config.ini')).toString('utf8')
        .split('\n').forEach((line) => {
          line = line.trim();
          if (line.startsWith('#')) {
            return;
          }
          const seperator = line.indexOf('=');
          // eslint-disable-next-line
          if (seperator === -1 || seperator === 0 || seperator > line.length - 2) {
            return;
          }
          const key = line.substring(0, seperator).trim();
          let value = line.substring(seperator + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith('\'') && value.endsWith('\''))
          ) {
            value = value.substring(1, value.length - 1);
          }
          configFileValues[key] = value;
        });
    }
  } catch (error) {
    console.error(`Couldn't read config file ${error.message}`);
  }

  /*
   * read all variables and assign config values, either by environment or
   * config file
   */
  for (let i = 0; i < variables.length; i += 1) {
    const [key, type, def] = variables[i];

    let userValue = process.env[key];
    if (!userValue) {
      userValue = configFileValues[key];
    }
    let value;

    if (userValue) {
      switch (type) {
        case 'string': {
          value = userValue;
          break;
        }
        case 'int': {
          const num = parseInt(userValue, 10);
          if (Number.isNaN(num)) {
            value = def;
          } else {
            value = num;
          }
          break;
        }
        case 'bool': {
          /* eslint-disable max-len */
          userValue = userValue.toLowerCase();
          if (userValue === 'true' || userValue === 'yes' || userValue === '1') {
            value = true;
          } else if (userValue === 'false' || userValue === 'no' || userValue === '0') {
            value = false;
          } else {
            value = def;
          }
          /* eslint-enable max-len */
          break;
        }
        case 'array': {
          value = userValue.split(',').map((c) => c.trim()).filter((c) => c);
          break;
        }
        case 'numarray': {
          value = userValue.split(',').map((c) => c.trim()).filter((c) => c)
            .map((c) => parseInt(c, 10));
          break;
        }
        default:
          throw new Error(
            `Can not parse config value ${userValue} for ${key}`,
          );
      }
    } else {
      value = def;
    }

    config[key] = value;
  }

  /* postprocessed values */

  /*
   * read TIMEBLOCKS and seperate them into user and ip
   */
  config.TIMEBLOCK_USERS = null;
  config.TIMEBLOCK_IPS = null;
  if (config.TIMEBLOCKS) {
    /*
     * convert list of uidOrIP-HHmm-HHmm-message strings into Map
     */
    const timeBlockUsers = new Map();
    const timeBlockIps = new Map();
    for (let i = 0; i < config.TIMEBLOCKS.length; i += 1) {
      const [uidOrIP, start, end, message] = config.TIMEBLOCKS[i].split('-');
      const props = [`${start}-${end}`, message];
      if (uidOrIP.includes(':') || uidOrIP.includes('.')) {
        timeBlockIps.set(uidOrIP, props);
      } else {
        timeBlockUsers.set(parseInt(uidOrIP, 10), props);
      }
    }
    if (timeBlockUsers.size) {
      config.TIMEBLOCK_USERS = timeBlockUsers;
    }
    if (timeBlockIps.size) {
      config.TIMEBLOCK_IPS = timeBlockIps;
    }
  }

  /*
   * make list of configured third party providers,
   * the abbriviations are used in the route routes/top.js and in the Login Form
   * components/LogInForm.js
   */
  config.AVAILABLE_TP = [];
  if (config.DISCORD_CLIENT_ID) config.AVAILABLE_TP.push('d');
  if (config.GOOGLE_CLIENT_ID) config.AVAILABLE_TP.push('g');
  if (config.VK_CLIENT_ID) config.AVAILABLE_TP.push('vk');

  /*
   * resolve TILE_FOLDER and MEDIA_FOLDER to full path
   */
  config.TILE_FOLDER = path.resolve(config.TILE_FOLDER_REL);
  config.MEDIA_FOLDER = path.resolve(config.MEDIA_FOLDER_REL);

  /*
   * proccess URL related values
   */
  if (config.CDN_URL) {
    const cdnHost = config.CDN_URL.substring(config.CDN_URL.indexOf('//') + 2);
    const endHostSlash = cdnHost.indexOf('/', 8);
    if (endHostSlash !== -1) {
      config.CDN_HOST = cdnHost.substring(0, endHostSlash);
    } else {
      config.CDN_HOST = cdnHost;
    }
  } else {
    config.CDN_HOST = '';
  }

  config.CORS_HOSTS = config.CORS_HOSTS.map(
    (c) => ((c.split('.').length !== 4 && !c.startsWith('.')) ? `.${c}` : c),
  );

  const WEAK_PASSWORDS = [
    'password', 'sqlpassword', '123456', 'admin', 'root', 'mysql',
    'secret', 'changeme', 'default', 'test', 'demo', 'example',
  ];

  const REQUIRED_SECRETS = [
    'COOKIE_SECRET',
    'MYSQL_PW',
  ];

  const OPTIONAL_SECRETS_IF_ENABLED = [
    ['USE_PROXYCHECK', 'PROXYCHECK_KEY'],
    ['IMGBB_KEY', 'IMGBB_KEY'],
    ['DISCORD_BOT_TOKEN', 'DISCORD_BOT_TOKEN'],
    ['PATREON_CLIENT_ID', 'PATREON_CLIENT_SECRET'],
    ['PATREON_CLIENT_ID', 'PATREON_WEBHOOK_SECRET'],
  ];

  const errors = [];

  for (const key of REQUIRED_SECRETS) {
    const value = config[key];
    if (!value || value === 'CHANGE_ME_BEFORE_DEPLOY' || value === 'dummy') {
      errors.push(`${key} must be configured with a real value (found: ${value || 'empty'})`);
    }
  }

  if (config.MYSQL_PW) {
    const pw = config.MYSQL_PW.toLowerCase();
    if (config.MYSQL_PW.length < 12) {
      errors.push(`MYSQL_PW must be at least 12 characters (found: ${config.MYSQL_PW.length})`);
    }
    if (WEAK_PASSWORDS.some((weak) => pw.includes(weak))) {
      errors.push('MYSQL_PW contains a weak/common password pattern');
    }
  }

  if (config.COOKIE_SECRET && config.COOKIE_SECRET.length < 32) {
    errors.push(`COOKIE_SECRET must be at least 32 characters (found: ${config.COOKIE_SECRET.length})`);
  }

  for (const [enableKey, secretKey] of OPTIONAL_SECRETS_IF_ENABLED) {
    const enableValue = config[enableKey];
    const secretValue = config[secretKey];
    const isEnabled = enableValue === true
      || (typeof enableValue === 'string' && enableValue !== 'CHANGE_ME_BEFORE_DEPLOY' && enableValue);
    if (isEnabled && (!secretValue || secretValue === 'CHANGE_ME_BEFORE_DEPLOY')) {
      errors.push(`${secretKey} must be configured when ${enableKey} is enabled`);
    }
  }

  if (errors.length > 0) {
    console.error('\n=== CONFIGURATION ERRORS ===');
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error('\nPlease update your config.ini or environment variables.');
    console.error('See deployment/config.ini.example for reference.\n');
    process.exit(1);
  }
})();

export const {
  ASSET_DIR,
  PORT,
  HOST,
  USE_MAILER,
  MAIL_ADDRESS,
  CONTACT_ADDRESS,
  USE_XREALIP,
  BACKUP_URL,
  OUTGOING_ADDRESS,
  PUNISH_DOMINATOR,
  USE_PROXYCHECK,
  PROXYCHECK_KEY,
  REDIS_URL,
  IS_CLUSTER,
  CDN_URL,
  NO_CDN_COUNTRIES,
  API_URLS,
  UNSHARDED_HOST,
  BASENAME,
  CORS_HOSTS,
  MYSQL_HOST,
  MYSQL_DATABASE,
  MYSQL_USER,
  MYSQL_PW,
  LOG_MYSQL,
  CHAT_INVITE,
  HOURLY_EVENT,
  FISHING,
  FISH_AMOUNT,
  APISOCKET_KEY,
  ADMIN_IDS,
  CAPTCHA_TIME,
  CAPTCHA_TIMEOUT,
  TRUSTED_TIME,
  WHOIS_DURATION,
  PROXYCHECK_DURATION,
  PROXY_RISK_THRESHOLD,
  PROXY_CACHE_HOURS,
  STRICT_PROXY_MODE,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  VK_CLIENT_ID,
  VK_CLIENT_SECRET,
  DISCORD_R_URI,
  GOOGLE_R_URI,
  VK_R_URI,
  TILE_FOLDER,
  MEDIA_FOLDER,
  CDN_HOST,
  BACKUP_REDIS_URL,
  BACKUP_DIR,
  BACKUP_CMD,
  BACKUP_INTERVAL,
  RATE_LIMIT_CMD,
  COOKIE_SECRET,
  TIMEBLOCK_IPS,
  TIMEBLOCK_USERS,
  OIDC_URL,
  AVAILABLE_TP,
  IMGBB_KEY,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_VIP_ROLE_ID,
  DISCORD_PREMIUM_ROLE_ID,
  PATREON_CLIENT_ID,
  PATREON_CLIENT_SECRET,
  PATREON_WEBHOOK_SECRET,
  PATREON_VIP_PRODUCT_ID,
  PATREON_PREMIUM_PRODUCT_ID,
} = config;

config = null;
