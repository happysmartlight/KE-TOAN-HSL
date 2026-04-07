import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

/**
 * JWT helper — đảm bảo:
 *  - JWT_SECRET phải có trong env, không dùng fallback hardcode.
 *  - Pin algorithm 'HS256' khi sign/verify để tránh CVE algorithm-confusion
 *    (vd: token tự ký với alg='none' hoặc RS256 với public key).
 */

const ALG: jwt.Algorithm = 'HS256';

function loadSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.trim().length < 32) {
    throw new Error(
      'JWT_SECRET không được cấu hình hoặc quá ngắn (tối thiểu 32 ký tự). ' +
      'Hãy đặt biến môi trường JWT_SECRET trong file .env. ' +
      'Sinh chuỗi an toàn bằng: openssl rand -hex 64'
    );
  }
  return s;
}

// Validate ngay khi import (fail-fast khi server boot)
const JWT_SECRET = loadSecret();

export function signToken(payload: object, expiresIn: SignOptions['expiresIn'] = '8h'): string {
  return jwt.sign(payload, JWT_SECRET, { algorithm: ALG, expiresIn });
}

export function verifyToken<T = JwtPayload>(token: string): T {
  return jwt.verify(token, JWT_SECRET, { algorithms: [ALG] }) as T;
}
