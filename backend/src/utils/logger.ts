import prisma from '../utils/prisma';

interface LogInput {
  userId?: number;
  username?: string;
  action: string;
  module?: string;
  message: string;
  level?: 'info' | 'warning' | 'error' | 'critical';
  ip?: string;
}

export async function writeLog(input: LogInput) {
  try {
    await prisma.activityLog.create({
      data: {
        userId:   input.userId,
        username: input.username,
        action:   input.action,
        module:   input.module,
        message:  input.message,
        level:    input.level || 'info',
        ip:       input.ip,
      },
    });
  } catch {
    // Never let logging crash the app
    console.error('[logger] Failed to write log:', input.message);
  }
}
