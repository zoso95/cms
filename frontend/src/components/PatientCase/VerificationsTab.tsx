import VerificationCard from './VerificationCard';

interface VerificationsTabProps {
  verifications: any[] | undefined;
  approveVerificationMutation: any;
  rejectVerificationMutation: any;
}

export default function VerificationsTab({
  verifications,
  approveVerificationMutation,
  rejectVerificationMutation,
}: VerificationsTabProps) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
      padding: '1.5rem'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Provider Verifications</h2>
      {verifications && verifications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {verifications.map((verification: any) => (
            <VerificationCard
              key={verification.id}
              verification={verification}
              approveVerificationMutation={approveVerificationMutation}
              rejectVerificationMutation={rejectVerificationMutation}
            />
          ))}
        </div>
      ) : (
        <p style={{ color: '#666' }}>No verification requests yet.</p>
      )}
    </div>
  );
}
