// Version được inject tại build time từ frontend/package.json (xem vite.config.ts → define)
declare const __APP_VERSION__: string;

export const APP_VERSION = __APP_VERSION__;
export const APP_NAME    = 'Happy Smart Light';
