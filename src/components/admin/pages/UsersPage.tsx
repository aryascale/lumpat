import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface UserRow {
  id: string;
  email: string;
  username: string;
  name?: string;
  role: string;
  isEmailVerified: boolean;
  createdAt: string;
}

const roleOptions = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'event_admin', label: 'Event Admin' },
  { value: 'scan_admin', label: 'Scan Admin' },
  { value: 'payment_admin', label: 'Payment Admin' },
  { value: 'user', label: 'User' },
];

const roleColors: Record<string, string> = {
  super_admin: 'purple',
  event_admin: 'blue',
  scan_admin: 'green',
  payment_admin: 'gold',
  user: 'gray',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error: any) {
      message.error(error.message || 'Gagal memuat user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) =>
      user.email.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      (user.name || '').toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const openCreateModal = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (user: UserRow) => {
    setEditingId(user.id);
    form.setFieldsValue({
      email: user.email,
      username: user.username,
      name: user.name || '',
      role: user.role,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        id: editingId,
      };

      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin-users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan user');

      message.success(editingId ? 'User berhasil diupdate' : 'User berhasil dibuat');
      setModalOpen(false);
      form.resetFields();
      await loadUsers();
    } catch (error: any) {
      message.error(error.message || 'Gagal menyimpan user');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/admin-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus user');
      message.success('User berhasil dihapus');
      await loadUsers();
    } catch (error: any) {
      message.error(error.message || 'Gagal menghapus user');
    }
  };

  const columns: ColumnsType<UserRow> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-900">{record.name || record.username}</div>
          <div className="text-xs text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={roleColors[role] || 'default'}>{role.replace('_', ' ')}</Tag>
      ),
    },
    {
      title: 'Email Verified',
      dataIndex: 'isEmailVerified',
      key: 'isEmailVerified',
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'red'}>{value ? 'Verified' : 'Unverified'}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString('id-ID'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEditModal(record)}>Edit</Button>
          <Button danger size="small" onClick={() => handleDelete(record.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">Users</h1>
          <p className="text-sm text-gray-500">Kelola akun admin dan role user dari sini.</p>
        </div>
        <Button type="primary" onClick={openCreateModal}>+ Add User</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
        <Input
          placeholder="Cari email, username, nama, atau role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title={editingId ? 'Edit User' : 'Add User'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, type: 'email' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  return /^[^\s@]+@lumpat\.co\.id$/i.test(String(value).trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error('Email harus menggunakan domain @lumpat.co.id'));
                },
              },
            ]}
          >
            <Input placeholder="nama@lumpat.co.id" />
          </Form.Item>

          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input placeholder="eventadmin" />
          </Form.Item>

          <Form.Item name="name" label="Name">
            <Input placeholder="Nama lengkap" />
          </Form.Item>

          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={roleOptions} placeholder="Pilih role" />
          </Form.Item>

          {!editingId && (
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="Minimal 6 karakter" />
            </Form.Item>
          )}

          {editingId && (
            <Form.Item name="password" label="New Password (opsional)">
              <Input.Password placeholder="Kosongkan jika tidak ingin mengubah" />
            </Form.Item>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="primary" htmlType="submit">{editingId ? 'Update' : 'Create'}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
