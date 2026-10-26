'use strict';

const { ValidationError } = require('../errors');

/**
 * Small helpers used by the specialised request classes to check their fields.
 * Each helper returns the cleaned value or throws a clear ValidationError.
 */
function requireText(value, label) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) throw new ValidationError(`${label} is required.`);
  return text;
}

/** Accepts a value from a fixed list (case-insensitive) and returns the list's spelling. */
function requireOption(value, options, label) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  const match = options.find((option) => option.toLowerCase() === text.toLowerCase());
  if (!match) {
    throw new ValidationError(`${label} must be one of: ${options.join(', ')}${text ? ` (received "${text}")` : ''}.`);
  }
  return match;
}

/** Runs each check, collects every message, and throws them together. */
function collectProblems(checks) {
  const problems = [];
  const values = {};
  for (const [key, check] of Object.entries(checks)) {
    try {
      values[key] = check();
    } catch (error) {
      problems.push(error.message);
    }
  }
  if (problems.length > 0) throw new ValidationError(problems.join(' '));
  return values;
}

module.exports = { requireText, requireOption, collectProblems };
