import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// Magic header để nhận dạng file đã mã hoá
const MAGIC = Buffer.from('HSLBAK1');

/**
 * Mã hoá buffer bằng AES-256-GCM với password.
 * Output format: MAGIC(7) + salt(16) + iv(12) + authTag(16) + ciphertext
 */
export function encryptBuffer(data: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(16);
  const key  = crypto.scryptSync(password, salt, 32);
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return Buffer.from(Buffer.concat([MAGIC, salt, iv, authTag, encrypted]));
}

/**
 * Giải mã buffer. Ném lỗi nếu sai password hoặc file bị hỏng.
 */
export function decryptBuffer(data: Buffer, password: string): Buffer {
  if (!isEncrypted(data)) {
    throw new Error('File không phải định dạng backup mã hoá');
  }
  const salt      = data.subarray(7, 23);
  const iv        = data.subarray(23, 35);
  const authTag   = data.subarray(35, 51);
  const encrypted = data.subarray(51);
  const key = crypto.scryptSync(password, salt, 32);
  const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.from(Buffer.concat([decipher.update(encrypted), decipher.final()]));
  } catch {
    throw new Error('Mật khẩu sai hoặc file bị hỏng');
  }
}

/** Kiểm tra file có magic header → đã mã hoá */
export function isEncrypted(data: Buffer): boolean {
  return data.length > MAGIC.length && data.subarray(0, MAGIC.length).equals(MAGIC);
}
