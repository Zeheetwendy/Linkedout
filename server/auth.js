'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

// Wachtwoorden worden nooit opgeslagen, alleen een scrypt-hash met een eigen salt per gebruiker.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  const key = await scrypt(password, salt, expected.length, { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) });
  return crypto.timingSafeEqual(key, expected);
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// In de database staat alleen de hash van een sessietoken: een gelekte database logt niemand in.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Uitnodigingscode zonder tekens die op elkaar lijken (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newInviteCode() {
  let out = '';
  for (let i = 0; i < 12; i++) {
    if (i && i % 4 === 0) out += '-';
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

function normalizeInviteCode(raw) {
  return typeof raw === 'string' ? raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-') : '';
}

function newTempPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

module.exports = { hashPassword, verifyPassword, newToken, hashToken, newInviteCode, normalizeInviteCode, newTempPassword };
