import prisma from '../../utils/prisma';

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
  skipInventory?: boolean; // true = không trừ tồn kho (import hồi tố)
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
  buyerName: string;
  buyerTax: string;
  grandTotal: number;   // TgTTTBSo — tổng có VAT
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
  willCreate: boolean; // true = sẽ tự tạo product mới
};

export type InvoicePreview = {
  eInvoiceCode: string;
  invoiceDate: string;
  buyerName: string;
  buyerTax: string;
  grandTotal: number;
  initialPaid: number;
  skipInventory: boolean;
  customerId: number | null;
  customerName: string | null;
  items: PreviewItem[];
  warnings: string[];
  isDuplicate: boolean;
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
  customerId: number;
  grandTotal: number;
  initialPaid: number;
  skipInventory: boolean;
  items: ConfirmedXmlItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

async function resolveProduct(xmlName: string, unit: string, unitPrice: number, taxRate: string) {
  const all = await prisma.product.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
  });
  // 1. Exact match
  let found = all.find((p) => norm(p.name) === norm(xmlName));
  // 2. Contains match
  if (!found) found = all.find((p) => norm(p.name).includes(norm(xmlName)) || norm(xmlName).includes(norm(p.name)));
  return found ?? null;
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
      include: { customer: true, items: { include: { product: true } } },
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
      select: { id: true, name: true, companyName: true, taxCode: true },
    });

    // Load products một lần
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
    });

    // Kiểm tra eInvoiceCode đã tồn tại
    const existingCodes = await prisma.invoice.findMany({
      where: { eInvoiceCode: { in: inputs.map((i) => i.eInvoiceCode).filter(Boolean) } },
      select: { eInvoiceCode: true },
    });
    const existingCodeSet = new Set(existingCodes.map((e) => e.eInvoiceCode));

    const results: InvoicePreview[] = [];

    for (const input of inputs) {
      const warnings: string[] = [];

      // Match customer
      let matchedCustomer = customers.find((c) => c.taxCode && norm(c.taxCode) === norm(input.buyerTax));
      if (!matchedCustomer) {
        matchedCustomer = customers.find((c) =>
          norm(c.companyName || '') === norm(input.buyerName) ||
          norm(c.name) === norm(input.buyerName)
        );
      }
      if (!matchedCustomer) warnings.push(`Không tìm thấy khách hàng "${input.buyerName}" (MST: ${input.buyerTax})`);

      // Match products
      const previewItems: PreviewItem[] = input.items.map((item) => {
        // Exact match first
        let found = products.find((p) => norm(p.name) === norm(item.xmlName));
        // Contains match
        if (!found) found = products.find((p) =>
          norm(p.name).includes(norm(item.xmlName)) || norm(item.xmlName).includes(norm(p.name))
        );
        if (!found) warnings.push(`Sản phẩm "${item.xmlName}" chưa có trong hệ thống → sẽ tự tạo mới`);
        return {
          xmlName: item.xmlName,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          productId: found?.id ?? null,
          productName: found?.name ?? null,
          willCreate: !found,
        };
      });

      const isDuplicate = existingCodeSet.has(input.eInvoiceCode);
      if (isDuplicate) warnings.push(`HĐĐT "${input.eInvoiceCode}" đã tồn tại trong hệ thống`);

      results.push({
        eInvoiceCode: input.eInvoiceCode,
        invoiceDate: input.invoiceDate,
        buyerName: input.buyerName,
        buyerTax: input.buyerTax,
        grandTotal: input.grandTotal,
        initialPaid: input.initialPaid,
        skipInventory: input.skipInventory,
        customerId: matchedCustomer?.id ?? null,
        customerName: matchedCustomer?.name ?? matchedCustomer?.companyName ?? null,
        items: previewItems,
        warnings,
        isDuplicate,
      });
    }

    return results;
  },

  // ── Batch commit (write DB) ─────────────────────────────────────────────────
  async batchCreate(confirmed: ConfirmedXmlInvoice[]): Promise<{ success: number[]; failed: { index: number; eInvoiceCode: string; error: string }[] }> {
    const success: number[] = [];
    const failed: { index: number; eInvoiceCode: string; error: string }[] = [];

    for (let i = 0; i < confirmed.length; i++) {
      const inv = confirmed[i];
      try {
        // Duplicate check
        if (inv.eInvoiceCode) {
          const exists = await prisma.invoice.findFirst({ where: { eInvoiceCode: inv.eInvoiceCode } });
          if (exists) throw new Error(`HĐĐT "${inv.eInvoiceCode}" đã tồn tại`);
        }

        // Resolve / auto-create products
        const resolvedItems: InvoiceItemInput[] = [];
        for (const item of inv.items) {
          let productId = item.productId;
          if (!productId) {
            const newProduct = await autoCreateProduct(item.xmlName, item.unit, item.unitPrice, item.taxRate);
            productId = newProduct.id;
          }
          resolvedItems.push({
            productId,
            quantity: item.quantity,
            price: item.unitPrice,
            taxRate: item.taxRate,
          });
        }

        const invoice = await invoiceService.create({
          customerId: inv.customerId,
          items: resolvedItems,
          eInvoiceCode: inv.eInvoiceCode,
          invoiceDate: inv.invoiceDate,
          totalAmountOverride: inv.grandTotal,
          initialPaid: inv.initialPaid,
          skipInventory: inv.skipInventory,
        });
        success.push(invoice.id);
      } catch (err: any) {
        failed.push({ index: i, eInvoiceCode: inv.eInvoiceCode, error: err.message });
      }
    }

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
      await tx.payment.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.inventoryLog.deleteMany({ where: { refId: id, reason: 'cancel' } });
      await tx.invoice.delete({ where: { id } });
    });
  },
};
