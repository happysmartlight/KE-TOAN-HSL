import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec, spawn } from 'child_process';

const prisma = new PrismaClient();

// ── Tailscale setup state (in-memory, per server process) ──────────────────
export type TailscalePhase =
  | 'idle'          // chưa làm gì
  | 'installing'    // đang chạy install.sh
  | 'starting'      // tailscale up vừa chạy, chờ URL
  | 'auth_pending'  // URL đã có, chờ user quét QR
  | 'connected'     // xác thực xong, đã có IP
  | 'error';        // thất bại

export type TailscaleState = {
  phase: TailscalePhase;
  authUrl?: string;
  error?: string;
};

let _tsState: TailscaleState = { phase: 'idle' };
const URL_RE = /https:\/\/login\.tailscale\.com\/[^\s\n\r]+/;

// ── Update state ────────────────────────────────────────────────────────────
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'up_to_date'
  | 'update_available'
  | 'updating'
  | 'success'
  | 'error';

export type CiStatus = 'passing' | 'failing' | 'pending' | 'unknown';

export type UpdateState = {
  phase: UpdatePhase;
  currentCommit?: string;
  currentMessage?: string;
  remoteCommit?: string;
  commitsBehind?: number;
  newCommits?: string[];
  ciStatus?: CiStatus;
  /** Short SHA mà ciStatus áp dụng (để UI hiển thị “CI của commit xxx”) */
  ciStatusSha?: string;
  logs: string[];
  error?: string;
  checkedAt?: number;
};

// Logs ghi ra file để tồn tại qua PM2 reload
const UPDATE_LOG_FILE = '/tmp/ke-toan-update.log';
// PROJECT_ROOT: dist/modules/admin → 4 levels up = project root
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

let _updateState: UpdateState = { phase: 'idle', logs: [] };

// Khôi phục state từ log file khi server restart sau deploy
function _initUpdateState() {
  try {
    if (!fs.existsSync(UPDATE_LOG_FILE)) return;
    const ageMs = Date.now() - fs.statSync(UPDATE_LOG_FILE).mtimeMs;
    if (ageMs > 30 * 60 * 1000) return; // bỏ qua log > 30 phút
    const lines = fs.readFileSync(UPDATE_LOG_FILE, 'utf-8').split('\n').filter(Boolean);
    const text = lines.join('\n');
    let phase: UpdatePhase = 'updating';
    if (/cập nhật xong|reload pm2/i.test(text)) phase = 'success';
    else if (/error|failed|thất bại|exit [^0]/i.test(text)) phase = 'error';
    _updateState = { phase, logs: lines };
  } catch { /* ignore */ }
}
_initUpdateState();

function _appendUpdateLog(line: string) {
  if (!_updateState.logs) _updateState.logs = [];
  _updateState.logs.push(line);
  if (_updateState.logs.length > 500) _updateState.logs = _updateState.logs.slice(-500);
  try { fs.appendFileSync(UPDATE_LOG_FILE, line + '\n', 'utf-8'); } catch { /* ignore */ }
}

const _run = (cmd: string, cwd?: string) =>
  new Promise<string>((resolve, reject) =>
    exec(cmd, { cwd, timeout: 30_000 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout.trim())
    )
  );

// Repo info cho GitHub API
const GH_OWNER = 'happysmartlight';
const GH_REPO  = 'KE-TOAN-HSL';
const GH_API   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;

/** Helper fetch có timeout (không phụ thuộc AbortSignal.timeout) */
async function _fetchWithTimeout(url: string, ms = 10_000, init?: RequestInit): Promise<Response | null> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: {
        'User-Agent': 'ke-toan-noi-bo-update-check',
        'Accept':     'application/vnd.github+json',
        ...(init?.headers || {}),
      },
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

/** Lấy SHA full của commit master trên remote (không tải objects về) */
async function _getRemoteMasterSha(): Promise<string | null> {
  // Ưu tiên `git ls-remote` vì nhanh & nhẹ
  try {
    const out = await _run(`git -C "${PROJECT_ROOT}" ls-remote origin master`);
    const sha = out.split(/\s+/)[0];
    if (sha && /^[0-9a-f]{40}$/i.test(sha)) return sha;
  } catch { /* fallback sang API */ }

  // Fallback: GitHub API
  const res = await _fetchWithTimeout(`${GH_API}/commits/master`);
  if (!res || !res.ok) return null;
  try {
    const data: any = await res.json();
    return typeof data?.sha === 'string' ? data.sha : null;
  } catch {
    return null;
  }
}

