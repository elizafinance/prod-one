import { encrypt, decrypt } from '../encryption';

describe('encryption.ts', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const text = 'Hello, world!';
      const encrypted = encrypt(text);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(text);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it('should return an empty string when encrypting an empty string', () => {
      expect(encrypt('')).toBe('');
    });

    it('should return an empty string when decrypting an empty string', () => {
      expect(decrypt('')).toBe('');
    });

    it('should throw an error when decrypting malformed input', () => {
      expect(() => decrypt('not:valid:encrypted:data:extra')).toThrow('Failed to decrypt data. Data may be corrupted or key may be incorrect.');
      expect(() => decrypt('badinput')).toThrow('Failed to decrypt data. Data may be corrupted or key may be incorrect.');
    });

    it('should throw an error when decrypting with wrong key', () => {
      const text = 'Sensitive data';
      const encrypted = encrypt(text);
      // Simulate wrong key by tampering with the encrypted string
      const parts = encrypted.split(':');
      // Change one character in the encrypted data
      parts[3] = parts[3].slice(0, -1) + (parts[3].slice(-1) === 'a' ? 'b' : 'a');
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow('Failed to decrypt data');
    });
  });
});
