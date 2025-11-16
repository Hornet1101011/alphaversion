const crypto = require('crypto');

/**
 * Encrypt plain text using AES-256-CBC. Returns base64 string in format iv:cipher
 * @param {string} plain
 * @param {string} secret - 32 byte key
 */
function encryptText(plain, secret) {
  if (!secret) throw new Error('encryption secret required');
  const key = Buffer.from(secret, 'utf8');
  if (key.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be 32 bytes');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plain, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  // prefix IV (base64) then ':' then cipher text
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * Decrypt a base64 iv:cipher string using AES-256-CBC
 * @param {string} cipherText
 * @param {string} secret
 */
function decryptText(cipherText, secret) {
  if (!secret) throw new Error('encryption secret required');
  const key = Buffer.from(secret, 'utf8');
  if (key.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be 32 bytes');
  const parts = cipherText.split(':');
  if (parts.length !== 2) throw new Error('Invalid cipher text format');
  const iv = Buffer.from(parts[0], 'base64');
  const data = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let out = decipher.update(data, 'base64', 'utf8');
  out += decipher.final('utf8');
  return out;
}

module.exports = { encryptText, decryptText };
