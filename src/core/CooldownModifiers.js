/*
 * Modifiers for coolodwn
 * IP modifiers have to be set by timer.
 * Country modifiers are permanent.
 */
import socketEvents from '../socket/socketEvents.js';
import { getMaxPixelStackMultiplier, DONATION_TIER } from './donations/index.js';

/*
 * {country: factor, ...}
 */
const countries = {};
/*
 * { ip: factor, ...}
 */
const ips = {};
/*
 * { odId: donationTier, ...}
 */
const userDonationTiers = {};
/*
 * [[ip, timeoutEnd, factor], ...]
 */
let ipTimers = [];

let timeout = null;
let timeoutEnd = null;

export function getAllCountryCooldownFactors() {
  return countries;
}

export function resetAllCountryCooldownFactors() {
  for (const country of Object.keys(countries)) {
    delete countries[country];
  }
}

export function resetCountryCooldownFactor(country) {
  delete countries[country];
}

export function setCountryCooldownFactor(country, factor) {
  if (factor === 1.0) {
    delete countries[country];
  } else {
    countries[country] = factor;
  }
}

function checkTimers() {
  const now = Date.now();
  const leftTimers = [];
  let nextTimer;
  for (const timer of ipTimers) {
    const [, endTime] = timer;
    if (endTime > now) {
      leftTimers.push(timer);
      if (!nextTimer || endTime < nextTimer) {
        nextTimer = endTime;
      }
    }
  }
  ipTimers = leftTimers;

  for (const ip of Object.keys(ips)) {
    let newFactor;
    ipTimers.forEach(([ipn,, factor]) => {
      if (ipn === ip && (!newFactor || factor > newFactor)) {
        newFactor = factor;
      }
    });
    if (!newFactor || newFactor === 1.0) {
      delete ips[ip];
    } else {
      ips[ip] = newFactor;
    }
  }

  if (nextTimer) {
    timeout = setTimeout(checkTimers, Math.max(nextTimer - now, 3000));
    timeoutEnd = nextTimer;
  } else {
    timeout = null;
    timeoutEnd = null;
  }
}

export function setIPCooldownFactor(ip, factor, endTime) {
  if (!ips[ip] || ips[ip] < factor) {
    ips[ip] = factor;
  }
  ipTimers.push([ip, endTime, factor]);
  if (!timeoutEnd || endTime < timeoutEnd) {
    clearTimeout(timeout);
    timeout = setTimeout(checkTimers, Math.max(endTime - Date.now(), 3000));
    timeoutEnd = endTime;
  }
}

export function getAmountOfIPCooldownModifications() {
  return Object.keys(ips).length;
}

export function getCooldownFactor(country, ip) {
  return (countries[country] || 1.0) * (ips[ip] || 1.0);
}

export function setUserDonationTier(odId, donationTier) {
  if (donationTier && donationTier !== DONATION_TIER.USER) {
    userDonationTiers[odId] = donationTier;
  } else {
    delete userDonationTiers[odId];
  }
}

export function getUserDonationTier(odId) {
  return userDonationTiers[odId] || DONATION_TIER.USER;
}

export function getDonationStackMultiplier(odId) {
  const tier = userDonationTiers[odId] || DONATION_TIER.USER;
  return getMaxPixelStackMultiplier(tier);
}

export function getFullCooldownFactor(country, ip, odId) {
  const baseFactor = (countries[country] || 1.0) * (ips[ip] || 1.0);
  const donationMultiplier = getDonationStackMultiplier(odId);
  return baseFactor / donationMultiplier;
}

socketEvents.on('ipCooldownModifier', setIPCooldownFactor);
