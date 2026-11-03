import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode, totpCode, verifyTotp, generateSecret, otpauthUrl } from './totp';

// RFC 6238 appendix B uses the ASCII secret "12345678901234567890" (SHA-1).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('base32 round-trips', () => {
    const buf = Buffer.from('hello world, 2fa!');
    expect(base32Decode(base32Encode(buf)).toString()).toBe('hello world, 2fa!');
  });
  it('matches the RFC 6238 test vectors (last 6 digits)', () => {
    expect(totpCode(RFC_SECRET, 59 * 1000)).toBe('287082');
    expect(totpCode(RFC_SECRET, 1111111109 * 1000)).toBe('081804');
    expect(totpCode(RFC_SECRET, 1234567890 * 1000)).toBe('005924');
    expect(totpCode(RFC_SECRET, 2000000000 * 1000)).toBe('279037');
  });
  it('verifies the current code and tolerates one step of drift, nothing more', () => {
    const t = 1700000000000;
    const code = totpCode(RFC_SECRET, t);
    expect(verifyTotp(RFC_SECRET, code, t)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, t + 30000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, t + 90000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '000000', t)).toBe(code === '000000');
  });
  it('rejects malformed codes', () => {
    expect(verifyTotp(RFC_SECRET, 'abcdef')).toBe(false);
    expect(verifyTotp(RFC_SECRET, '12345')).toBe(false);
  });
  it('generates distinct secrets and a valid otpauth URL', () => {
    expect(generateSecret()).not.toBe(generateSecret());
    expect(otpauthUrl('ABC', 'admin@x')).toContain('otpauth://totp/Dynamic%20Quotation:admin%40x?secret=ABC');
  });
});
