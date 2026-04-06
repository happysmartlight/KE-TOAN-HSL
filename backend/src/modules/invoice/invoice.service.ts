import prisma from '../../utils/prisma';
import { writeLog } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceItemInput = {
  productId: number;
  quantity: number;
  price: number;
  taxRate?: string;
};

type CreateInvoiceData = {
  customerId: number;
  items: InvoiceItemInput[];
  note?: string;
  eInvoiceCode?: string;
  invoiceDate?: string;
  totalAmountOverride?: number;
  initialPaid?: number;
  skipInventory?: boolean;    // true = không trừ tồn kho (import hồi tố)
  createdByUserId?: number;   // nhân viên tạo đơn
};

// Input từ frontend sau khi parse XML
export type XmlItemInput = {
  xmlName: string;
  unit: string;
  quantity: number;
  unitPrice: number; // DGia — giá chưa VAT
  taxRate: string;   // TSuat
};

export type XmlInvoiceInput = {
  eInvoiceCode: string;
  invoiceDate: string;
  buyerName: string;       // Ten — tên đơn vị/công ty mua
  buyerPersonName?: string; // HVTNMHang — họ tên người đại diện mua hàng
  buyerTax: string;
  buyerAddress: string;    // DChi — địa chỉ
  buyerPhone?: string;     // SDThoai — số điện thoại
  grandTotal: number;      // TgTTTBSo — tổng có VAT
  initialPaid: number;
  skipInventory: boolean;
  items: XmlItemInput[];
};

// Kết quả preview (không write DB)
export type PreviewItem = {
  xmlName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: string;
  productId: number | null;
  productName: string | null;
  willCreate: boolean;       // true = sẽ tự tạo product mới (không có trong DB)
  batchNewProduct: boolean;  // true = tạo mới do chưa có TRONG BATCH (lần đầu)
  // key của sản phẩm trong batch đã resolve lần đầu (nếu null = SP đã có trong DB hoặc lần đầu trong batch)
  batchMergeProductKey?: string;
};

export type InvoicePreview = {
  eInvoiceCode: string;
  invoiceDate: string;
  buyerName: string;        // Ten — tên công ty
  buyerPersonName?: string; // HVTNMHang — tên người đại diện
  buyerTax: string;
  buyerAddress?: string;
  buyerPhone?: string;
  grandTotal: number;
  initialPaid: number;
  skipInventory: boolean;
  customerId: number | null;
  customerName: string | null;
  items: PreviewItem[];
  warnings: string[];
  isDuplicate: boolean;
  // index (0-based) của hóa đơn trong cùng batch mà KH này đã được resolve lần đầu
  // null = KH tìm thấy trong DB hoặc sẽ tạo hoàn toàn mới (chưa xuất hiện trong batch)
  batchMergeIndex?: number;
};

// Input đã được confirm từ frontend (productId đã resolve)
export type ConfirmedXmlItem = {
  productId: number | null; // null = auto-create
  xmlName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: string;
};

