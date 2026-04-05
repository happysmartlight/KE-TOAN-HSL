import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ke-toan-noi-bo-secret-2024';

// ── Online user tracking ──────────────────────────────────────────────────────
type OnlineEntry = { userId: number; username: string; name: string; role: string; ip: string; at: number };
const _lastSeen = new Map<number, OnlineEntry>();
const ONLINE_TTL_MS = 5 * 60 * 1000; // 5 phút không hoạt động → coi là offline

export function getOnlineUsers(): OnlineEntry[] {
  const cutoff = Date.now() - ONLINE_TTL_MS;
  const result: OnlineEntry[] = [];
  for (const [id, entry] of _lastSeen) {
    if (entry.at >= cutoff) result.push(entry);
    else _lastSeen.delete(id);
  }
  return result.sort((a, b) => b.at - a.at);
}
// ─────────────────────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = payload;

    // Ghi nhận hoạt động (bỏ qua endpoint health-check để tránh spam)
    if (payload?.id && !req.path.endsWith('/health')) {
      _lastSeen.set(payload.id, {
        userId:   payload.id,
        username: payload.username ?? '?',
        name:     payload.name     ?? payload.username ?? '?',
        role:     payload.role     ?? 'staff',
        ip:       (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '?',
        at:       Date.now(),
      });
    }

    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if ((req as any).user?.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    next();
  });
}