/**
 * Fetch CI status cho đúng một commit SHA cụ thể (không phải "latest trên branch").
 * Dùng GitHub Checks API: /repos/{owner}/{repo}/commits/{sha}/check-runs
 *
 * Trạng thái trả về:
 *  - 'pending'  nếu có bất kỳ check run nào chưa hoàn thành (queued / in_progress)
 *  - 'failing'  nếu có check run nào kết luận failure/timed_out/cancelled/action_required
 *  - 'passing'  nếu tất cả check run đã completed và conclusion là success/skipped/neutral
 *  - 'unknown'  nếu không có check run nào, hoặc không fetch được
 */
async function _fetchCiStatusForSha(sha: string): Promise<CiStatus> {
  const res = await _fetchWithTimeout(`${GH_API}/commits/${sha}/check-runs?per_page=100`);
  if (!res || !res.ok) return 'unknown';
  let data: any;
  try { data = await res.json(); } catch { return 'unknown'; }

  const runs: any[] = Array.isArray(data?.check_runs) ? data.check_runs : [];
  if (runs.length === 0) return 'unknown';

  // Có bất kỳ run nào chưa completed → CI còn đang chạy
  if (runs.some((r) => r.status !== 'completed')) return 'pending';

  const BAD = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);
  if (runs.some((r) => BAD.has(r.conclusion))) return 'failing';

  const OK = new Set(['success', 'skipped', 'neutral']);
  if (runs.every((r) => OK.has(r.conclusion))) return 'passing';

  return 'unknown';
}

/** Lấy CI status cho commit master MỚI NHẤT trên remote, trả kèm short SHA */
async function _fetchRemoteCi(): Promise<{ status: CiStatus; sha?: string }> {
  const fullSha = await _getRemoteMasterSha();
  if (!fullSha) return { status: 'unknown' };
  const status = await _fetchCiStatusForSha(fullSha);
  return { status, sha: fullSha.slice(0, 7) };
}

export type GroupName = 'customers' | 'suppliers' | 'products' | 'invoices' | 'purchases' | 'cashflow' | 'logs';

export type RankTier = {
  label: string;
  min: number;
  icon: string;
  color: string;
  glow: string;
};

export type RankConfig = {
  customer: RankTier[];
  supplier: RankTier[];
  product:  RankTier[];
  user:     RankTier[];
};

const RANK_CONFIG_PATH = path.join(__dirname, '../../../prisma/rank-config.json');

const DEFAULT_TIERS: RankTier[] = [
  { label: 'THÁCH ĐẤU', min: 50_000_000, icon: '⚔️',  color: '#ff2244', glow: '#ff003344' },
  { label: 'KIM CƯƠNG',  min: 20_000_000, icon: '💎',  color: '#00d4ff', glow: '#00aaff44' },
  { label: 'BẠCH KIM',   min: 10_000_000, icon: '🔮',  color: '#bf80ff', glow: '#9944ff44' },
  { label: 'VÀNG',       min:  5_000_000, icon: '⭐',  color: '#ffcc00', glow: '#ffaa0044' },
];

const DEFAULT_RANK_CONFIG: RankConfig = {
  customer: [...DEFAULT_TIERS],
  supplier: [...DEFAULT_TIERS],
  product:  [...DEFAULT_TIERS],
  user:     [...DEFAULT_TIERS],
};

