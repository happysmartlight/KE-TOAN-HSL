import EmptyState from '../components/EmptyState';
import MoneyInput from '../components/MoneyInput';
import { phoneError } from '../utils/validate';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEscKey } from '../hooks/useKeyboard';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import SearchSelect from '../components/SearchSelect';
import { toast } from '../components/Toast';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');
const STATUS: Record<string, { label: string; cls: string }> = {
  unpaid:    { label: 'Chưa TT',  cls: 'red' },
  partial:   { label: 'Một phần', cls: 'yellow' },
  paid:      { label: 'Đã TT',    cls: 'green' },
  cancelled: { label: 'Đã hủy',   cls: 'red' },
};
const TAX_OPTIONS = ['0%', '5%', '8%', '10%', 'KCT'];

const emptyNewCustomer = { name: '', phone: '', companyName: '', taxCode: '' };

// ─── XML parsing ─────────────────────────────────────────────────────────────
type XmlItem = {
  xmlName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: string;
  productId: string;
};
type XmlPreview = {
  invoiceDate: string;
  eInvoiceCode: string;
  buyerName: string;        // Ten — tên công ty
  buyerPersonName: string;  // HVTNMHang — tên người đại diện
  buyerTax: string;
  buyerAddress: string;
  buyerPhone: string;       // SDThoai — số điện thoại
  xmlItems: XmlItem[];
  preTaxTotal: number;
  vatTotal: number;
  grandTotal: number;
  customerId: string;
  paidAmount: string;
};

// Batch import types
type BatchPreviewItem = {
  xmlName: string; unit: string; quantity: number;
  unitPrice: number; taxRate: string;
  productId: number | null; productName: string | null;
  willCreate: boolean;
  batchNewProduct: boolean;       // true = tạo mới (lần đầu trong batch, chưa có trong DB)
  batchMergeProductKey?: string;  // defined = sẽ merge vào SP đã xuất hiện trước trong batch
};
type BatchPreview = {
  eInvoiceCode: string; invoiceDate: string;
  buyerName: string;        // Ten — tên công ty
  buyerPersonName?: string; // HVTNMHang — tên người đại diện
  buyerTax: string; buyerAddress: string; buyerPhone?: string;
  grandTotal: number; initialPaid: number; skipInventory: boolean;
  customerId: number | null; customerName: string | null;
  items: BatchPreviewItem[];
  warnings: string[]; isDuplicate: boolean;
  batchMergeIndex?: number; // index hóa đơn trong batch đã resolve KH này lần đầu
  // UI state
  selected: boolean; paidAmount: string;
};

