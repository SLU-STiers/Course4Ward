import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/domainApi';

export function AdminPanel() {
  const [tab, setTab] = useState<'users' | 'logs'>('users');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
          Accounts
        </TabButton>
        <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>
          Audit logs & analytics
        </TabButton>
      </div>
      {tab === 'users' ? <AccountsPanel /> : <AuditPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        background: active ? '#0f172a' : 'white',
        color: active ? 'white' : '#0f172a',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function AccountsPanel() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  });

  const [form, setForm] = useState({
    userId: '',
    firstName: '',
    lastName: '',
    role: 'NURSE',
    temporaryPassword: '',
  });

  const createUser = useMutation({
    mutationFn: () => adminApi.createUser(form),
    onSuccess: () => {
      setForm({ userId: '', firstName: '', lastName: '', role: 'NURSE', temporaryPassword: '' });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 }}>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Add account</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="User ID (e.g. DRJ-0231)"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
          />
          <input
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="PHYSICIAN">Physician</option>
            <option value="NURSE">Nurse</option>
            <option value="CLAIMS_PROCESSOR">Claims Processor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input
            placeholder="Temporary password"
            type="password"
            value={form.temporaryPassword}
            onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
          />
          <button onClick={() => createUser.mutate()}>Create account</button>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Staff accounts</h4>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th>User ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: any) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td>{u.userId}</td>
                <td>
                  {u.firstName} {u.lastName}
                </td>
                <td>{u.role}</td>
                <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                <td>
                  {u.isActive && (
                    <button onClick={() => deactivate.mutate(u.id)} style={{ fontSize: 12 }}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditPanel() {
  const { data: logs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminApi.auditLogs({ take: 50 }).then((r) => r.data),
  });

  const { data: orderStats } = useQuery({
    queryKey: ['order-analytics'],
    queryFn: () => adminApi.ordersAnalytics('day').then((r) => r.data),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Recent transactions</h4>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((l: any) => (
              <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : '—'}</td>
                <td>{l.action}</td>
                <td>{l.entityType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Physician orders / day</h4>
        <ul style={{ fontSize: 13 }}>
          {(orderStats as any[])?.map((row, i) => (
            <li key={i}>
              {new Date(row.period).toLocaleDateString()}: {row.count}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
