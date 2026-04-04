import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Users
  const adminPass = await bcrypt.hash('admin123', 10);
  const staffPass = await bcrypt.hash('staff123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: adminPass, name: 'Quản trị viên', role: 'admin' },
  });
  await prisma.user.upsert({
    where: { username: 'nhanvien' },
    update: {},
    create: { username: 'nhanvien', password: staffPass, name: 'Nhân Viên', role: 'staff' },
  });

  // Customers
  const customers = await Promise.all([
    prisma.customer.upsert({ where: { id: 1 }, update: {}, create: { name: 'Công ty ABC', phone: '0901234567', email: 'abc@gmail.com', address: 'Hà Nội' } }),
    prisma.customer.upsert({ where: { id: 2 }, update: {}, create: { name: 'Anh Minh', phone: '0912345678', address: 'TP.HCM' } }),
    prisma.customer.upsert({ where: { id: 3 }, update: {}, create: { name: 'Chị Lan', phone: '0923456789', address: 'Đà Nẵng' } }),
  ]);

  // Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.upsert({ where: { id: 1 }, update: {}, create: { name: 'Nhà cung cấp X', phone: '0934567890', address: 'Hà Nội' } }),
    prisma.supplier.upsert({ where: { id: 2 }, update: {}, create: { name: 'Công ty Y', phone: '0945678901', email: 'y@supplier.com' } }),
  ]);

  // Products
  const products = await Promise.all([
    prisma.product.upsert({ where: { sku: 'SP001' }, update: {}, create: { name: 'Sản phẩm A', sku: 'SP001', unit: 'cái', costPrice: 50000, sellingPrice: 80000, stock: 100 } }),
    prisma.product.upsert({ where: { sku: 'SP002' }, update: {}, create: { name: 'Sản phẩm B', sku: 'SP002', unit: 'hộp', costPrice: 120000, sellingPrice: 180000, stock: 50 } }),
    prisma.product.upsert({ where: { sku: 'SP003' }, update: {}, create: { name: 'Sản phẩm C', sku: 'SP003', unit: 'kg', costPrice: 30000, sellingPrice: 45000, stock: 3 } }),
  ]);

  console.log(`Created ${customers.length} customers, ${suppliers.length} suppliers, ${products.length} products`);
  console.log('\nTài khoản đăng nhập:');
  console.log('  admin / admin123  (Quản trị viên)');
  console.log('  nhanvien / staff123  (Nhân viên)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
