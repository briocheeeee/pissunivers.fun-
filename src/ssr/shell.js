/*
 * outer shell for a html page
 */
import { getTTag } from '../middleware/ttag.js';
import { getThemeCssAssets } from '../core/assets.js';
import { BASENAME } from '../core/config.js';

/* eslint-disable max-len */

export default function putHtmlIntoShell(title, description, htmlString, lang = 'en') {
  const { t } = getTTag(lang);
  return `<!doctype html>
<html lang="${lang}" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="google" content="nopagereadaloud" />
    <meta name="theme-color" content="#f8f9fa" />
    <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
    <link rel="stylesheet" type="text/css" id="globcss" href="${BASENAME}${getThemeCssAssets().default}" />
  </head>
  <body style="font-size: 20px;">
${htmlString}
    <p style="text-align: center;"><a href="${BASENAME}/">${t`Click here`}</a> ${t`to go back to pixuniverse`}</p>
    <a data-jslicense="1" style="display: none;" href="${BASENAME}/legal">JavaScript license information</a>
  </body>
</html>
`;
}
