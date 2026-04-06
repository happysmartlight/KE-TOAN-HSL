export default async function globalTeardown() {
  // MariaDB: không cần xóa file, schema đã được reset bởi --force-reset khi chạy lại
  console.log('[globalTeardown] Done');
}
