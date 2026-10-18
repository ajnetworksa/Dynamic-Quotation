import { describe, it, expect } from 'vitest';
import { encryptBackup, decryptBackup, isEncryptedBackup } from './backupCrypto';

describe('backupCrypto', () => {
  const data = Buffer.from('SQLite format 3\0 pretend database bytes '.repeat(50));
  it('round-trips with the right passphrase', () => {
    const enc = encryptBackup(data, 'correct horse battery');
    expect(isEncryptedBackup(enc)).toBe(true);
    expect(enc.includes(Buffer.from('SQLite format 3'))).toBe(false); // plaintext is not visible
    expect(decryptBackup(enc, 'correct horse battery').equals(data)).toBe(true);
  });
  it('rejects a wrong passphrase and tampered data', () => {
    const enc = encryptBackup(data, 'correct horse battery');
    expect(() => decryptBackup(enc, 'wrong passphrase!!')).toThrow(/Wrong passphrase/);
    const tampered = Buffer.from(enc); tampered[tampered.length - 1] ^= 1;
    expect(() => decryptBackup(tampered, 'correct horse battery')).toThrow();
  });
  it('requires a long passphrase and recognises non-encrypted files', () => {
    expect(() => encryptBackup(data, 'short')).toThrow();
    expect(isEncryptedBackup(Buffer.from('PK\x03\x04 zip file'))).toBe(false);
  });
  it('uses a fresh salt/iv every time', () => {
    expect(encryptBackup(data, 'correct horse battery').equals(encryptBackup(data, 'correct horse battery'))).toBe(false);
  });
});
