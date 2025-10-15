interface ProvidersTabProps {
  providers: any[] | undefined;
}

export default function ProvidersTab({ providers }: ProvidersTabProps) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
      padding: '1.5rem'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Providers</h2>
      {providers && providers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {providers.map((provider: any) => (
            <div key={provider.id} style={{
              padding: '1.5rem',
              border: '1px solid #e5e5e5',
              borderRadius: '6px'
            }}>
              {/* Provider Header */}
              <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e5e5' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  {provider.full_name || provider.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'monospace' }}>
                    ID: {provider.id}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(provider.id);
                      alert('Provider ID copied to clipboard!');
                    }}
                    style={{
                      padding: '0.125rem 0.5rem',
                      fontSize: '0.625rem',
                      backgroundColor: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                    title="Copy provider ID"
                  >
                    Copy ID
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {provider.provider_type && (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af'
                    }}>
                      {provider.provider_type}
                    </span>
                  )}
                  {provider.role && (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: '#fef3c7',
                      color: '#92400e'
                    }}>
                      {provider.role}
                    </span>
                  )}
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    backgroundColor: provider.verified ? '#d1fae5' : '#f3f4f6',
                    color: provider.verified ? '#065f46' : '#374151'
                  }}>
                    {provider.verified ? 'Verified' : 'Not Verified'}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    backgroundColor: provider.records_received ? '#d1fae5' : '#f3f4f6',
                    color: provider.records_received ? '#065f46' : '#374151'
                  }}>
                    {provider.records_received ? 'Records Received' : 'Awaiting Records'}
                  </span>
                </div>
              </div>

              {/* Provider Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {provider.specialty && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Specialty</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>{provider.specialty}</p>
                  </div>
                )}
                {provider.organization && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Organization</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>{provider.organization}</p>
                  </div>
                )}
                {provider.phone_number && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Phone</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>{provider.phone_number}</p>
                  </div>
                )}
                {provider.fax_number && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Fax</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>{provider.fax_number}</p>
                  </div>
                )}
                {provider.npi && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>NPI</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>{provider.npi}</p>
                  </div>
                )}
                {(provider.city || provider.state) && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Location</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                      {[provider.city, provider.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Address - Full Width */}
              {provider.address && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Address</p>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>{provider.address}</p>
                </div>
              )}

              {/* Context in Case */}
              {provider.context_in_case && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  borderLeft: '3px solid #3b82f6'
                }}>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Role in Case</p>
                  <p style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>{provider.context_in_case}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#666' }}>No providers extracted yet.</p>
      )}
    </div>
  );
}
