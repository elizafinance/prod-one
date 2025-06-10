import crypto from 'crypto';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES-GCM, the IV is typically 12 bytes, but 16 is also common and supported.
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // For AES-256
const ITERATIONS = 100000; // PBKDF2 iterations
const encryptionKey = process.env.X_TOKEN_ENCRYPTION_KEY;
// Determine if we're in the special Next.js build phase (when NODE_ENV === 'production',
// but the code is being statically evaluated to collect page data).
// During this phase, environment secrets are often unavailable, so we should not hard-fail.
const isNextBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
if (!encryptionKey || Buffer.from(encryptionKey, 'hex').length !== KEY_LENGTH) {
    if (process.env.NODE_ENV === 'production' && !isNextBuildPhase) {
        // In true production *runtime* (not build-time) we still enforce that the key must exist.
        throw new Error('X_TOKEN_ENCRYPTION_KEY is not defined or is not a 32-byte hex string.');
    }
    else {
        // In development or build-time, fall back to an insecure placeholder key and emit a warning.
        console.warn('X_TOKEN_ENCRYPTION_KEY is not defined or is not a 32-byte hex string. Using an insecure placeholder key for this build/run.');
    }
}
// Helper to determine if we're at production runtime (as opposed to build-time or development)
const isProductionRuntime = process.env.NODE_ENV === 'production' && !isNextBuildPhase;
// Derive a key of KEY_LENGTH bytes using PBKDF2
const getKey = (salt) => {
    if (!encryptionKey || Buffer.from(encryptionKey, 'hex').length !== KEY_LENGTH) {
        if (isProductionRuntime) {
            throw new Error('Encryption key is missing or invalid at runtime.');
        }
        // For development or build-time, use a predictable (but insecure) placeholder key so that
        // encryption/decryption still works without secrets. NEVER USE THIS IN REAL PRODUCTION.
        return crypto.pbkdf2Sync('dev_dummy_encryption_key_replace_me', salt, ITERATIONS, KEY_LENGTH, 'sha512');
    }
    return crypto.pbkdf2Sync(Buffer.from(encryptionKey, 'hex'), salt, ITERATIONS, KEY_LENGTH, 'sha512');
};
export function encrypt(text) {
    if (!text)
        return '';
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
    }
    catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data.');
    }
}
export function decrypt(encryptedText) {
    if (!encryptedText)
        return '';
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
    }
    catch (error) {
        console.error('Decryption failed:', error);
        // In case of decryption error, returning an empty string or re-throwing might be appropriate
        // For sensitive tokens, re-throwing or specific error handling is better than returning potentially corrupted data.
        throw new Error('Failed to decrypt data. Data may be corrupted or key may be incorrect.');
    }
}
