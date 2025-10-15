interface CommunicationsTabProps {
  communications: any[] | undefined;
}

export default function CommunicationsTab({ communications }: CommunicationsTabProps) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
      padding: '1.5rem'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Communications</h2>
      {communications && communications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {communications.map((comm: any) => (
            <div key={comm.id} style={{
              padding: '1rem',
              border: '1px solid #e5e5e5',
              borderRadius: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  fontSize: '0.875rem'
                }}>
                  {comm.type} - {comm.direction}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#666'
                }}>
                  {new Date(comm.created_at).toLocaleString()}
                </span>
              </div>
              {comm.content && (
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>{comm.content}</p>
              )}
              <span style={{
                display: 'inline-block',
                marginTop: '0.5rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                backgroundColor: '#f3f4f6'
              }}>
                {comm.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#666' }}>No communications yet.</p>
      )}
    </div>
  );
}
