import { useState } from 'react';

interface VerificationCardProps {
  verification: any;
  approveVerificationMutation: any;
  rejectVerificationMutation: any;
}

export default function VerificationCard({
  verification,
  approveVerificationMutation,
  rejectVerificationMutation,
}: VerificationCardProps) {
  const [formData, setFormData] = useState({
    fullName: verification.provider?.full_name || verification.provider?.name || '',
    faxNumber: verification.npi_lookup_results?.provider?.faxNumber || '',
    email: verification.npi_lookup_results?.provider?.email || '',
    organization: verification.npi_lookup_results?.provider?.organization || verification.extracted_provider_info?.organization || '',
    specialty: verification.npi_lookup_results?.provider?.specialty || verification.extracted_provider_info?.specialty || '',
    address: verification.npi_lookup_results?.provider?.address || '',
    city: verification.npi_lookup_results?.provider?.city || verification.extracted_provider_info?.city || '',
    state: verification.npi_lookup_results?.provider?.state || verification.extracted_provider_info?.state || '',
    phoneNumber: verification.npi_lookup_results?.provider?.phoneNumber || '',
    npi: verification.npi_lookup_results?.provider?.npi || '',
  });

  return (
    <div
      key={verification.id}
      style={{
        padding: '1.5rem',
        border: '2px solid #e5e5e5',
        borderRadius: '8px',
        backgroundColor: verification.status === 'pending' ? '#fffbeb' : '#fff',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e5e5' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
            {verification.provider?.full_name || verification.provider?.name || 'Unknown Provider'}
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#666' }}>
            Created: {new Date(verification.created_at).toLocaleString()}
          </p>
        </div>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '500',
            backgroundColor: verification.status === 'pending' ? '#fbbf24' : verification.status === 'approved' ? '#10b981' : '#ef4444',
            color: '#fff',
          }}
        >
          {verification.status}
        </span>
      </div>

      {/* Call Transcript */}
      {verification.call_transcript?.transcript && (
        <div style={{ marginBottom: '1rem' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
              Call Transcript
            </summary>
            <div
              style={{
                marginTop: '0.5rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                fontSize: '0.875rem',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflow: 'auto',
              }}
            >
              {verification.call_transcript.transcript}
            </div>
          </details>
        </div>
      )}

      {/* Extracted Provider Info */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>Extracted from Call</h4>
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {JSON.stringify(verification.extracted_provider_info, null, 2)}
          </pre>
        </div>
      </div>

      {/* NPI Lookup Results */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>NPI Registry Lookup</h4>
        {verification.npi_lookup_results ? (
          <div>
            {verification.npi_lookup_results.provider && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#d1fae5',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem',
                }}
              >
                <p style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#065f46' }}>Best Match Found:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <strong>Name:</strong> {verification.npi_lookup_results.provider.firstName} {verification.npi_lookup_results.provider.lastName}
                  </div>
                  <div>
                    <strong>NPI:</strong> {verification.npi_lookup_results.provider.npi}
                  </div>
                  <div>
                    <strong>Organization:</strong> {verification.npi_lookup_results.provider.organization}
                  </div>
                  <div>
                    <strong>Fax:</strong> {verification.npi_lookup_results.provider.faxNumber || 'N/A'}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Address:</strong> {verification.npi_lookup_results.provider.address}
                  </div>
                  {verification.npi_lookup_results.provider.specialty && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <strong>Specialty:</strong> {verification.npi_lookup_results.provider.specialty}
                    </div>
                  )}
                </div>
              </div>
            )}
            {verification.npi_lookup_results.candidates && verification.npi_lookup_results.candidates.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#666' }}>
                  View {verification.npi_lookup_results.candidates.length} candidate(s)
                </summary>
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {JSON.stringify(verification.npi_lookup_results.candidates, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#991b1b',
            }}
          >
            No results found in NPI registry
          </div>
        )}
      </div>

      {/* Verification Form or Result */}
      {verification.status === 'pending' ? (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fff',
            border: '2px solid #3b82f6',
            borderRadius: '6px',
          }}
        >
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1e40af' }}>Verify Contact Information</h4>
          <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem' }}>* At least one contact method (fax or email) is required</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Fax Number</label>
              <input
                type="text"
                value={formData.faxNumber}
                onChange={(e) => setFormData({ ...formData, faxNumber: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Organization</label>
              <input
                type="text"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Specialty</label>
              <input
                type="text"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>NPI</label>
              <input
                type="text"
                value={formData.npi}
                onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Phone Number</label>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                if (!formData.faxNumber && !formData.email) {
                  alert('Please provide at least a fax number or email');
                  return;
                }
                if (confirm('Approve this verification? This will update the provider record.')) {
                  approveVerificationMutation.mutate({
                    verificationId: verification.id,
                    contactInfo: formData,
                  });
                }
              }}
              disabled={approveVerificationMutation.isPending}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {approveVerificationMutation.isPending ? 'Approving...' : 'Approve'}
            </button>
            <button
              onClick={() => {
                const reason = prompt('Why are you rejecting this verification?');
                if (reason) {
                  rejectVerificationMutation.mutate({
                    verificationId: verification.id,
                    reason,
                  });
                }
              }}
              disabled={rejectVerificationMutation.isPending}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {rejectVerificationMutation.isPending ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      ) : verification.status === 'approved' ? (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#d1fae5',
            border: '1px solid #10b981',
            borderRadius: '6px',
          }}
        >
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#065f46' }}>Verified Contact Information</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.875rem' }}>
            {verification.verified_contact_info?.fullName && (
              <div style={{ gridColumn: 'span 2' }}><strong>Full Name:</strong> {verification.verified_contact_info.fullName}</div>
            )}
            {verification.verified_contact_info?.faxNumber && <div><strong>Fax:</strong> {verification.verified_contact_info.faxNumber}</div>}
            {verification.verified_contact_info?.email && <div><strong>Email:</strong> {verification.verified_contact_info.email}</div>}
            {verification.verified_contact_info?.phoneNumber && <div><strong>Phone:</strong> {verification.verified_contact_info.phoneNumber}</div>}
            {verification.verified_contact_info?.npi && <div><strong>NPI:</strong> {verification.verified_contact_info.npi}</div>}
            {verification.verified_contact_info?.organization && (
              <div style={{ gridColumn: 'span 2' }}><strong>Organization:</strong> {verification.verified_contact_info.organization}</div>
            )}
            {verification.verified_contact_info?.specialty && (
              <div style={{ gridColumn: 'span 2' }}><strong>Specialty:</strong> {verification.verified_contact_info.specialty}</div>
            )}
            {verification.verified_contact_info?.address && (
              <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {verification.verified_contact_info.address}</div>
            )}
            {verification.verified_contact_info?.city && <div><strong>City:</strong> {verification.verified_contact_info.city}</div>}
            {verification.verified_contact_info?.state && <div><strong>State:</strong> {verification.verified_contact_info.state}</div>}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#065f46', marginTop: '0.75rem' }}>
            Verified by {verification.verified_by} on {new Date(verification.verified_at).toLocaleString()}
          </p>
        </div>
      ) : (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '6px',
          }}
        >
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#991b1b' }}>Rejected</h4>
          <p style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>Reason: {verification.verified_contact_info?.rejection_reason || 'No reason provided'}</p>
          <p style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '0.5rem' }}>
            Rejected by {verification.verified_by} on {new Date(verification.verified_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
