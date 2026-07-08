import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from './token-encryption.service.js';

function mockConfig(values: Record<string, string> = {}) {
  return {
    get: (key: string, ...args: unknown[]) =>
      values[key] ?? (args.length > 0 ? args[0] : undefined),
  } as unknown as ConfigService;
}

describe('TokenEncryptionService', () => {
  const VALID_HEX_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('with valid 64-char hex key', () => {
    let svc: TokenEncryptionService;

    beforeEach(() => {
      svc = new TokenEncryptionService(
        mockConfig({ TOKEN_ENCRYPTION_KEY: VALID_HEX_KEY }),
      );
    });

    it('encrypt returns colon-separated base64 string with 3 parts', () => {
      const result = svc.encrypt('hello');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      parts.forEach((p) => {
        expect(() => Buffer.from(p, 'base64')).not.toThrow();
      });
    });

    it('decrypt round-trips with encrypt', () => {
      const plaintext = 'my-secret-token-123';
      const encrypted = svc.encrypt(plaintext);
      expect(svc.decrypt(encrypted)).toBe(plaintext);
    });

    it('handles empty string', () => {
      const encrypted = svc.encrypt('');
      expect(svc.decrypt(encrypted)).toBe('');
    });

    it('handles Unicode and special characters', () => {
      const plaintext = 'Ünïcödé 日本語 🔑 {json: "value"}';
      const encrypted = svc.encrypt(plaintext);
      expect(svc.decrypt(encrypted)).toBe(plaintext);
    });

    it('generates different IVs for repeated encryptions of same plaintext', () => {
      const plaintext = 'same-text';
      const enc1 = svc.encrypt(plaintext);
      const enc2 = svc.encrypt(plaintext);
      expect(enc1).not.toBe(enc2);
      // Both still decrypt correctly
      expect(svc.decrypt(enc1)).toBe(plaintext);
      expect(svc.decrypt(enc2)).toBe(plaintext);
    });

    it('decrypt throws on tampered ciphertext', () => {
      const encrypted = svc.encrypt('test');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext part
      parts[2] = Buffer.from('tampered').toString('base64');
      expect(() => svc.decrypt(parts.join(':'))).toThrow();
    });

    it('decrypt throws on tampered auth tag', () => {
      const encrypted = svc.encrypt('test');
      const parts = encrypted.split(':');
      // Tamper with the auth tag
      parts[1] = Buffer.from('bad!').toString('base64');
      expect(() => svc.decrypt(parts.join(':'))).toThrow();
    });
  });

  describe('key selection', () => {
    it('uses TOKEN_ENCRYPTION_KEY when provided', () => {
      const svc = new TokenEncryptionService(
        mockConfig({ TOKEN_ENCRYPTION_KEY: VALID_HEX_KEY }),
      );
      const encrypted = svc.encrypt('test');
      expect(svc.decrypt(encrypted)).toBe('test');
    });

    it('falls back to CHANNEL_ENCRYPTION_KEY when TOKEN_ENCRYPTION_KEY missing', () => {
      const svc = new TokenEncryptionService(
        mockConfig({ CHANNEL_ENCRYPTION_KEY: VALID_HEX_KEY }),
      );
      const encrypted = svc.encrypt('test');
      expect(svc.decrypt(encrypted)).toBe('test');
    });

    it('TOKEN_ENCRYPTION_KEY takes precedence over CHANNEL_ENCRYPTION_KEY', () => {
      const key2 =
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const svc1 = new TokenEncryptionService(
        mockConfig({
          TOKEN_ENCRYPTION_KEY: VALID_HEX_KEY,
          CHANNEL_ENCRYPTION_KEY: key2,
        }),
      );
      const svc2 = new TokenEncryptionService(
        mockConfig({ CHANNEL_ENCRYPTION_KEY: key2 }),
      );
      // Encrypted with key1 (TOKEN_ENCRYPTION_KEY) should not decrypt with key2
      const encrypted = svc1.encrypt('test');
      // svc2 uses key2, which is different from key1
      expect(() => svc2.decrypt(encrypted)).toThrow();
    });

    it('uses insecure dev key when no key is configured', () => {
      const svc = new TokenEncryptionService(mockConfig({}));
      const encrypted = svc.encrypt('test');
      expect(svc.decrypt(encrypted)).toBe('test');
    });
  });
});
