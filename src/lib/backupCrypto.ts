// Passphrase-encrypted backup files (AES-256-GCM, key from scrypt). Node only. Format:
//   "AJQENC01" (8 bytes) | salt (16) | iv (12) | auth tag (16) | ciphertext
// A wrong passphrase or a modified file fails authentication and nothing is decrypted.
import crypto from 'crypto';

const MAGIC = Buffer.from('AJQENC01');
const SALT_LEN = 16, IV_LEN = 12, TAG_LEN = 16;

const deriveKey = (passphrase: string, salt: Buffer) =>
  crypto.scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });

export function encryptBackup(data: Buffer, passphrase: string): Buffer {
  if (passphrase.length < 12) throw new Error('Passphrase must be at least 12 characters.');
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function isEncryptedBackup(file: Buffer): boolean {
  return file.length > MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN && file.subarray(0, MAGIC.length).equals(MAGIC);
}

export function decryptBackup(file: Buffer, passphrase: string): Buffer {
  if (!isEncryptedBackup(file)) throw new Error('This is not an encrypted backup file.');
  let o = MAGIC.length;
  const salt = file.subarray(o, (o += SALT_LEN));
  const iv = file.subarray(o, (o += IV_LEN));
  const tag = file.subarray(o, (o += TAG_LEN));
  const body = file.subarray(o);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error('Wrong passphrase, or the file is damaged.');
  }
}
