import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { claimsApi } from '../services/domainApi';

export function ClaimsProcessorDashboard() {
  const qc = useQueryClient();
  const { data: claims } = useQuery({
    queryKey: ['claims'],
    queryFn: () => claimsApi.findAll().then((r) => r.data),
  });

  const notify = useMutation({
    mutationFn: (id: string) => claimsApi.notifyPhysician(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });

  const generateCf4 = useMutation({
    mutationFn: (id: string) => claimsApi.generateCf4(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });

  return (
    <div>
      <h2>Claims Review — Course in the Ward</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {claims?.map((c) => (
          <div
            key={c.id}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Claim {c.id.slice(0, 8)}</div>
              <div style={{ fontWeight: 600 }}>{c.status.replace(/_/g, ' ')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => notify.mutate(c.id)} disabled={notify.isPending}>
                Notify physician
              </button>
              <button
                onClick={() => generateCf4.mutate(c.id)}
                disabled={generateCf4.isPending || c.cf4Generated}
              >
                {c.cf4Generated ? 'CF4 generated' : 'Auto-populate CF4'}
              </button>
            </div>
          </div>
        ))}
        {!claims?.length && (
          <p style={{ color: '#64748b' }}>No claims pending review.</p>
        )}
      </div>
    </div>
  );
}
