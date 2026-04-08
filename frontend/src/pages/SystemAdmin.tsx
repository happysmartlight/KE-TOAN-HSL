import { useEffect, useState } from 'react';
import api from '../api';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from '../components/Toast';

type Stats = {
  customers: number; suppliers: number; products: number;
  invoices: number; invoiceItems: number;
  purchases: number; purchaseItems: number;
  payments: number; supplierPayments: number;
  cashflow: number; inventoryLogs: number; logs: number; deleteRequests: number;
};


type GroupKey = 'customers' | 'suppliers' | 'products' | 'invoices' | 'purchases' | 'cashflow' | 'logs';

type GroupDef = {
  key: GroupKey;
  label: string;
  icon: string;
  color: string;
  description: string;
  alsoDeletes: string;
  count: (s: Stats) => number;
};

const GROUPS: GroupDef[] = [
  {
    key: 'customers',
    label: 'Khách hàng',
    icon: '👥',
    color: 'cyan',
    description: 'Toàn bộ khách hàng và dữ liệu liên quan',
    alsoDeletes: 'Hóa đơn bán, thanh toán, bút toán thu liên quan',
    count: (s) => s.customers,
  },
  {
    key: 'suppliers',
    label: 'Nhà cung cấp',
    icon: '🏭',
    color: 'yellow',
    description: 'Toàn bộ nhà cung cấp và dữ liệu liên quan',
    alsoDeletes: 'Đơn nhập hàng, thanh toán nhà cung cấp',
    count: (s) => s.suppliers,
  },
  {
    key: 'products',
    label: 'Sản phẩm',
    icon: '📦',
    color: 'purple',
    description: 'Toàn bộ sản phẩm và tồn kho',
    alsoDeletes: 'Dòng hàng trong hóa đơn, đơn nhập, lịch sử tồn kho',
    count: (s) => s.products,
  },
  {
    key: 'invoices',
    label: 'Hóa đơn bán',
    icon: '🧾',
    color: 'green',
    description: 'Toàn bộ hóa đơn bán hàng',
    alsoDeletes: 'Thanh toán, bút toán thu — Công nợ KH reset về 0, tồn kho phục hồi',
    count: (s) => s.invoices,
  },
  {
    key: 'purchases',
    label: 'Nhập hàng',
    icon: '🛒',
    color: 'yellow',
    description: 'Toàn bộ đơn nhập hàng',
    alsoDeletes: 'Thanh toán NCC — Công nợ NCC reset về 0',
    count: (s) => s.purchases,
  },
  {
    key: 'cashflow',
    label: 'Thu / Chi',
    icon: '💰',
    color: 'cyan',
    description: 'Toàn bộ bút toán thu/chi',
    alsoDeletes: '(chỉ bút toán, không ảnh hưởng hóa đơn)',
    count: (s) => s.cashflow,
  },
  {
    key: 'logs',
    label: 'Log hệ thống',
    icon: '📋',
    color: 'ghost',
    description: 'Toàn bộ nhật ký hoạt động',
    alsoDeletes: '(chỉ log, không ảnh hưởng dữ liệu nghiệp vụ)',
    count: (s) => s.logs,
  },
];

