import crypto from 'crypto';

function getEncryptionKey(): Buffer {
  const secret =
    process.env.PII_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'sahayyatra-dev-only-32byte-fallback-key';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPii(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPii(ciphertext: string): string {
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function signQrToken(payload: string): string {
  const key = getEncryptionKey();
  const sig = crypto.createHmac('sha256', key).update(payload).digest('hex').slice(0, 16);
  return `${payload}|${sig}`;
}
