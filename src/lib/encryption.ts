import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES-GCM, the IV is typically 12 bytes, but 16 is also common and supported.
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // For AES-256
const ITERATIONS = 100000; // PBKDF2 iterations

const encryptionKey = process.env.X_TOKEN_ENCRYPTION_KEY;

// During build phase, we need to allow missing env vars
const isBuildPhase = process.env.NODE_ENV === 'production' && !process.env.X_TOKEN_ENCRYPTION_KEY && typeof window === 'undefined';

if (!encryptionKey || Buffer.from(encryptionKey || '', 'hex').length !== KEY_LENGTH) {
  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error('X_TOKEN_ENCRYPTION_KEY is not defined or is not a 32-byte hex string.');
  } else if (!isBuildPhase) {
    console.warn('X_TOKEN_ENCRYPTION_KEY is not defined or is not a 32-byte hex string. Encryption will be insecure in development if not set.');
  }
}

// Derive a key of KEY_LENGTH bytes using PBKDF2
const getKey = (salt: Buffer): Buffer => {
  if (!encryptionKey) { // Should not happen if check above is done, but as a safeguard
    if (process.env.NODE_ENV === 'production') throw new Error('Encryption key is missing for getKey');
    // In dev, use a placeholder if not set, though this is insecure
    return crypto.pbkdf2Sync('dev_dummy_encryption_key_replace_me', salt, ITERATIONS, KEY_LENGTH, 'sha512');
  }
  return crypto.pbkdf2Sync(Buffer.from(encryptionKey, 'hex'), salt, ITERATIONS, KEY_LENGTH, 'sha512');
};

export function encrypt(text: string): string {
  if (!text) return '';
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = getKey(salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    // Prepend salt, iv, and tag to the encrypted text, all hex encoded
    return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data.');
  }
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted text format. Expected salt:iv:tag:encryptedData');
    }
    const [saltHex, ivHex, tagHex, encryptedDataHex] = parts;

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = getKey(salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    // In case of decryption error, returning an empty string or re-throwing might be appropriate
    // For sensitive tokens, re-throwing or specific error handling is better than returning potentially corrupted data.
    throw new Error('Failed to decrypt data. Data may be corrupted or key may be incorrect.');
  }
} 