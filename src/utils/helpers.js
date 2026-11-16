const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Money is stored as Number with 2 decimals; round to avoid float drift (e.g. 0.1 * 3).
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

module.exports = { escapeRegex, slugify, roundMoney };
