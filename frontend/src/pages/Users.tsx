import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const empty = { username: '', password: '', name: '', role: 'staff' };

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows]   = useState<any[]>([]);
  const [form, setForm]   = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; username: string; name: string; role: string } | null>(null);

  const [filter, setFilter] = useState<FilterState>(defaultFilter);

  const load = () => api.get('/users').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((u) =>
        u.username?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q)
      );
    }
    if (filter.status) r = r.filter((u) => u.role === filter.status);
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'name') return dir * a.name.localeCompare(b.name);
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew  = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (u: any) => { setEditId(u.id); setForm({ username: u.username, password: '', name: u.name, role: u.role }); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        const data: any = { name: form.name, role: form.role };
        if (form.password) data.password = form.password;
        await api.put(`/users/${editId}`, data);
      } else {
        await api.post('/users', form);
      }
      setForm(empty); setEditId(null); setOpen(false); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi'); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/users/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Không thể xóa tài khoản');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Người dùng</h1>
        <button className="btn cyan" onClick={openNew}>+ Tạo tài khoản</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div>
                <label className="lbl">Tên đăng nhập {editId ? '(không đổi)' : '*'}</label>
                <input className="inp" required={!editId} disabled={!!editId} value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="lbl">{editId ? 'Mật khẩu mới (để trống = giữ)' : 'Mật khẩu *'}</label>
                <input className="inp" type="password" required={!editId} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="lbl">Họ tên *</label>
                <input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="lbl">Vai trò</label>
                <select className="inp" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="staff">Nhân viên</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn cyan">{editId ? '[ Cập nhật ]' : '[ Tạo tài khoản ]'}</button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
            </div>
          </form>
        </div>
      )}

      <FilterBar
        value={filter} onChange={setFilter}
        totalCount={rows.length} resultCount={filtered.length}
        searchPlaceholder="Tìm username, họ tên..."
        statusOptions={[
          { value: 'admin', label: 'Admin' },
          { value: 'staff', label: 'Nhân viên' },
        ]}
        sortOptions={[
          { value: 'date_desc', label: '↓ Mới nhất' },
          { value: 'date_asc',  label: '↑ Cũ nhất' },
          { value: 'name_asc',  label: 'A→Z Họ tên' },
          { value: 'name_desc', label: 'Z→A Họ tên' },
        ]}
      />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr><th>Username</th><th>Họ tên</th><th>Vai trò</th><th>Ngày tạo</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr className="empty-row"><td colSpan={5}>{rows.length === 0 ? 'Chưa có tài khoản' : 'Không tìm thấy kết quả'}</td></tr>}
            {filtered.map((u) => (
              <tr key={u.id} style={{ background: u.id === me?.id ? 'rgba(0,255,136,0.03)' : '' }}>
                <td className="c-cyan">
                  {u.username}
                  {u.id === me?.id && <span className="tag green" style={{ marginLeft: 8, fontSize: 9 }}>Bạn</span>}
                </td>
                <td className="c-bright">{u.name}</td>
                <td><span className={`tag ${u.role === 'admin' ? 'purple' : 'cyan'}`}>{u.role === 'admin' ? 'Admin' : 'Staff'}</span></td>
                <td className="c-dim">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                <td><div className="td-act">
                  <button className="btn yellow btn-sm" onClick={() => openEdit(u)}>Sửa</button>
                  {u.id !== me?.id && (
                    <button className="btn red btn-sm" onClick={() => setConfirmDelete({ id: u.id, username: u.username, name: u.name, role: u.role })}>Xóa</button>
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Xóa tài khoản "${confirmDelete.username}"`}
          message={`Tài khoản của ${confirmDelete.name} sẽ bị xóa vĩnh viễn khỏi hệ thống.`}
          warning={confirmDelete.role === 'admin' ? 'Đây là tài khoản Admin — hệ thống sẽ từ chối nếu đây là admin cuối cùng.' : undefined}
          confirmLabel="Xác nhận xóa"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