function parseXMLInvoice(xmlText: string): Omit<XmlPreview, 'customerId' | 'paidAmount'> {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const t = (root: Document | Element, tag: string): string =>
    root.getElementsByTagName(tag)[0]?.textContent?.trim() || '';

  const invoiceDate  = t(doc, 'NLap');
  const eInvoiceCode = `${t(doc, 'KHHDon')}-${t(doc, 'SHDon')}`;

  const nMua           = doc.getElementsByTagName('NMua')[0];
  const buyerName      = nMua ? t(nMua, 'Ten') : '';           // tên công ty
  const buyerPersonName = nMua ? t(nMua, 'HVTNMHang') : '';   // tên người đại diện
  const buyerTax       = nMua ? t(nMua, 'MST') : '';
  const buyerAddress   = nMua ? t(nMua, 'DChi') : '';
  const buyerPhone     = nMua ? (t(nMua, 'SDThoai') || t(nMua, 'DThoai') || t(nMua, 'SoDienThoai')) : '';

  const xmlItems: XmlItem[] = Array.from(doc.getElementsByTagName('HHDVu')).map(el => ({
    xmlName:   t(el, 'THHDVu'),
    unit:      t(el, 'DVTinh'),
    quantity:  Number(t(el, 'SLuong')) || 1,
    unitPrice: Number(t(el, 'DGia'))   || 0,
    taxRate:   t(el, 'TSuat') || '10%',
    productId: '',
  }));

  const preTaxTotal = Number(t(doc, 'TgTCThue')) || 0;
  const vatTotal    = Number(t(doc, 'TgTThue'))  || 0;
  const grandTotal  = Number(t(doc, 'TgTTTBSo')) || 0;

  return { invoiceDate, eInvoiceCode, buyerName, buyerPersonName, buyerTax, buyerAddress, buyerPhone, xmlItems, preTaxTotal, vatTotal, grandTotal };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Invoices() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows]           = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts]   = useState<any[]>([]);
  const [open, setOpen]           = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [note, setNote]           = useState('');
  const [items, setItems]         = useState([{ productId: '', quantity: 1, price: 0, taxRate: '10%' }]);
  const [payModal, setPayModal]   = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [confirmModal, setConfirmModal] = useState<null | { type: 'cancel' | 'delete'; inv: any }>(null);
  const [detailInv, setDetailInv] = useState<any>(null);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);

  // Inline new customer
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState(emptyNewCustomer);
  const [ncTaxLoading, setNcTaxLoading] = useState(false);
  const [ncTaxError, setNcTaxError] = useState('');
  const ncTaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // XML import (single)
  const [xmlModal, setXmlModal] = useState<XmlPreview | null>(null);
  const xmlFileRef = useRef<HTMLInputElement>(null);

  // Batch XML import
  const batchFileRef = useRef<HTMLInputElement>(null);
  const [batchPreviews, setBatchPreviews]   = useState<BatchPreview[] | null>(null);
  const [batchLoading, setBatchLoading]     = useState(false);
  const [batchResult, setBatchResult]       = useState<{ success: number; failed: { eInvoiceCode: string; error: string }[] } | null>(null);
  const [batchSkipInventory, setBatchSkipInventory] = useState(true);
  const [expandedRows, setExpandedRows]     = useState<Set<number>>(new Set());

  // ESC: đóng modal/panel trong → ngoài (sau tất cả useState)
  useEscKey(
    detailInv       ? () => setDetailInv(null) :
    payModal        ? () => { setPayModal(null); setPayAmount(''); } :
    showNewCustomer ? () => setShowNewCustomer(false) :
    open            ? () => setOpen(false) : null
  );

  const loadCustomers = () => api.get('/customers').then((r) => setCustomers(r.data));
  const load = () => api.get('/invoices').then((r) => setRows(r.data));
  useEffect(() => {
    load();
    loadCustomers();
    api.get('/products').then((r) => setProducts(r.data));
  }, []);

  // ── Form items ─────────────────────────────────────────────────────────────
  const addItem = () => setItems([...items, { productId: '', quantity: 1, price: 0, taxRate: '10%' }]);
  const updateItem = (i: number, field: string, val: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = val;
    if (field === 'productId') {
      const p = products.find((p) => p.id === Number(val));
      if (p) {
        updated[i].price   = p.sellingPrice;
        updated[i].taxRate = p.taxRate || '10%';
      }
    }
    setItems(updated);
  };
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.price), 0);

  // ── New customer inline ────────────────────────────────────────────────────
  const handleNcTaxCode = (val: string) => {
    setNewCustomer((f) => ({ ...f, taxCode: val }));
    setNcTaxError('');
    if (ncTaxTimerRef.current) clearTimeout(ncTaxTimerRef.current);
    if (val.trim().length >= 10) {
      ncTaxTimerRef.current = setTimeout(async () => {
        setNcTaxLoading(true);
        try {
          const { data } = await api.get(`/customers/tax-lookup/${val.trim()}`);
          setNewCustomer((f) => ({ ...f, companyName: f.companyName || data.name || '' }));
        } catch (err: any) {
          setNcTaxError(err.response?.data?.error || 'Không tìm thấy MST');
        } finally { setNcTaxLoading(false); }
      }, 800);
    }
  };

  const saveNewCustomer = async () => {
    if (!newCustomer.name.trim()) { toast.warn('Vui lòng nhập tên khách hàng'); return; }
    try {
      const { data } = await api.post('/customers', newCustomer);
      await loadCustomers();
      setCustomerId(String(data.id));
      setShowNewCustomer(false); setNewCustomer(emptyNewCustomer); setNcTaxError('');
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi khi thêm khách hàng'); }
  };

  // ── Submit regular invoice ─────────────────────────────────────────────────
  const submitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/invoices', {
        customerId: Number(customerId),
        note,
        items: items.map((i) => ({
          productId: Number(i.productId),
          quantity:  Number(i.quantity),
          price:     Number(i.price),
          taxRate:   i.taxRate || '10%',
        })),
      });
      setOpen(false);
      setItems([{ productId: '', quantity: 1, price: 0, taxRate: '10%' }]);
      setCustomerId(''); setNote(''); setShowNewCustomer(false);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  // ── Payment ────────────────────────────────────────────────────────────────
  const submitPayment = async () => {
    try {
      await api.post('/payments', { invoiceId: payModal.id, amount: Number(payAmount) });
      setPayModal(null); setPayAmount(''); load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  // ── Cancel / Delete ────────────────────────────────────────────────────────
  const doCancel = async (inv: any) => {
    try { await api.patch(`/invoices/${inv.id}/cancel`); setConfirmModal(null); load(); }
    catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi khi hủy'); }
  };
  const doDelete = async (inv: any) => {
    try { await api.delete(`/invoices/${inv.id}`); setConfirmModal(null); load(); }
    catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi khi xóa'); }
  };

  // ── XML import ─────────────────────────────────────────────────────────────
  const autoMatchCustomer = (buyerTax: string, buyerName: string): string => {
    if (buyerTax) {
      const found = customers.find((c) => c.taxCode === buyerTax);
      if (found) return String(found.id);
    }
    const q = buyerName.toLowerCase().trim();
    const found = customers.find(
      (c) => c.name.toLowerCase() === q || (c.companyName && c.companyName.toLowerCase() === q)
    );
    return found ? String(found.id) : '';
  };

  const autoMatchProduct = (xmlName: string): string => {
    const q = xmlName.toLowerCase().trim();
    const p = products.find((p) => p.name.toLowerCase() === q)
           || products.find((p) => q.includes(p.name.toLowerCase().substring(0, 12)));
    return p ? String(p.id) : '';
  };

  const handleXmlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseXMLInvoice(ev.target?.result as string);
        const matchedItems = parsed.xmlItems.map((item) => ({
          ...item,
          productId: autoMatchProduct(item.xmlName),
        }));
        setXmlModal({
          ...parsed,
          xmlItems: matchedItems,
          customerId: autoMatchCustomer(parsed.buyerTax, parsed.buyerName),
          paidAmount: '0',
        });
      } catch { toast.error('Không đọc được file XML. Kiểm tra lại format.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const submitXmlImport = async () => {
    if (!xmlModal) return;
    if (!xmlModal.customerId) { toast.warn('Vui lòng chọn khách hàng'); return; }
    const unmatched = xmlModal.xmlItems.filter((i) => !i.productId);
    if (unmatched.length > 0) {
      toast.warn(`${unmatched.length} sản phẩm chưa khớp: ${unmatched.map((i) => i.xmlName).join(', ')} — vui lòng chọn sản phẩm tương ứng.`);
      return;
    }
    try {
      await api.post('/invoices', {
        customerId:           Number(xmlModal.customerId),
        eInvoiceCode:         xmlModal.eInvoiceCode,
        invoiceDate:          xmlModal.invoiceDate,
        totalAmountOverride:  xmlModal.grandTotal,
        initialPaid:          Number(xmlModal.paidAmount) || 0,
        items: xmlModal.xmlItems.map((i) => ({
          productId: Number(i.productId),
          quantity:  i.quantity,
          price:     i.unitPrice,
          taxRate:   i.taxRate,
        })),
      });
      setXmlModal(null); load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi khi nhập hóa đơn'); }
  };

  // ── Batch XML import ───────────────────────────────────────────────────────
  const handleBatchXmlFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setBatchLoading(true); setBatchResult(null);

    // Parse tất cả files locally
    const parsed = await Promise.all(files.map((file) =>
      new Promise<any>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const p = parseXMLInvoice(ev.target?.result as string);
            resolve({
              eInvoiceCode:   p.eInvoiceCode,
              invoiceDate:    p.invoiceDate,
              buyerName:      p.buyerName,
              buyerPersonName: p.buyerPersonName,
              buyerTax:       p.buyerTax,
              buyerAddress:   p.buyerAddress,
              buyerPhone:     p.buyerPhone,
              grandTotal:     p.grandTotal,
              initialPaid:    0,
              skipInventory:  batchSkipInventory,
              items:          p.xmlItems,
            });
          } catch { resolve(null); }
        };
        reader.readAsText(file);
      })
    ));

    const valid = parsed.filter(Boolean);
    if (!valid.length) { setBatchLoading(false); toast.error('Không đọc được file XML nào.'); return; }

    try {
      const { data } = await api.post('/invoices/xml-preview', { invoices: valid });
      setBatchPreviews((data as any[]).map((p) => ({
        ...p,
        selected: !p.isDuplicate,
        paidAmount: String(p.grandTotal), // mặc định 100%
      })));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Lỗi khi preview');
    } finally { setBatchLoading(false); }
  };

  const submitBatchImport = async () => {
    if (!batchPreviews) return;
    // Cho phép customerId = null → backend sẽ tự tạo customer mới
    const selected = batchPreviews.filter((p) => p.selected && !p.isDuplicate);
    if (!selected.length) { toast.warn('Không có hóa đơn nào hợp lệ được chọn.'); return; }

    setBatchLoading(true);
    try {
      const { data } = await api.post('/invoices/xml-batch', {
        invoices: selected.map((p) => ({
          eInvoiceCode:   p.eInvoiceCode,
          invoiceDate:    p.invoiceDate,
          customerId:     p.customerId,
          buyerName:      p.buyerName,
          buyerPersonName: p.buyerPersonName,
          buyerTax:       p.buyerTax,
          buyerAddress:   p.buyerAddress,
          buyerPhone:     p.buyerPhone,
          grandTotal:     p.grandTotal,
          initialPaid:    Number(p.paidAmount) || 0,
          skipInventory:  p.skipInventory,
          items: p.items.map((item) => ({
            productId:  item.productId,
            xmlName:    item.xmlName,
            unit:       item.unit,
            quantity:   item.quantity,
            unitPrice:  item.unitPrice,
            taxRate:    item.taxRate,
          })),
        })),
      });
      setBatchResult({ success: data.success.length, failed: data.failed });
      setBatchPreviews(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Lỗi khi import batch');
    } finally { setBatchLoading(false); }
  };

  const toggleExpandRow = (i: number) => setExpandedRows((prev) => {
    const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s;
  });

  // ── Filter / sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((inv) =>
        inv.code?.toLowerCase().includes(q) ||
        inv.eInvoiceCode?.toLowerCase().includes(q) ||
        inv.customer?.name?.toLowerCase().includes(q) ||
        inv.customer?.phone?.toLowerCase().includes(q) ||
        inv.customer?.taxCode?.toLowerCase().includes(q) ||
        inv.customer?.companyName?.toLowerCase().includes(q)
      );
    }
    if (filter.status)    r = r.filter((inv) => inv.status === filter.status);
    if (filter.dateFrom)  r = r.filter((inv) => new Date(inv.invoiceDate ?? inv.createdAt) >= new Date(filter.dateFrom));
    if (filter.dateTo)    r = r.filter((inv) => new Date(inv.invoiceDate ?? inv.createdAt) <= new Date(filter.dateTo + 'T23:59:59'));
    if (filter.amountMin) r = r.filter((inv) => inv.totalAmount >= Number(filter.amountMin));
    if (filter.amountMax) r = r.filter((inv) => inv.totalAmount <= Number(filter.amountMax));
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'amount')   return dir * (a.totalAmount - b.totalAmount);
      if (filter.sortBy === 'customer') return dir * (a.customer?.name || '').localeCompare(b.customer?.name || '');
      const dateA = new Date(a.invoiceDate ?? a.createdAt).getTime();
      const dateB = new Date(b.invoiceDate ?? b.createdAt).getTime();
      return dir * (dateA - dateB);
    });
    return r;
  }, [rows, filter]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hidden file inputs */}
      <input ref={xmlFileRef} type="file" accept=".xml,text/xml" style={{ display: 'none' }} onChange={handleXmlFile} />
      <input ref={batchFileRef} type="file" accept=".xml,text/xml" multiple style={{ display: 'none' }} onChange={handleBatchXmlFiles} />

      <div className="page-header">
        <h1 className="page-title">Hóa đơn bán</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => xmlFileRef.current?.click()}>📄 Import XML</button>
          <button className="btn ghost" onClick={() => { setBatchResult(null); batchFileRef.current?.click(); }} disabled={batchLoading}>
            {batchLoading ? '⏳ Đang xử lý...' : '📦 Import batch XML'}
          </button>
          <button className="btn cyan" onClick={() => { setOpen(!open); setShowNewCustomer(false); }}>+ Tạo hóa đơn</button>
        </div>
      </div>

      {/* Batch result banner */}
      {batchResult && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 6, background: batchResult.failed.length ? 'rgba(255,80,80,0.08)' : 'rgba(0,255,128,0.08)', border: `1px solid ${batchResult.failed.length ? 'rgba(255,80,80,0.3)' : 'rgba(0,255,128,0.3)'}`, fontSize: 13 }}>
          <span className="c-green fw7">✓ {batchResult.success} hóa đơn đã import</span>
          {batchResult.failed.length > 0 && (
            <span className="c-red" style={{ marginLeft: 16 }}>
              ✗ {batchResult.failed.length} lỗi: {batchResult.failed.map((f) => `${f.eInvoiceCode} (${f.error})`).join(', ')}
            </span>
          )}
          <button className="btn ghost btn-sm" style={{ marginLeft: 16 }} onClick={() => setBatchResult(null)}>✕</button>
        </div>
      )}

      {/* ── Form tạo hóa đơn thủ công ── */}
      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submitInvoice}>
            <div className="fg2" style={{ marginBottom: 8 }}>
              <div>
                <label className="lbl">Khách hàng *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <SearchSelect
                    style={{ flex: 1 }} required
                    value={customerId}
                    onChange={(v) => { setCustomerId(v); setShowNewCustomer(false); }}
                    placeholder="-- Tìm khách hàng --"
                    options={customers.map((c) => ({
                      value: String(c.id), label: c.name,
                      sublabel: c.companyName || undefined,
                      meta: [c.phone, c.debt > 0 ? `Nợ: ${c.debt.toLocaleString('vi-VN')} ₫` : ''].filter(Boolean).join(' · ') || undefined,
                    }))}
                  />
                  <button type="button" className={`btn btn-sm ${showNewCustomer ? 'yellow' : 'ghost'}`}
                    onClick={() => setShowNewCustomer((v) => !v)}>
                    {showNewCustomer ? '✕' : '+ KH mới'}
                  </button>
                </div>
                {customerId && !showNewCustomer && (() => {
                  const c = customers.find((x) => String(x.id) === customerId);
                  return c ? (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(0,180,255,0.05)', borderRadius: 4, border: '1px solid rgba(0,180,255,0.15)', fontSize: 11 }}>
                      {c.companyName && <span className="c-dim">{c.companyName} · </span>}
                      {c.taxCode && <span className="c-dim">MST: {c.taxCode} · </span>}
                      {c.phone && <span className="c-dim">{c.phone}</span>}
                      {c.debt > 0 && <span className="c-red fw7" style={{ marginLeft: 8 }}>Nợ: {fmt(c.debt)}</span>}
                    </div>
                  ) : null;
                })()}
              </div>
              <div><label className="lbl">Ghi chú</label><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>

            {showNewCustomer && (
              <div style={{ marginBottom: 12, padding: '12px 14px', background: 'rgba(255,200,0,0.04)', borderRadius: 6, border: '1px solid rgba(255,200,0,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow)', marginBottom: 10 }}>+ Thêm khách hàng mới</div>
                <div className="fg2" style={{ marginBottom: 8 }}>
                  <div><label className="lbl">Tên KH *</label><input className="inp" value={newCustomer.name} placeholder="Nguyễn Văn A" onChange={(e) => setNewCustomer((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div><label className="lbl">Số điện thoại</label>
                    <input className="inp" value={newCustomer.phone} placeholder="0901..." onChange={(e) => setNewCustomer((f) => ({ ...f, phone: e.target.value }))} />
                    {phoneError(newCustomer.phone) && <span style={{ fontSize: 10, color: 'var(--red)' }}>{phoneError(newCustomer.phone)}</span>}
                  </div>
                </div>
                <div className="fg2" style={{ marginBottom: 8 }}>
                  <div>
                    <label className="lbl">MST {ncTaxLoading && <span className="c-dim">⏳</span>}</label>
                    <input className="inp" value={newCustomer.taxCode} placeholder="0123456789 (tự động điền)" onChange={(e) => handleNcTaxCode(e.target.value)} />
                    {ncTaxError && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>✗ {ncTaxError}</div>}
                  </div>
                  <div><label className="lbl">Tên công ty</label><input className="inp" value={newCustomer.companyName} placeholder="Tự điền từ MST hoặc nhập tay" onChange={(e) => setNewCustomer((f) => ({ ...f, companyName: e.target.value }))} /></div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn cyan btn-sm" onClick={saveNewCustomer}>[ Lưu & chọn ]</button>
                  <button type="button" className="btn ghost btn-sm" onClick={() => { setShowNewCustomer(false); setNewCustomer(emptyNewCustomer); }}>[ Hủy ]</button>
                </div>
              </div>
            )}

            <div className="table-wrap mb-12">
              <table className="nt">
                <thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thuế</th><th>Thành tiền</th><th></th></tr></thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <SearchSelect
                          value={item.productId}
                          onChange={(v) => updateItem(i, 'productId', v)}
                          placeholder="-- Chọn sản phẩm --"
                          options={products.map((p) => ({
                            value: String(p.id), label: p.name,
                            sublabel: p.sku || undefined,
                            meta: `Tồn: ${p.stock} ${p.unit} · VAT: ${p.taxRate || '10%'}`,
                            disabled: p.stock <= 0,
                          }))}
                        />
                      </td>
                      <td><input className="inp" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} style={{ width: 70 }} /></td>
                      <td><MoneyInput value={item.price} onChange={(v) => updateItem(i, 'price', v)} style={{ width: 120 }} /></td>
                      <td>
                        <select className="inp" value={item.taxRate} onChange={(e) => updateItem(i, 'taxRate', e.target.value)} style={{ width: 80 }}>
                          {TAX_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="c-cyan fw7">{fmt(Number(item.quantity) * Number(item.price))}</td>
                      <td>{items.length > 1 && <button type="button" className="btn red btn-sm" onClick={() => removeItem(i)}>×</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={addItem}>+ Thêm dòng</button>
                <button type="submit" className="btn cyan">[ Tạo hóa đơn ]</button>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>Tổng: {fmt(total)}</div>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter / Sort ── */}
      <FilterBar
        value={filter} onChange={setFilter}
        totalCount={rows.length} resultCount={filtered.length}
        searchPlaceholder="Tìm mã HĐ, HĐĐT, tên KH, MST..."
        statusOptions={[
          { value: 'unpaid',    label: 'Chưa TT' },
          { value: 'partial',   label: 'Một phần' },
          { value: 'paid',      label: 'Đã TT' },
          { value: 'cancelled', label: 'Đã hủy' },
        ]}
        sortOptions={[
          { value: 'date_desc',     label: '↓ Ngày mới nhất' },
          { value: 'date_asc',      label: '↑ Ngày cũ nhất' },
          { value: 'amount_desc',   label: '↓ Tiền nhiều nhất' },
          { value: 'amount_asc',    label: '↑ Tiền ít nhất' },
          { value: 'customer_asc',  label: 'A→Z Tên khách hàng' },
          { value: 'customer_desc', label: 'Z→A Tên khách hàng' },
        ]}
      />

      {/* ── Bảng hóa đơn ── */}
      <div className="table-wrap">
        <table className="nt">
          <thead><tr><th>Mã HĐ</th><th>Ngày lập</th><th>Khách hàng</th><th>Tổng tiền</th><th>Đã thu</th><th>Còn nợ</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr className="empty-row"><td colSpan={8}>
                <EmptyState icon="🧾" title={rows.length === 0 ? 'Chưa có hóa đơn' : 'Không tìm thấy kết quả'}
                  description={rows.length === 0 ? 'Tạo hóa đơn đầu tiên hoặc import XML.' : 'Thử thay đổi từ khóa hoặc bộ lọc.'} />
              </td></tr>
            )}

            {filtered.map((inv) => {
              const s = STATUS[inv.status] || STATUS.unpaid;
              const remaining = inv.totalAmount - inv.paidAmount;
              const isCancelled = inv.status === 'cancelled';
              return (
                <tr key={inv.id}>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}>
                    <div className="c-cyan">{inv.code}</div>
                    {inv.eInvoiceCode && <div style={{ fontSize: 10, color: 'var(--yellow)', marginTop: 1 }}>HĐĐT: {inv.eInvoiceCode}</div>}
                  </td>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}>
                    {fmtDate(inv.invoiceDate ?? inv.createdAt)}
                    {inv.createdByUser && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>👤 {inv.createdByUser.name}</div>}
                  </td>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}>
                    <div className="c-bright">{inv.customer?.name}</div>
                    {inv.customer?.companyName && <div className="c-dim" style={{ fontSize: 10 }}>{inv.customer.companyName}</div>}
                  </td>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}>{fmt(inv.totalAmount)}</td>
                  <td className="c-green" style={isCancelled ? { opacity: 0.45 } : {}}>{fmt(inv.paidAmount)}</td>
                  <td className={`fw7 ${remaining > 0 && !isCancelled ? 'c-red' : 'c-dim'}`} style={isCancelled ? { opacity: 0.45 } : {}}>{fmt(remaining)}</td>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}><span className={`tag ${s.cls}`}>{s.label}</span></td>
                  <td><div className="td-act">
                    <button className="btn ghost btn-sm" onClick={() => setDetailInv(inv)}>Chi tiết</button>
                    {!isCancelled && inv.status !== 'paid' && (
                      <button className="btn green btn-sm" onClick={() => { setPayModal(inv); setPayAmount(String(remaining)); }}>Thu tiền</button>
                    )}
                    {isAdmin && !isCancelled && (
                      <button className="btn red btn-sm" onClick={() => setConfirmModal({ type: 'cancel', inv })}>Hủy</button>
                    )}
                    {isAdmin && isCancelled && (
                      <button className="btn red btn-sm" onClick={() => setConfirmModal({ type: 'delete', inv })}>Xóa</button>
                    )}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Confirm modals ── */}
      {confirmModal?.type === 'cancel' && (
        <ConfirmModal
          title={`Hủy hóa đơn ${confirmModal.inv.code}`}
          message={`Hóa đơn sẽ chuyển sang trạng thái "Đã hủy". Tồn kho và công nợ sẽ được hoàn lại tự động.`}
          warning={confirmModal.inv.paidAmount > 0 ? `Hóa đơn đã thu ${fmt(confirmModal.inv.paidAmount)} — phần tiền này cần xử lý hoàn trả thủ công.` : undefined}
          confirmLabel="Xác nhận hủy"
          onConfirm={() => doCancel(confirmModal.inv)}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {confirmModal?.type === 'delete' && (
        <ConfirmModal
          title={`Xóa vĩnh viễn hóa đơn ${confirmModal.inv.code}`}
          message="Hóa đơn và toàn bộ dữ liệu liên quan sẽ bị xóa khỏi hệ thống."
          warning="Hành động này không thể hoàn tác."
          confirmLabel="Xóa vĩnh viễn"
          onConfirm={() => doDelete(confirmModal.inv)}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* ── Thu tiền modal ── */}
      {payModal && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-title">◈ Thu tiền — {payModal.code}</div>
            <div className="report-row" style={{ marginBottom: 14 }}>
              <span className="lbl-r">Còn nợ</span>
              <span className="c-red fw7">{fmt(payModal.totalAmount - payModal.paidAmount)}</span>
            </div>
            <label className="lbl">Số tiền thu</label>
            <MoneyInput value={payAmount} onChange={(v) => setPayAmount(String(v))} style={{ marginBottom: 14 }} />
            <div className="form-actions">
              <button className="btn green" onClick={submitPayment}>[ Xác nhận ]</button>
              <button className="btn ghost" onClick={() => setPayModal(null)}>[ Hủy ]</button>
            </div>
          </div>
        </div>
      )}

      {/* ── XML Import Modal ── */}
      {xmlModal && (
        <div className="modal-bg" onClick={() => setXmlModal(null)}>
          <div className="modal" style={{ maxWidth: 740, maxHeight: '90vh', overflowY: 'auto', width: '95vw' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">📄 Import hóa đơn XML</div>

            {/* Header info */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, padding: '8px 12px', background: 'rgba(0,245,255,0.04)', borderRadius: 6, border: '1px solid rgba(0,245,255,0.12)', fontSize: 11 }}>
              <div><span className="c-dim">HĐĐT: </span><span className="c-cyan fw7">{xmlModal.eInvoiceCode}</span></div>
              <div><span className="c-dim">Ngày lập: </span><span className="c-bright">{xmlModal.invoiceDate}</span></div>
              <div><span className="c-dim">Người mua: </span><span className="c-bright">{xmlModal.buyerName}</span></div>
              {xmlModal.buyerTax && <div><span className="c-dim">MST: </span><span className="c-cyan">{xmlModal.buyerTax}</span></div>}
            </div>

            {/* Customer match */}
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">Khách hàng trong hệ thống *</label>
              {!xmlModal.customerId && <div style={{ fontSize: 10, color: 'var(--yellow)', marginBottom: 4 }}>⚠ Không tìm thấy khớp tự động — vui lòng chọn thủ công</div>}
              {xmlModal.customerId && <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 4 }}>✓ Tìm thấy khớp tự động</div>}
              <SearchSelect
                value={xmlModal.customerId}
                onChange={(v) => setXmlModal((m) => m && ({ ...m, customerId: v }))}
                placeholder="-- Chọn khách hàng --"
                options={customers.map((c) => ({
                  value: String(c.id), label: c.name,
                  sublabel: c.taxCode ? `MST: ${c.taxCode}` : c.companyName || undefined,
                }))}
              />
            </div>

            {/* Items table */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', letterSpacing: 1, marginBottom: 6 }}>// DANH SÁCH HÀNG HÓA</div>
            <div className="table-wrap mb-12">
              <table className="nt">
                <thead>
                  <tr>
                    <th style={{ minWidth: 160 }}>Tên hàng (XML)</th>
                    <th style={{ minWidth: 180 }}>Sản phẩm hệ thống</th>
                    <th>ĐVT</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>Thuế</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {xmlModal.xmlItems.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 10, color: 'var(--c-dim)', maxWidth: 180, wordBreak: 'break-word' }}>{item.xmlName}</td>
                      <td>
                        <SearchSelect
                          value={item.productId}
                          onChange={(v) => {
                            const updated = [...xmlModal.xmlItems];
                            updated[i] = { ...updated[i], productId: v };
                            const p = products.find((p) => String(p.id) === v);
                            if (p) updated[i].unitPrice = p.sellingPrice;
                            setXmlModal((m) => m && ({ ...m, xmlItems: updated }));
                          }}
                          placeholder="-- Khớp SP --"
                          options={products.map((p) => ({ value: String(p.id), label: p.name, meta: `Tồn: ${p.stock}` }))}
                        />
                        {!item.productId && <div style={{ fontSize: 9, color: 'var(--red)', marginTop: 2 }}>✗ Chưa khớp</div>}
                        {item.productId && <div style={{ fontSize: 9, color: 'var(--green)', marginTop: 2 }}>✓ Đã khớp</div>}
                      </td>
                      <td style={{ fontSize: 11 }} className="c-dim">{item.unit}</td>
                      <td style={{ fontSize: 12 }}>{item.quantity}</td>
                      <td>
                        <MoneyInput
                          value={item.unitPrice}
                          onChange={(v) => {
                            const updated = [...xmlModal.xmlItems];
                            updated[i] = { ...updated[i], unitPrice: v };
                            setXmlModal((m) => m && ({ ...m, xmlItems: updated }));
                          }}
                          style={{ width: 100 }}
                        />
                      </td>
                      <td><span className="tag cyan" style={{ fontSize: 9 }}>{item.taxRate}</span></td>
                      <td className="c-cyan fw7" style={{ fontSize: 12 }}>{fmt(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ textAlign: 'right', marginBottom: 16, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: '#506070', marginBottom: 3 }}>Trước thuế: {fmt(xmlModal.preTaxTotal)}</div>
              <div style={{ fontSize: 11, color: '#506070', marginBottom: 4 }}>Thuế VAT: {fmt(xmlModal.vatTotal)}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cyan)' }}>Tổng cộng: {fmt(xmlModal.grandTotal)}</div>
            </div>

            {/* Paid amount */}
            <div style={{ marginBottom: 16 }}>
              <label className="lbl">Đã thu</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {[0, 50, 70, 100].map((pct) => (
                  <button key={pct} type="button"
                    className={`btn btn-sm ${Number(xmlModal.paidAmount) === Math.round(xmlModal.grandTotal * pct / 100) ? 'cyan' : 'ghost'}`}
                    onClick={() => setXmlModal((m) => m && ({ ...m, paidAmount: String(Math.round(m.grandTotal * pct / 100)) }))}
                  >
                    {pct === 0 ? 'Chưa thu' : `${pct}%`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <MoneyInput value={xmlModal.paidAmount}
                  onChange={(v) => setXmlModal((m) => m && ({ ...m, paidAmount: String(v) }))}
                  placeholder="0" style={{ maxWidth: 200 }}
                />
                <span style={{ fontSize: 11 }} className="c-dim">
                  Còn nợ: <span className="c-red fw7">{fmt(xmlModal.grandTotal - (Number(xmlModal.paidAmount) || 0))}</span>
                </span>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn cyan" onClick={submitXmlImport}>[ Nhập vào hệ thống ]</button>
              <button className="btn ghost" onClick={() => setXmlModal(null)}>[ Hủy ]</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chi tiết hóa đơn ────────────────────────────────────────────────── */}
      {detailInv && (
        <div className="modal-bg" onClick={() => setDetailInv(null)}>
          <div className="modal" style={{ maxWidth: 680, width: '95vw', maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">◈ Chi tiết — {detailInv.code}</div>

            {/* Header */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '8px 12px', background: 'rgba(0,245,255,0.04)', borderRadius: 6, border: '1px solid rgba(0,245,255,0.1)', fontSize: 11 }}>
              <div><span className="c-dim">Ngày lập: </span><span className="c-bright">{fmtDate(detailInv.invoiceDate ?? detailInv.createdAt)}</span></div>
              {detailInv.eInvoiceCode && <div><span className="c-dim">HĐĐT: </span><span className="c-yellow">{detailInv.eInvoiceCode}</span></div>}
              <div><span className="c-dim">Khách hàng: </span><span className="c-bright">{detailInv.customer?.name}</span></div>
              {detailInv.customer?.companyName && <div><span className="c-dim">Công ty: </span><span className="c-dim">{detailInv.customer.companyName}</span></div>}
              {detailInv.customer?.taxCode && <div><span className="c-dim">MST: </span><span className="c-cyan">{detailInv.customer.taxCode}</span></div>}
              <div><span className="c-dim">Trạng thái: </span><span className={`tag ${(STATUS[detailInv.status] || STATUS.unpaid).cls}`}>{(STATUS[detailInv.status] || STATUS.unpaid).label}</span></div>
            </div>

            {/* Items table */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', letterSpacing: 1, marginBottom: 6 }}>// DANH SÁCH HÀNG HÓA / DỊCH VỤ</div>
            <div className="table-wrap mb-12">
              <table className="nt" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Tên hàng hóa</th>
                    <th>ĐVT</th>
                    <th>SL</th>
                    <th style={{ textAlign: 'right' }}>Đơn giá</th>
                    <th>VAT</th>
                    <th style={{ textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {detailInv.items?.length > 0
                    ? detailInv.items.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="c-bright">{item.product?.name || <span className="c-dim">—</span>}</td>
                          <td className="c-dim" style={{ textAlign: 'center' }}>{item.product?.unit || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(item.price)}</td>
                          <td style={{ textAlign: 'center' }} className="c-yellow">{item.taxRate || '—'}</td>
                          <td style={{ textAlign: 'right' }} className="c-bright fw7">{fmt(item.subtotal)}</td>
                        </tr>
                      ))
                    : <tr className="empty-row"><td colSpan={6}>Không có dữ liệu chi tiết</td></tr>
                  }
                </tbody>
                {detailInv.items?.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td colSpan={5} style={{ textAlign: 'right', fontSize: 11 }} className="c-dim">Tổng tiền hàng (chưa VAT)</td>
                      <td style={{ textAlign: 'right' }} className="c-bright">{fmt(detailInv.items.reduce((s: number, i: any) => s + i.subtotal, 0))}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontSize: 11 }} className="c-dim">Tổng thanh toán</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }} className="c-cyan">{fmt(detailInv.totalAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Payment summary */}
            <div style={{ display: 'flex', gap: 16, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, fontSize: 12 }}>
              <span className="c-dim">Tổng: <span className="c-bright fw7">{fmt(detailInv.totalAmount)}</span></span>
              <span className="c-dim">Đã thu: <span className="c-green fw7">{fmt(detailInv.paidAmount)}</span></span>
              <span className="c-dim">Còn nợ: <span className={`fw7 ${detailInv.totalAmount - detailInv.paidAmount > 0 ? 'c-red' : 'c-dim'}`}>{fmt(detailInv.totalAmount - detailInv.paidAmount)}</span></span>
              {detailInv.note && <span className="c-dim">Ghi chú: <span className="c-bright">{detailInv.note}</span></span>}
            </div>

            <div className="form-actions" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={() => setDetailInv(null)}>[ Đóng ]</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch XML Import Modal ─────────────────────────────────────────── */}
      {batchPreviews && (
        <div className="modal-bg" onClick={() => setBatchPreviews(null)}>
          <div className="modal" style={{ maxWidth: 960, width: '98vw', maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">📦 Import batch hóa đơn XML — {batchPreviews.length} file</div>

            {/* Global controls */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 14, padding: '8px 12px', background: 'rgba(0,245,255,0.04)', borderRadius: 6, border: '1px solid rgba(0,245,255,0.1)', fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={batchSkipInventory}
                  onChange={(e) => {
                    setBatchSkipInventory(e.target.checked);
                    setBatchPreviews((prev) => prev && prev.map((p) => ({ ...p, skipInventory: e.target.checked })));
                  }}
                />
                <span><span className="c-cyan fw7">Bỏ qua trừ tồn kho</span> <span className="c-dim">(bật cho import hồi tố — hàng đã bán)</span></span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={batchPreviews.every((p) => p.selected)}
                  onChange={(e) => setBatchPreviews((prev) => prev && prev.map((p) => ({ ...p, selected: e.target.checked && !p.isDuplicate })))}
                />
                <span className="c-dim">Chọn tất cả</span>
              </label>
              <span className="c-dim" style={{ marginLeft: 'auto' }}>
                Đã chọn: <span className="c-cyan fw7">{batchPreviews.filter((p) => p.selected).length}</span> / {batchPreviews.length}
              </span>
            </div>

            {/* Preview table */}
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table className="nt">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>HĐĐT</th>
                    <th>Ngày lập</th>
                    <th>Khách hàng</th>
                    <th>Công ty</th>
                    <th style={{ textAlign: 'right' }}>Tổng</th>
                    <th>Đã thu</th>
                    <th>Trạng thái</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {batchPreviews.map((p, i) => {
                    const hasWarn = p.warnings.length > 0;
                    const isExpanded = expandedRows.has(i);
                    // batchMergeIndex có nghĩa KH sẽ được merge với hóa đơn khác → hợp lệ
                    const canSelect = !p.isDuplicate && (!!p.customerId || p.batchMergeIndex !== undefined);
                    const rowColor = p.isDuplicate ? 'rgba(255,80,80,0.06)' : hasWarn ? 'rgba(255,200,0,0.04)' : undefined;

                    return (
                      <>
                        <tr key={i} style={{ background: rowColor }}>
                          <td>
                            <input type="checkbox" checked={p.selected} disabled={!canSelect}
                              onChange={(e) => setBatchPreviews((prev) => prev && prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                            />
                          </td>
                          <td>
                            <div className="c-cyan" style={{ fontSize: 12 }}>{p.eInvoiceCode}</div>
                          </td>
                          <td className="c-dim" style={{ fontSize: 11 }}>{p.invoiceDate ? fmtDate(p.invoiceDate) : '—'}</td>
                          <td>
                            {p.customerName
                              ? <span className="c-bright" style={{ fontSize: 12 }}>{p.customerName}</span>
                              : p.batchMergeIndex !== undefined
                                ? <span style={{ fontSize: 11, color: 'var(--cyan)' }}>↗ Merge với #{p.batchMergeIndex + 1}</span>
                                : <span className="c-yellow" style={{ fontSize: 11 }}>✦ {p.buyerPersonName || p.buyerName}</span>
                            }
                          </td>
                          <td>
                            {p.buyerName
                              ? <span className="c-dim" style={{ fontSize: 11 }}>{p.buyerName}</span>
                              : <span className="c-dim" style={{ fontSize: 11 }}>—</span>
                            }
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }} className="c-bright">{fmt(p.grandTotal)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {[0, 50, 70, 100].map((pct) => (
                                <button key={pct} type="button"
                                  className={`btn btn-sm ${Number(p.paidAmount) === Math.round(p.grandTotal * pct / 100) ? 'cyan' : 'ghost'}`}
                                  style={{ padding: '1px 5px', fontSize: 10 }}
                                  onClick={() => setBatchPreviews((prev) => prev && prev.map((x, j) => j === i ? { ...x, paidAmount: String(Math.round(x.grandTotal * pct / 100)) } : x))}
                                >{pct === 0 ? '0' : `${pct}%`}</button>
                              ))}
                              <MoneyInput value={p.paidAmount} style={{ width: 80, padding: '2px 6px', fontSize: 11 }}
                                onChange={(v) => setBatchPreviews((prev) => prev && prev.map((x, j) => j === i ? { ...x, paidAmount: String(v) } : x))}
                              />
                            </div>
                          </td>
                          <td>
                            {(() => {
                              if (p.isDuplicate) return <span className="tag red" style={{ fontSize: 10 }}>Đã tồn tại</span>;
                              const hasMergeKH  = p.batchMergeIndex !== undefined;
                              const hasNewKH    = !p.customerId && !hasMergeKH;
                              const hasNewSP    = p.items.some((it) => it.willCreate && it.batchNewProduct);
                              const hasMergeSP  = p.items.some((it) => it.batchMergeProductKey);
                              if (hasMergeKH && hasNewSP)  return <span className="tag cyan" style={{ fontSize: 10 }}>↗ Merge KH · ✦ SP mới</span>;
                              if (hasMergeKH && hasMergeSP) return <span className="tag cyan" style={{ fontSize: 10 }}>↗ Merge KH+SP (batch)</span>;
                              if (hasMergeKH)               return <span className="tag cyan" style={{ fontSize: 10 }}>↗ Merge KH #{p.batchMergeIndex! + 1}</span>;
                              if (hasNewKH  && hasNewSP)   return <span className="tag yellow" style={{ fontSize: 10 }}>✦ Tạo KH+SP mới</span>;
                              if (hasNewKH)                 return <span className="tag yellow" style={{ fontSize: 10 }}>✦ Tạo KH mới</span>;
                              if (hasMergeSP && hasNewSP)  return <span className="tag yellow" style={{ fontSize: 10 }}>↗ Merge SP · ✦ Tạo SP mới</span>;
                              if (hasMergeSP)               return <span className="tag cyan" style={{ fontSize: 10 }}>↗ Merge SP (batch)</span>;
                              if (hasNewSP)                 return <span className="tag yellow" style={{ fontSize: 10 }}>✦ Tạo SP mới</span>;
                              return <span className="tag green" style={{ fontSize: 10 }}>✓ Sẵn sàng</span>;
                            })()}
                          </td>
                          <td>
                            <button className="btn ghost btn-sm" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => toggleExpandRow(i)}>
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <tr key={`${i}-detail`} style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <td colSpan={9} style={{ padding: '8px 16px' }}>
                              {/* Warnings */}
                              {p.warnings.map((w, wi) => (
                                <div key={wi} style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 4 }}>⚠ {w}</div>
                              ))}
                              {/* Items */}
                              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>Tên hàng hóa (XML)</th>
                                    <th style={{ padding: '3px 6px' }}>SL</th>
                                    <th style={{ textAlign: 'right', padding: '3px 6px' }}>Đơn giá</th>
                                    <th style={{ padding: '3px 6px' }}>VAT</th>
                                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>Khớp SP</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.items.map((item, ii) => (
                                    <tr key={ii}>
                                      <td style={{ padding: '3px 6px' }} className="c-dim">{item.xmlName}</td>
                                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                                      <td style={{ padding: '3px 6px', textAlign: 'right' }} className="c-bright">{fmt(item.unitPrice)}</td>
                                      <td style={{ padding: '3px 6px', textAlign: 'center' }} className="c-yellow">{item.taxRate}</td>
                                      <td style={{ padding: '3px 6px' }}>
                                        {!item.willCreate
                                          ? <span className="c-green">✓ {item.productName}</span>
                                          : item.batchMergeProductKey
                                            ? <span style={{ color: 'var(--cyan)' }}>↗ Merge SP (batch)</span>
                                            : <span className="c-yellow">✦ Tạo mới: "{item.xmlName}"</span>
                                        }
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="form-actions">
              <button className="btn cyan" onClick={submitBatchImport} disabled={batchLoading || !batchPreviews.some((p) => p.selected && !p.isDuplicate)}>
                {batchLoading ? '⏳ Đang import...' : `[ Import ${batchPreviews.filter((p) => p.selected && !p.isDuplicate).length} hóa đơn ]`}
              </button>
              <button className="btn ghost" onClick={() => setBatchPreviews(null)}>[ Hủy ]</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