export type ConfirmedXmlInvoice = {
  eInvoiceCode: string;
  invoiceDate: string;
  customerId: number | null;  // null = auto-create customer
  buyerName?: string;         // Ten — tên công ty (dùng khi tự tạo customer)
  buyerPersonName?: string;   // HVTNMHang — tên người đại diện
  buyerTax?: string;
  buyerAddress?: string;
  buyerPhone?: string;
  grandTotal: number;
  initialPaid: number;
  skipInventory: boolean;
  items: ConfirmedXmlItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

// Tạo tên không trùng: "MAI PHƯỚC TÀI" → "MAI PHƯỚC TÀI (2)" nếu tên gốc đã có
async function uniqueCustomerName(baseName: string): Promise<string> {
  const existing = await prisma.customer.findMany({
    where: { name: { startsWith: baseName } },
    select: { name: true },
  });
  const names = new Set(existing.map((c) => c.name));
  if (!names.has(baseName)) return baseName;
  let i = 2;
  while (names.has(`${baseName} (${i})`)) i++;
  return `${baseName} (${i})`;
}

// Tìm sản phẩm khớp: tên giống + giá giống = cùng 1 SP; tên giống + giá khác = SP khác
async function findExistingProduct(xmlName: string, unitPrice: number): Promise<{ id: number } | null> {
  const byNameAndPrice = await prisma.product.findFirst({
    where: { status: 'active', name: xmlName, sellingPrice: unitPrice },
    select: { id: true },
  });
  if (byNameAndPrice) return byNameAndPrice;
  // Nếu giá = 0 (không rõ) → fallback match tên thôi
  if (unitPrice === 0) {
    return prisma.product.findFirst({
      where: { status: 'active', name: xmlName },
      select: { id: true },
    });
  }
  return null;
}

async function autoCreateProduct(name: string, unit: string, sellingPrice: number, taxRate: string) {
  return prisma.product.create({
    data: { name, unit, sellingPrice, costPrice: 0, taxRate, stock: 0 },
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const invoiceService = {
  async getAll() {
    return prisma.invoice.findMany({
      include: {
        customer: true,
        items: { include: { product: true } },
        createdByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: number) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } }, payments: true },
    });
  },

  // ── Tạo 1 hóa đơn (dùng cho cả thủ công lẫn batch) ────────────────────────
  async create(data: CreateInvoiceData) {
    const {
      customerId, items, note, eInvoiceCode, invoiceDate,
      totalAmountOverride, initialPaid = 0, skipInventory = false,
      createdByUserId,
    } = data;

    // Kiểm tra tồn kho (chỉ khi không bỏ qua)
    if (!skipInventory) {
      for (const item of items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Sản phẩm ID ${item.productId} không tồn tại`);
        if (product.stock < item.quantity) {
          throw new Error(`Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.stock})`);
        }
      }
    }

    const subTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalAmount = totalAmountOverride ?? subTotal;

    const count = await prisma.invoice.count();
    const code = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.$transaction(async (tx) => {
      const initialStatus = initialPaid >= totalAmount ? 'paid' : initialPaid > 0 ? 'partial' : 'unpaid';

      const newInvoice = await tx.invoice.create({
        data: {
          code,
          eInvoiceCode: eInvoiceCode || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          customerId,
          createdByUserId: createdByUserId || null,
          totalAmount,
          paidAmount: initialPaid,
          status: initialStatus,
          note,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              taxRate: item.taxRate || '10%',
              subtotal: item.price * item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Tồn kho — bỏ qua nếu skipInventory
      if (!skipInventory) {
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
          await tx.inventoryLog.create({
            data: { productId: item.productId, type: 'out', quantity: item.quantity, reason: 'sale', refId: newInvoice.id },
          });
        }
      }

      // Công nợ
      const outstanding = totalAmount - initialPaid;
      if (outstanding > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { debt: { increment: outstanding } },
        });
      }

      // Payment + cashflow nếu đã thu
      if (initialPaid > 0) {
        await tx.payment.create({
          data: { invoiceId: newInvoice.id, customerId, amount: initialPaid, method: 'transfer', note: 'Thu kèm khi import XML' },
        });
        await tx.cashflow.create({
          data: {
            type: 'income',
            category: 'payment_received',
            amount: initialPaid,
            date: invoiceDate ? new Date(invoiceDate) : new Date(),
            description: `Thu hóa đơn ${code}${eInvoiceCode ? ` (HĐĐT: ${eInvoiceCode})` : ''}`,
            refId: newInvoice.id,
            refType: 'invoice',
          },
        });
      }

      return newInvoice;
    });

    return invoice;
  },

  // ── Preview batch XML (không write DB) ─────────────────────────────────────
  async xmlPreview(inputs: XmlInvoiceInput[]): Promise<InvoicePreview[]> {
    // Load customers một lần
    const customers = await prisma.customer.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, companyName: true, taxCode: true, address: true },
    });

    // Load products một lần → build Map O(1) lookup: key = "norm(name):price"
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, sellingPrice: true, stock: true },
    });
    // Map: "norm(name):price" → product (exact match — same name + same price = same product)
    const productMap = new Map<string, typeof products[0]>();
    for (const p of products) {
      productMap.set(`${norm(p.name)}:${p.sellingPrice}`, p);
    }
    // Batch cache: products being created for the first time in this batch
    // key = "norm(xmlName):unitPrice" → label (e.g. "✦ Tạo mới lần đầu trong batch")
    const previewProductCache = new Map<string, string>(); // key → xmlName (display)

    // Kiểm tra eInvoiceCode đã tồn tại
    const existingCodes = await prisma.invoice.findMany({
      where: { eInvoiceCode: { in: inputs.map((i) => i.eInvoiceCode).filter(Boolean) } },
      select: { eInvoiceCode: true },
    });
    const existingCodeSet = new Set(existingCodes.map((e) => e.eInvoiceCode));

    // Cache khách hàng "sẽ tạo mới" trong batch này: key → index đầu tiên xuất hiện
    const previewCustomerCache = new Map<string, number>();

    const results: InvoicePreview[] = [];

    for (const input of inputs) {
      const warnings: string[] = [];

      // ── Match customer ──────────────────────────────────────────────────────
      let matchedCustomer: typeof customers[0] | undefined;

      // Bước 1: MST — đáng tin nhất, dừng ngay nếu tìm thấy
      if (input.buyerTax) {
        matchedCustomer = customers.find((c) => c.taxCode && norm(c.taxCode) === norm(input.buyerTax));
      }

      // Bước 2: Tên (không có MST hoặc MST không khớp)
      // buyerName = Ten (tên công ty), buyerPersonName = HVTNMHang (tên người đại diện)
      if (!matchedCustomer) {
        const byName = customers.filter((c) =>
          (input.buyerName && (
            norm(c.companyName || '') === norm(input.buyerName) ||
            norm(c.name) === norm(input.buyerName)
          )) ||
          (input.buyerPersonName && norm(c.name) === norm(input.buyerPersonName))
        );

        const displayName = input.buyerName || input.buyerPersonName || '';
        if (byName.length === 1) {
          matchedCustomer = byName[0];
          if (!input.buyerTax) {
            warnings.push(`Khớp theo tên "${displayName}" (không có MST để xác nhận)`);
          }
        } else if (byName.length > 1) {
          const xmlAddr = norm(input.buyerAddress || '');
          if (xmlAddr) {
            const byAddr = byName.find((c) => norm(c.address || '') === xmlAddr);
            if (byAddr) {
              matchedCustomer = byAddr;
              warnings.push(`Tìm thấy ${byName.length} khách trùng tên "${displayName}" — khớp theo địa chỉ`);
            } else {
              const nameList = byName.map((c, j) => `[${j + 1}] ${c.name}${c.address ? ` — ${c.address}` : ''}`).join('; ');
              warnings.push(`${byName.length} khách trùng tên "${displayName}", địa chỉ XML không khớp — vui lòng chọn thủ công. Hiện có: ${nameList}`);
            }
          } else {
            warnings.push(`${byName.length} khách trùng tên "${displayName}", không có địa chỉ để phân biệt — vui lòng chọn thủ công`);
          }
        }
        // byName.length === 0 → không tìm thấy trong DB, xử lý batch cache bên dưới
      }

      // ── Batch cache: detect cùng khách trong một lần import ──────────────────
      let batchMergeIndex: number | undefined;
      if (!matchedCustomer) {
        const displayName = input.buyerName || input.buyerPersonName || '';
        const cacheKey = input.buyerTax ? norm(input.buyerTax) : norm(displayName);
        if (cacheKey) {
          if (previewCustomerCache.has(cacheKey)) {
            // Đã gặp ở hóa đơn trước trong batch → sẽ merge, không tạo thêm
            batchMergeIndex = previewCustomerCache.get(cacheKey)!;
          } else {
            // Lần đầu trong batch + không có trong DB → sẽ tạo mới
            previewCustomerCache.set(cacheKey, results.length);
            warnings.push(`Khách hàng "${displayName}"${input.buyerTax ? ` (MST: ${input.buyerTax})` : ''} chưa có trong hệ thống — sẽ tạo mới khi import`);
          }
        }
      }

      // Match products O(1): tên + giá giống = cùng SP; tên giống giá khác = SP khác
      const previewItems: PreviewItem[] = input.items.map((item) => {
        const pKey = `${norm(item.xmlName)}:${item.unitPrice}`;
        // 1. Tìm trong DB (O(1) Map lookup)
        let found = productMap.get(pKey);
        // 2. Fallback: giá = 0 → match chỉ theo tên
        if (!found && item.unitPrice === 0) {
          found = productMap.get(`${norm(item.xmlName)}:0`) ||
                  [...productMap.values()].find((p) => norm(p.name) === norm(item.xmlName));
        }

        if (found) {
          return {
            xmlName: item.xmlName, unit: item.unit,
            quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate,
            productId: found.id, productName: found.name,
            willCreate: false, batchNewProduct: false,
          };
        }

        // 3. Không có trong DB — kiểm tra batch cache
        if (previewProductCache.has(pKey)) {
          // Đã gặp trong batch này → merge về cùng product sẽ được tạo
          return {
            xmlName: item.xmlName, unit: item.unit,
            quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate,
            productId: null, productName: null,
            willCreate: true, batchNewProduct: false,
            batchMergeProductKey: pKey,
          };
        }

        // 4. Lần đầu xuất hiện trong batch + không có trong DB → sẽ tạo mới
        previewProductCache.set(pKey, item.xmlName);
        warnings.push(`Sản phẩm "${item.xmlName}" (${item.unitPrice.toLocaleString('vi-VN')} ₫) chưa có trong hệ thống → sẽ tự tạo mới`);
        return {
          xmlName: item.xmlName, unit: item.unit,
          quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate,
          productId: null, productName: null,
          willCreate: true, batchNewProduct: true,
        };
      });

      const isDuplicate = existingCodeSet.has(input.eInvoiceCode);
      if (isDuplicate) warnings.push(`HĐĐT "${input.eInvoiceCode}" đã tồn tại trong hệ thống`);

      results.push({
        eInvoiceCode:   input.eInvoiceCode,
        invoiceDate:    input.invoiceDate,
        buyerName:      input.buyerName,
        buyerPersonName: input.buyerPersonName,
        buyerTax:       input.buyerTax,
        buyerAddress:   input.buyerAddress,
        buyerPhone:     input.buyerPhone,
        grandTotal:     input.grandTotal,
        initialPaid:    input.initialPaid,
        skipInventory:  input.skipInventory,
        customerId:     matchedCustomer?.id ?? null,
        customerName:   matchedCustomer?.name ?? matchedCustomer?.companyName ?? null,
        items:          previewItems,
        warnings,
        isDuplicate,
        batchMergeIndex,
      });
    }

    return results;
  },

  // ── Batch commit (write DB) ─────────────────────────────────────────────────
  async batchCreate(confirmed: ConfirmedXmlInvoice[], createdByUserId?: number): Promise<{ success: number[]; failed: { index: number; eInvoiceCode: string; error: string }[] }> {
    const success: number[] = [];
    const failed: { index: number; eInvoiceCode: string; error: string }[] = [];

    // Cache dedup customer: key = MST hoặc norm(buyerName)
    const batchCustomerCache = new Map<string, number>();
    // Cache dedup product: key = norm(xmlName):unitPrice
    const batchProductCache  = new Map<string, number>();

    for (let i = 0; i < confirmed.length; i++) {
      const inv = confirmed[i];
      try {
        // Duplicate check
        if (inv.eInvoiceCode) {
          const exists = await prisma.invoice.findFirst({ where: { eInvoiceCode: inv.eInvoiceCode } });
          if (exists) throw new Error(`HĐĐT "${inv.eInvoiceCode}" đã tồn tại`);
        }

        // Resolve customer — auto-create nếu null
        let customerId = inv.customerId;
        if (!customerId) {
          const cacheKey = inv.buyerTax ? norm(inv.buyerTax) : norm(inv.buyerName || inv.buyerPersonName || '');
          if (!cacheKey) throw new Error('Thiếu thông tin khách hàng (MST hoặc tên) để tạo mới');

          // 1. Kiểm tra cache của batch này trước
          if (batchCustomerCache.has(cacheKey)) {
            customerId = batchCustomerCache.get(cacheKey)!;
          } else {
            // 2. Tìm lại trong DB (phòng trường hợp đã có từ batch trước hoặc tạo bởi invoice trước)
            let existingCustomer: { id: number } | null = null;
            if (inv.buyerTax) {
              existingCustomer = await prisma.customer.findFirst({
                where: { taxCode: inv.buyerTax },
                select: { id: true },
              });
            }
            if (!existingCustomer && inv.buyerName) {
              existingCustomer = await prisma.customer.findFirst({
                where: { companyName: inv.buyerName },
                select: { id: true },
              });
            }

            if (existingCustomer) {
              customerId = existingCustomer.id;
              // Auto-update address & phone từ HĐĐT (nguồn chính thức)
              // Nếu tìm được bằng MST → luôn update; bằng tên → chỉ update nếu DB đang trống
              const updateData: Record<string, string> = {};
              if (inv.buyerTax) {
                // Matched by MST — update unconditionally
                if (inv.buyerAddress) updateData.address = inv.buyerAddress;
                if (inv.buyerPhone)   updateData.phone   = inv.buyerPhone;
              } else {
                // Matched by name — chỉ fill vào fields đang rỗng
                const existing = await prisma.customer.findUnique({ where: { id: customerId }, select: { address: true, phone: true } });
                if (!existing?.address && inv.buyerAddress) updateData.address = inv.buyerAddress;
                if (!existing?.phone   && inv.buyerPhone)   updateData.phone   = inv.buyerPhone;
              }
              if (Object.keys(updateData).length > 0) {
                await prisma.customer.update({ where: { id: customerId }, data: updateData });
              }
            } else {
              // 3. Thực sự chưa có — tạo mới
              const rawName = inv.buyerPersonName || inv.buyerName || '';
              if (!rawName) throw new Error('Thiếu tên khách hàng để tạo mới');
              const safeName = await uniqueCustomerName(rawName);
              const newCustomer = await prisma.customer.create({
                data: {
                  name: safeName,
                  companyName: inv.buyerName || null,
                  taxCode: inv.buyerTax || null,
                  address: inv.buyerAddress || null,
                  phone:   inv.buyerPhone   || null,
                },
              });
              customerId = newCustomer.id;
            }

            batchCustomerCache.set(cacheKey, customerId);
          }
        }

        // Resolve / auto-create products (chống duplicate trong batch)
        const resolvedItems: InvoiceItemInput[] = [];
        for (const item of inv.items) {
          let productId = item.productId;
          if (!productId) {
            const pKey = `${norm(item.xmlName)}:${item.unitPrice}`;

            if (batchProductCache.has(pKey)) {
              // Đã tạo/tìm thấy trong batch này
              productId = batchProductCache.get(pKey)!;
            } else {
              // Tìm lại trong DB (tên giống + giá giống = cùng SP)
              const existing = await findExistingProduct(item.xmlName, item.unitPrice);
              if (existing) {
                productId = existing.id;
              } else {
                // Thực sự chưa có → tạo mới
                const newProduct = await autoCreateProduct(item.xmlName, item.unit, item.unitPrice, item.taxRate);
                productId = newProduct.id;
              }
              batchProductCache.set(pKey, productId);
            }
          }
          resolvedItems.push({
            productId,
            quantity: item.quantity,
            price: item.unitPrice,
            taxRate: item.taxRate,
          });
        }

        const invoice = await invoiceService.create({
          customerId,
          items: resolvedItems,
          eInvoiceCode: inv.eInvoiceCode,
          invoiceDate: inv.invoiceDate,
          totalAmountOverride: inv.grandTotal,
          initialPaid: inv.initialPaid,
          skipInventory: inv.skipInventory,
          createdByUserId,
        });
        success.push(invoice.id);
      } catch (err: any) {
        failed.push({ index: i, eInvoiceCode: inv.eInvoiceCode, error: err.message });
        writeLog({
          action:  'error',
          module:  'invoice',
          message: `Import XML thất bại — HĐĐT: ${inv.eInvoiceCode || `#${i + 1}`} — ${err.message}`,
          level:   'error',
          userId:  createdByUserId,
        });
      }
    }

    writeLog({
      action:  'create',
      module:  'invoice',
      message: `Import XML batch: ${success.length} thành công${failed.length > 0 ? `, ${failed.length} thất bại (${failed.map((f) => f.eInvoiceCode || `#${f.index + 1}`).join(', ')})` : ''}`,
      level:   failed.length > 0 ? 'warning' : 'info',
      userId:  createdByUserId,
    });

    return { success, failed };
  },

  // ── Cancel ──────────────────────────────────────────────────────────────────
  async cancel(id: number) {
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice) throw new Error('Không tìm thấy hóa đơn');
    if (invoice.status === 'cancelled') throw new Error('Hóa đơn đã bị hủy rồi');

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id }, data: { status: 'cancelled' } });

      for (const item of invoice.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        await tx.inventoryLog.create({
          data: { productId: item.productId, type: 'in', quantity: item.quantity, reason: 'cancel', refId: id },
        });
      }

      const remaining = invoice.totalAmount - invoice.paidAmount;
      if (remaining > 0) {
        await tx.customer.update({ where: { id: invoice.customerId }, data: { debt: { decrement: remaining } } });
      }

      await tx.cashflow.deleteMany({ where: { refId: id, refType: 'invoice' } });
    });
  },

  // ── Delete ──────────────────────────────────────────────────────────────────
  async delete(id: number) {
    await prisma.$transaction(async (tx) => {
      await tx.cashflow.deleteMany({ where: { refId: id, refType: 'invoice' } });
      await tx.payment.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.inventoryLog.deleteMany({ where: { refId: id } });
      await tx.invoice.delete({ where: { id } });
    });
  },
};