export default function SystemAdmin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [confirmGroup, setConfirmGroup] = useState<GroupDef | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);


  const loadStats = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/stats');
      setStats(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const doDeleteGroup = async (group: GroupKey, password: string) => {
    setBusy(true);
    try {
      await api.delete(`/admin/purge/${group}`, { data: { password } });
      toast.success(`Đã xóa sạch nhóm: ${GROUPS.find((g) => g.key === group)?.label}`);
      await loadStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi xóa');
    } finally {
      setBusy(false);
      setConfirmGroup(null);
    }
  };

  const doDeleteAll = async (password: string) => {
    setBusy(true);
    try {
      await api.delete('/admin/purge-all', { data: { password } });
      toast.success('Đã xóa toàn bộ dữ liệu nghiệp vụ. Hệ thống sạch.');
      await loadStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi xóa');
    } finally {
      setBusy(false);
      setConfirmAll(false);
    }
  };

  const doSeedDemo = async (password: string) => {
    setBusy(true);
    try {
      const r = await api.post('/admin/seed-demo', { password });
      const c = r.data?.counts;
      toast.success(
        c
          ? `Đã nạp dữ liệu demo: ${c.invoices} HĐ, ${c.customers} KH, ${c.products} SP, ${c.users} NV`
          : 'Đã nạp dữ liệu demo thành công'
      );
      await loadStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi chạy seed demo');
    } finally {
      setBusy(false);
      setConfirmSeed(false);
    }
  };

  const doResetProduction = async (password: string) => {
    setBusy(true);
    try {
      await api.post('/admin/reset-production', { password });
      toast.success('Đã xóa hết dữ liệu demo. Hệ thống sẵn sàng cho sử dụng thực tế.');
      await loadStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi reset');
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  };


  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản trị hệ thống</h1>
        <button className="btn red" onClick={() => setConfirmAll(true)} disabled={busy}>
          ☢ Xóa toàn bộ dữ liệu
        </button>
      </div>

      {/* Stats overview */}
      {stats && (
        <div className="form-panel mb-16" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Tổng quan dữ liệu hệ thống</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px', fontSize: 12 }}>
            {[
              ['Khách hàng', stats.customers],
              ['Nhà cung cấp', stats.suppliers],
              ['Sản phẩm', stats.products],
              ['Hóa đơn bán', stats.invoices],
              ['Dòng hóa đơn', stats.invoiceItems],
              ['Đơn nhập', stats.purchases],
              ['Dòng nhập', stats.purchaseItems],
              ['Thanh toán KH', stats.payments],
              ['Thanh toán NCC', stats.supplierPayments],
              ['Bút toán Thu/Chi', stats.cashflow],
              ['Tồn kho log', stats.inventoryLogs],
              ['Log hệ thống', stats.logs],
              ['Yêu cầu xóa', stats.deleteRequests],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', gap: 6 }}>
                <span className="c-dim">{label}:</span>
                <span className={`fw7 ${(val as number) > 0 ? 'c-cyan' : 'c-dim'}`}>{val as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo seed / Production reset panel */}
      <div
        className="form-panel mb-16"
        style={{
          padding: '16px 18px',
          border: '1px solid rgba(191,0,255,0.35)',
          background: 'rgba(191,0,255,0.04)',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
          🧪 Dữ liệu thử nghiệm
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {/* Seed demo */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🌱</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)', marginBottom: 4 }}>
                Nạp dữ liệu demo
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
                Tạo nhanh dữ liệu mẫu (POI Lighttoys, mạch điều khiển, màn hình LED): 6 nhân viên, 6 NCC, 26 sản phẩm, 14 KH, ~8 đơn nhập, ~47 hóa đơn trải đều 2025–2026 + chi phí định kỳ.
              </div>
              <div style={{ fontSize: 10, color: 'var(--yellow)', marginBottom: 8 }}>
                ⚠ Thao tác này sẽ XÓA toàn bộ dữ liệu hiện tại trước khi seed (giữ lại tài khoản đang đăng nhập).
              </div>
              <button
                className="btn purple btn-sm"
                disabled={busy}
                onClick={() => setConfirmSeed(true)}
              >
                🌱 Chạy dữ liệu demo
              </button>
            </div>
          </div>

          {/* Reset for production */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                Bắt đầu sử dụng thực tế
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
                Xóa sạch toàn bộ dữ liệu demo (KH, NCC, SP, hóa đơn, đơn nhập, thu/chi, tồn kho, log) và mọi tài khoản nhân viên demo. Hệ thống về trạng thái sạch để bắt đầu nhập liệu thật.
              </div>
              <div style={{ fontSize: 10, color: 'var(--yellow)', marginBottom: 8 }}>
                ⚠ Giữ lại: tài khoản admin đang đăng nhập + danh mục thu/chi mặc định.
              </div>
              <button
                className="btn green btn-sm"
                disabled={busy}
                onClick={() => setConfirmReset(true)}
              >
                🚀 Xóa demo &amp; bắt đầu thực tế
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Group cards */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
        Xóa theo nhóm dữ liệu
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, marginBottom: 32 }}>
        {GROUPS.map((g) => {
          const count = stats ? g.count(stats) : 0;
          return (
            <div key={g.key} className="form-panel" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{g.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)' }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{g.description}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  {loading ? (
                    <span className="c-dim" style={{ fontSize: 11 }}>...</span>
                  ) : (
                    <span className={`fw7 ${count > 0 ? 'c-cyan' : 'c-dim'}`} style={{ fontSize: 18 }}>{count}</span>
                  )}
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>bản ghi</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--yellow)', marginBottom: 10, lineHeight: 1.5 }}>
                ⚠ Cũng xóa: {g.alsoDeletes}
              </div>
              <button
                className="btn red btn-sm"
                disabled={busy || count === 0}
                style={count === 0 ? { opacity: 0.3 } : {}}
                onClick={() => setConfirmGroup(g)}
              >
                Xóa tất cả {g.label}
              </button>
            </div>
          );
        })}

        {/* Danger card — purge all */}
        <div
          className="form-panel"
          style={{
            padding: '16px 18px',
            border: '1px solid rgba(255,0,85,0.4)',
            background: 'rgba(255,0,85,0.04)',
            gridColumn: '1 / -1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>☢</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Xóa toàn bộ dữ liệu</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                Xóa tất cả: khách hàng, nhà cung cấp, sản phẩm, hóa đơn, đơn nhập, thu/chi, log, tồn kho...
              </div>
              <div style={{ fontSize: 10, color: 'var(--yellow)', marginTop: 4 }}>
                ⚠ Giữ lại: tài khoản người dùng &amp; danh mục thu/chi. Không thể hoàn tác!
              </div>
            </div>
            {stats && (
              <div style={{ textAlign: 'center', marginRight: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>
                  {Object.values(stats).reduce((a, b) => a + b, 0)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>tổng bản ghi</div>
              </div>
            )}
            <button className="btn red" disabled={busy} onClick={() => setConfirmAll(true)}>
              ☢ Xóa toàn bộ dữ liệu
            </button>
          </div>
        </div>
      </div>

      {/* Confirm group delete */}
      {confirmGroup && (
        <ConfirmModal
          title={`Xóa toàn bộ ${confirmGroup.label}`}
          message={`Hành động này sẽ xóa vĩnh viễn ${stats ? confirmGroup.count(stats) : '?'} bản ghi "${confirmGroup.label}" và tất cả dữ liệu liên quan.`}
          warning={`Cũng xóa: ${confirmGroup.alsoDeletes}. Không thể khôi phục sau khi xóa!`}
          confirmLabel={`Xóa ${confirmGroup.label}`}
          typeToConfirm="XOA"
          requirePassword
          onConfirm={(pwd) => doDeleteGroup(confirmGroup.key, pwd!)}
          onCancel={() => setConfirmGroup(null)}
        />
      )}

      {/* Confirm seed demo */}
      {confirmSeed && (
        <ConfirmModal
          title="🌱 Nạp dữ liệu demo"
          message="Hệ thống sẽ XÓA toàn bộ dữ liệu hiện tại (KH, NCC, SP, hóa đơn, đơn nhập, thu/chi, log, tồn kho, nhân viên khác) và nạp lại bộ dữ liệu mẫu chuyên ngành LED/POI Lighttoys."
          warning="Tài khoản admin đang đăng nhập sẽ được giữ nguyên. Quá trình có thể mất 10-30 giây."
          confirmLabel="Bắt đầu seed"
          typeToConfirm="DEMO"
          requirePassword
          onConfirm={(pwd) => doSeedDemo(pwd!)}
          onCancel={() => setConfirmSeed(false)}
        />
      )}

      {/* Confirm reset for production */}
      {confirmReset && (
        <ConfirmModal
          title="🚀 Bắt đầu sử dụng thực tế"
          message="Hệ thống sẽ XÓA SẠCH toàn bộ dữ liệu demo: khách hàng, nhà cung cấp, sản phẩm, hóa đơn, đơn nhập, thu/chi, log, tồn kho và mọi tài khoản nhân viên demo."
          warning="Chỉ giữ lại tài khoản admin đang đăng nhập và danh mục thu/chi mặc định. KHÔNG THỂ HOÀN TÁC!"
          confirmLabel="Xóa demo & bắt đầu thực tế"
          typeToConfirm="BAT DAU"
          requirePassword
          onConfirm={(pwd) => doResetProduction(pwd!)}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {/* Confirm purge all */}
      {confirmAll && (
        <ConfirmModal
          title="☢ XÓA TOÀN BỘ DỮ LIỆU"
          message="Hành động này sẽ xóa TOÀN BỘ dữ liệu nghiệp vụ: khách hàng, nhà cung cấp, sản phẩm, hóa đơn, đơn nhập, thu/chi, log..."
          warning="Chỉ giữ lại tài khoản người dùng và danh mục thu/chi. Không thể hoàn tác!"
          confirmLabel="XÓA TOÀN BỘ"
          typeToConfirm="XOA TOAN BO"
          requirePassword
          onConfirm={(pwd) => doDeleteAll(pwd!)}
          onCancel={() => setConfirmAll(false)}
        />
      )}
    </div>
  );
}