export const adminService = {
  async verifyAdminPassword(userId: number, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  },

  async getStats() {
    const [
      customers, suppliers, products,
      invoices, invoiceItems,
      purchases, purchaseItems,
      payments, supplierPayments,
      cashflow, inventoryLogs, logs, deleteRequests,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.product.count(),
      prisma.invoice.count(),
      prisma.invoiceItem.count(),
      prisma.purchaseOrder.count(),
      prisma.purchaseItem.count(),
      prisma.payment.count(),
      prisma.supplierPayment.count(),
      prisma.cashflow.count(),
      prisma.inventoryLog.count(),
      prisma.activityLog.count(),
      prisma.deleteRequest.count(),
    ]);
    return {
      customers, suppliers, products,
      invoices, invoiceItems,
      purchases, purchaseItems,
      payments, supplierPayments,
      cashflow, inventoryLogs, logs, deleteRequests,
    };
  },

  async getHealth() {
    const uptimeSeconds = process.uptime();
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();

    // Lấy kích thước DB từ MariaDB information_schema
    let dbSize = 0;
    try {
      const result = await prisma.$queryRaw<[{ size: bigint }]>`
        SELECT SUM(data_length + index_length) AS size
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
      `;
      dbSize = Number(result[0]?.size ?? 0);
    } catch {}

    let disk: { total: number; free: number; used: number } | null = null;
    try {
      const statfs = (fs as any).statfsSync?.('/');
      if (statfs) {
        disk = {
          total: statfs.bsize * statfs.blocks,
          free:  statfs.bsize * statfs.bfree,
          used:  statfs.bsize * (statfs.blocks - statfs.bfree),
        };
      }
    } catch {}

    return {
      uptime:      uptimeSeconds,
      nodeVersion: process.version,
      platform:    os.platform(),
      arch:        os.arch(),
      hostname:    os.hostname(),
      ram: {
        total: totalMem,
        free:  freeMem,
        used:  totalMem - freeMem,
      },
      cpu: {
        model:   os.cpus()[0]?.model || 'N/A',
        cores:   os.cpus().length,
        loadavg: os.loadavg(),
      },
      dbSize,
      disk,
    };
  },

  async purgeGroup(group: GroupName) {
    switch (group) {
      case 'customers':
        // Xóa: cashflow liên quan → payments → invoiceItems → invoices → customers
        // Reset: stock không thay đổi (dữ liệu bán đã tồn tại)
        await prisma.$transaction(async (tx) => {
          const invoiceIds = (await tx.invoice.findMany({ select: { id: true } })).map((i) => i.id);
          await tx.cashflow.deleteMany({ where: { refType: 'payment' } });
          await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
          await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
          await tx.invoice.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Customer' } });
          await tx.customer.deleteMany();
        });
        break;

      case 'suppliers':
        // Xóa: supplierPayments → purchaseItems → purchaseOrders → suppliers
        await prisma.$transaction(async (tx) => {
          await tx.supplierPayment.deleteMany();
          await tx.purchaseItem.deleteMany();
          await tx.purchaseOrder.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Supplier' } });
          await tx.supplier.deleteMany();
        });
        break;

      case 'products':
        // Xóa: inventoryLogs → invoiceItems → purchaseItems → products
        // Lưu ý: invoices & purchases vẫn còn nhưng không có items
        await prisma.$transaction(async (tx) => {
          await tx.inventoryLog.deleteMany();
          await tx.invoiceItem.deleteMany();
          await tx.purchaseItem.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Product' } });
          await tx.product.deleteMany();
        });
        break;

      case 'invoices':
        // Xóa: cashflow payment_received → payments → invoiceItems → invoices
        // Reset: customer.debt = 0
        await prisma.$transaction(async (tx) => {
          await tx.cashflow.deleteMany({ where: { refType: 'payment' } });
          await tx.payment.deleteMany();
          await tx.invoiceItem.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Invoice' } });
          await tx.invoice.deleteMany();
          await tx.customer.updateMany({ data: { debt: 0 } });
          // Restore stock: reset to 0 + recalculate from purchase history
          const purchases = await tx.purchaseItem.findMany({ select: { productId: true, quantity: true } });
          const stockMap: Record<number, number> = {};
          for (const pi of purchases) {
            stockMap[pi.productId] = (stockMap[pi.productId] || 0) + pi.quantity;
          }
          for (const [productId, stock] of Object.entries(stockMap)) {
            await tx.product.update({ where: { id: Number(productId) }, data: { stock } });
          }
          // Products with no purchases → stock = 0
          const withPurchases = Object.keys(stockMap).map(Number);
          if (withPurchases.length > 0) {
            await tx.product.updateMany({ where: { id: { notIn: withPurchases } }, data: { stock: 0 } });
          } else {
            await tx.product.updateMany({ data: { stock: 0 } });
          }
        });
        break;

      case 'purchases':
        // Xóa: supplierPayments → purchaseItems → purchaseOrders
        // Reset: supplier.debt = 0, product.stock recalculate from invoices
        await prisma.$transaction(async (tx) => {
          await tx.supplierPayment.deleteMany();
          await tx.purchaseItem.deleteMany();
          await tx.purchaseOrder.deleteMany();
          await tx.supplier.updateMany({ data: { debt: 0 } });
          // Recalculate stock: sold quantity from invoiceItems
          const sold = await tx.invoiceItem.findMany({ select: { productId: true, quantity: true } });
          const soldMap: Record<number, number> = {};
          for (const item of sold) {
            soldMap[item.productId] = (soldMap[item.productId] || 0) + item.quantity;
          }
          // stock = 0 - sold (negative means oversold, that's their problem)
          const allProducts = await tx.product.findMany({ select: { id: true } });
          for (const p of allProducts) {
            await tx.product.update({ where: { id: p.id }, data: { stock: -(soldMap[p.id] || 0) } });
          }
        });
        break;

      case 'cashflow':
        await prisma.cashflow.deleteMany();
        break;

      case 'logs':
        await prisma.activityLog.deleteMany();
        break;

      default:
        throw new Error(`Unknown group: ${group}`);
    }
  },

  getRankConfig(): RankConfig {
    try {
      if (fs.existsSync(RANK_CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(RANK_CONFIG_PATH, 'utf-8'));
      }
    } catch {}
    return DEFAULT_RANK_CONFIG;
  },

  saveRankConfig(incoming: Partial<RankConfig>): RankConfig {
    const current = adminService.getRankConfig();
    const merged: RankConfig = {
      customer: incoming.customer ?? current.customer,
      supplier: incoming.supplier ?? current.supplier,
      product:  incoming.product  ?? current.product,
      user:     incoming.user     ?? current.user,
    };
    const dir = path.dirname(RANK_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RANK_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  },

  // ── Tailscale ──────────────────────────────────────────────────────────────

  getTailscaleState(): TailscaleState & { tailscaleIPs: string[] } {
    const { tailscaleIPs } = adminService.getNetworkInfo();
    // Nếu đã có IP thật thì cập nhật phase dù process chưa exit
    if (tailscaleIPs.length > 0 && _tsState.phase !== 'connected') {
      _tsState = { phase: 'connected' };
    }
    return { ..._tsState, tailscaleIPs };
  },

  resetTailscaleState() {
    _tsState = { phase: 'idle' };
  },

  startTailscaleSetup(): { ok: boolean; error?: string } {
    if (os.platform() !== 'linux') {
      return { ok: false, error: 'Chỉ hỗ trợ trên Linux / Raspberry Pi.' };
    }
    // Đã đang chạy → trả về OK luôn (frontend sẽ poll state)
    if (_tsState.phase === 'installing' || _tsState.phase === 'starting' || _tsState.phase === 'auth_pending') {
      return { ok: true };
    }

    _tsState = { phase: 'installing' };

    (async () => {
      try {
        // Kiểm tra xem tailscale đã cài chưa
        const installed = await new Promise<boolean>((resolve) =>
          exec('which tailscale', (err) => resolve(!err))
        );

        if (!installed) {
          await new Promise<void>((resolve, reject) =>
            exec(
              'curl -fsSL https://tailscale.com/install.sh | sh',
              { timeout: 180_000 },
              (err) => (err ? reject(err) : resolve())
            )
          );
        }

        _tsState = { phase: 'starting' };

        // Chạy tailscale up, bắt URL xác thực từ stdout/stderr
        const child = spawn('tailscale', ['up'], { stdio: ['ignore', 'pipe', 'pipe'] });

        const capture = (data: Buffer) => {
          const text = data.toString();
          const match = text.match(URL_RE);
          if (match && _tsState.phase !== 'connected') {
            _tsState = { phase: 'auth_pending', authUrl: match[0].trim() };
          }
          if (/success|already authenticated|logged in/i.test(text)) {
            _tsState = { phase: 'connected' };
          }
        };

        child.stdout.on('data', capture);
        child.stderr.on('data', capture);

        child.on('close', (code) => {
          if (code === 0 || _tsState.phase === 'auth_pending') {
            // Exit 0 = đã xác thực; nếu đang auth_pending thì giữ nguyên để frontend poll
            if (code === 0) _tsState = { phase: 'connected' };
          } else if (_tsState.phase !== 'connected') {
            _tsState = { phase: 'error', error: `tailscale up thoát với code ${code}` };
          }
        });

        // Timeout 10 phút
        setTimeout(() => {
          if (_tsState.phase === 'starting' || _tsState.phase === 'auth_pending') {
            _tsState = { phase: 'error', error: 'Hết thời gian chờ (10 phút).' };
            child.kill();
          }
        }, 600_000);
      } catch (err: any) {
        _tsState = { phase: 'error', error: err.message };
      }
    })();

    return { ok: true };
  },

  // ── Update ─────────────────────────────────────────────────────────────────

  getUpdateState(): UpdateState {
    return { ..._updateState, logs: [...(_updateState.logs ?? [])] };
  },

  async checkForUpdates(): Promise<void> {
    _updateState = { phase: 'checking', logs: [] };
    try {
      // ── BƯỚC 1: Kiểm tra CI/CD CỦA ĐÚNG COMMIT MỚI NHẤT ──────────────
      // Không dùng badge ?branch=master vì nó chỉ phản ánh run cuối cùng
      // đã completed — có thể chưa phải là của commit mới nhất nếu CI còn
      // đang chạy. Dùng GitHub Checks API cho SHA cụ thể.
      const { status: ciStatus, sha: ciStatusSha } = await _fetchRemoteCi();

      // Luôn lấy commit hiện tại của local để hiển thị, dù CI có fail/pending
      const currentLocal = await _run(`git -C "${PROJECT_ROOT}" rev-parse --short HEAD`).catch(() => '');
      const currentMsgLocal = await _run(`git -C "${PROJECT_ROOT}" log HEAD -1 --pretty=format:%B`).catch(() => '');

      if (ciStatus === 'failing') {
        _updateState = {
          phase: 'error',
          ciStatus,
          ciStatusSha,
          currentCommit: currentLocal || undefined,
          currentMessage: currentMsgLocal ? currentMsgLocal.trim() : undefined,
          remoteCommit: ciStatusSha,
          logs: [],
          error:
            `CI/CD của commit ${ciStatusSha ?? 'mới nhất'} đang FAIL — tạm dừng kiểm tra cập nhật. ` +
            'Vui lòng đợi maintainer sửa rồi thử lại. ' +
            `Chi tiết: https://github.com/${GH_OWNER}/${GH_REPO}/actions`,
          checkedAt: Date.now(),
        };
        return;
      }

      if (ciStatus === 'pending') {
        _updateState = {
          phase: 'error',
          ciStatus,
          ciStatusSha,
          currentCommit: currentLocal || undefined,
          currentMessage: currentMsgLocal ? currentMsgLocal.trim() : undefined,
          remoteCommit: ciStatusSha,
          logs: [],
          error:
            `CI/CD của commit ${ciStatusSha ?? 'mới nhất'} vẫn đang chạy — ` +
            'vui lòng chờ CI hoàn tất rồi kiểm tra lại. ' +
            `Chi tiết: https://github.com/${GH_OWNER}/${GH_REPO}/actions`,
          checkedAt: Date.now(),
        };
        return;
      }

      // ── BƯỚC 2: CI pass (hoặc unknown) → fetch commit info ───────────
      await _run(`git -C "${PROJECT_ROOT}" fetch origin master`);
      const [current, remote, countStr, newLog, currentMsg] = await Promise.all([
        _run(`git -C "${PROJECT_ROOT}" rev-parse --short HEAD`),
        _run(`git -C "${PROJECT_ROOT}" rev-parse --short origin/master`),
        _run(`git -C "${PROJECT_ROOT}" rev-list HEAD..origin/master --count`),
        // -z: record separator = NUL; format: short hash + space + full body (%B giữ nguyên xuống dòng)
        _run(`git -C "${PROJECT_ROOT}" log HEAD..origin/master -z --pretty=format:%h %B`).catch(() => ''),
        _run(`git -C "${PROJECT_ROOT}" log HEAD -1 --pretty=format:%B`).catch(() => ''),
      ]);
      const commitsBehind = parseInt(countStr, 10) || 0;
      const newCommits = newLog
        ? newLog.split('\0').map((s) => s.trim()).filter(Boolean)
        : [];
      _updateState = {
        phase: commitsBehind > 0 ? 'update_available' : 'up_to_date',
        currentCommit: current,
        currentMessage: currentMsg ? currentMsg.trim() : undefined,
        remoteCommit: remote,
        commitsBehind,
        newCommits,
        ciStatus,
        ciStatusSha,
        logs: [],
        checkedAt: Date.now(),
      };
    } catch (err: any) {
      _updateState = { phase: 'error', logs: [], error: `Kiểm tra cập nhật thất bại: ${err.message}` };
    }
  },

  async startUpdate(): Promise<{ ok: boolean; error?: string }> {
    if (os.platform() !== 'linux') {
      return { ok: false, error: 'Chỉ hỗ trợ trên Linux / Raspberry Pi.' };
    }
    const allowed: UpdatePhase[] = ['update_available', 'up_to_date', 'error'];
    if (!allowed.includes(_updateState.phase)) {
      return { ok: true }; // đang chạy rồi, frontend poll tiếp
    }

    // ── Re-check CI/CD cho đúng SHA commit mới nhất ngay trước khi pull ──
    // Tránh race condition: checkForUpdates trước đó thấy CI pass, nhưng
    // đến lúc user bấm "Cập nhật ngay" thì commit mới đã được push hoặc
    // CI vừa chuyển sang fail/pending.
    const { status: ciStatus, sha: ciStatusSha } = await _fetchRemoteCi();

    if (ciStatus === 'failing' || ciStatus === 'pending') {
      const msg =
        ciStatus === 'failing'
          ? `CI/CD của commit ${ciStatusSha ?? 'mới nhất'} đang FAIL — huỷ cập nhật để tránh kéo code lỗi về.`
          : `CI/CD của commit ${ciStatusSha ?? 'mới nhất'} vẫn đang chạy — vui lòng chờ CI hoàn tất rồi thử lại.`;
      _updateState = {
        ..._updateState,
        phase: 'error',
        ciStatus,
        ciStatusSha,
        error: `${msg} Chi tiết: https://github.com/${GH_OWNER}/${GH_REPO}/actions`,
        checkedAt: Date.now(),
      };
      return { ok: false, error: _updateState.error };
    }

    // Xóa log cũ
    try { fs.writeFileSync(UPDATE_LOG_FILE, '', 'utf-8'); } catch { /* ignore */ }
    _updateState = {
      phase: 'updating',
      currentCommit: _updateState.currentCommit,
      remoteCommit: _updateState.remoteCommit,
      commitsBehind: _updateState.commitsBehind,
      ciStatus,
      ciStatusSha,
      logs: [`[${new Date().toLocaleString('vi-VN')}] Bắt đầu cập nhật hệ thống...`],
    };
    _appendUpdateLog(_updateState.logs[0]);
    if (ciStatus === 'passing') {
      _appendUpdateLog(`✔ CI/CD PASS cho commit ${ciStatusSha ?? '?'} — tiến hành kéo code mới...`);
    } else {
      _appendUpdateLog('⚠ Không xác định được CI/CD status — tiếp tục cẩn thận...');
    }

    const child = spawn('bash', ['-c', `cd "${PROJECT_ROOT}" && git fetch origin && git checkout -- backend/package-lock.json frontend/package-lock.json 2>/dev/null || true && git pull && bash deploy.sh`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const handleData = (data: Buffer) => {
      data.toString().split('\n').forEach((line) => {
        const t = line.trim();
        if (t) _appendUpdateLog(t);
      });
    };
    child.stdout.on('data', handleData);
    child.stderr.on('data', handleData);

    child.on('close', (code) => {
      if (code === 0) {
        _updateState.phase = 'success';
        _appendUpdateLog('✔ Cập nhật hoàn tất.');
      } else {
        _updateState.phase = 'error';
        _updateState.error = `Exit code: ${code}`;
        _appendUpdateLog(`✗ Cập nhật thất bại (exit ${code}).`);
      }
    });

    return { ok: true };
  },

  // ── Server control ─────────────────────────────────────────────────────────

  restartServer() {
    // Fire pm2 reload in background so HTTP response is sent first
    spawn('pm2', ['reload', 'ke-toan-backend'], { detached: true, stdio: 'ignore' }).unref();
  },

  async getStartupStatus(): Promise<{ configured: boolean }> {
    if (os.platform() !== 'linux') return { configured: false };
    return new Promise((resolve) => {
      exec('whoami', (err, user) => {
        if (err) return resolve({ configured: false });
        exec(`systemctl is-enabled pm2-${user.trim()} 2>/dev/null`, (err2) => {
          resolve({ configured: !err2 });
        });
      });
    });
  },

  async setupStartup(): Promise<{ ok: boolean; message: string; command?: string }> {
    if (os.platform() !== 'linux') {
      return { ok: false, message: 'Chỉ hỗ trợ trên Linux / Raspberry Pi.' };
    }
    try {
      // Save current PM2 process list first
      await _run('pm2 save --force');

      // Check if already configured
      const { configured } = await adminService.getStartupStatus();
      if (configured) {
        return { ok: true, message: 'PM2 đã được cấu hình tự động khởi động. Danh sách tiến trình đã được lưu lại.' };
      }

      // Get the startup command from pm2 (captures stdout+stderr)
      const startupOutput = await new Promise<string>((resolve) => {
        exec('pm2 startup systemd 2>&1', { timeout: 15_000 }, (_, stdout, stderr) => {
          resolve((stdout || '') + (stderr || ''));
        });
      });

      // Extract the "sudo env PATH=..." command
      const match = startupOutput.match(/sudo\s+env\s+[^\n]+/);
      const sudoCmd = match ? match[0].trim() : null;

      if (sudoCmd) {
        try {
          await _run(sudoCmd);
          await _run('pm2 save --force');
          return { ok: true, message: '✔ Đã cấu hình tự động khởi động thành công!' };
        } catch {
          return {
            ok: false,
            message: 'Cần chạy 2 lệnh sau trong terminal SSH rồi nhấn Thiết lập lại:',
            command: sudoCmd + '\npm2 save',
          };
        }
      }

      return {
        ok: false,
        message: 'Chạy 2 lệnh sau trong terminal SSH:',
        command: 'pm2 startup\npm2 save',
      };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  },

  getNetworkInfo() {    const interfaces = os.networkInterfaces();
    const allIPs: string[] = [];

    for (const addrs of Object.values(interfaces)) {
      for (const addr of addrs || []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          allIPs.push(addr.address);
        }
      }
    }

    // Tailscale uses 100.64.0.0/10 CGNAT range
    const isTailscale = (ip: string) => {
      const parts = ip.split('.').map(Number);
      return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
    };

    const tailscaleIPs = allIPs.filter(isTailscale);
    const lanIPs = allIPs.filter((ip) => !isTailscale(ip));
    const port = parseInt(process.env.PORT || '3001', 10);
    const isProd = process.env.NODE_ENV === 'production';

    return {
      hostname: os.hostname(),
      backendPort: port,
      lanIPs,
      tailscaleIPs,
      isProd,
    };
  },

  async purgeAll() {
    // Xóa toàn bộ dữ liệu nghiệp vụ, giữ lại: User, CashflowCategory
    await prisma.$transaction(async (tx) => {
      await tx.deleteRequest.deleteMany();
      await tx.activityLog.deleteMany();
      await tx.cashflow.deleteMany();
      await tx.supplierPayment.deleteMany();
      await tx.inventoryLog.deleteMany();
      await tx.invoiceItem.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.payment.deleteMany();
      await tx.invoice.deleteMany();
      await tx.purchaseOrder.deleteMany();
      await tx.customer.deleteMany();
      await tx.supplier.deleteMany();
      await tx.product.deleteMany();
    });
  },

  getVersion() {
    try {
      const pkgPath = path.join(__dirname, '../../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return { version: pkg.version || '1.0.0' };
    } catch {
      return { version: '1.0.0' };
    }
  },
};
