import { getPriorityLabel, getPriorityColor, getStatusColor } from '../../utils/patientHelpers';

interface PatientInfoCardProps {
  patientCase: any;
  onStartWorkflow: () => void;
  isStartingWorkflow: boolean;
}

export default function PatientInfoCard({ patientCase, onStartWorkflow, isStartingWorkflow }: PatientInfoCardProps) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {patientCase.first_name} {patientCase.last_name}
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Phone</p>
              <p style={{ fontWeight: '500' }}>{patientCase.phone || 'N/A'}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Email</p>
              <p style={{ fontWeight: '500' }}>{patientCase.email || 'N/A'}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>State</p>
              <p style={{ fontWeight: '500' }}>{patientCase.state || 'N/A'}</p>
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Condition</p>
              <p style={{ fontWeight: '500' }}>{patientCase.condition || 'N/A'}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Incident Date</p>
              <p style={{ fontWeight: '500' }}>
                {patientCase.incident_date ? new Date(patientCase.incident_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Priority</p>
              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: getPriorityColor(patientCase.priority),
                color: '#fff'
              }}>
                {getPriorityLabel(patientCase.priority)}
              </span>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Status</p>
              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: getStatusColor(patientCase.status),
                color: '#fff'
              }}>
                {patientCase.status || 'pending'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onStartWorkflow}
          disabled={isStartingWorkflow}
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontWeight: '500',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          {isStartingWorkflow ? 'Starting...' : 'Start Workflow'}
        </button>
      </div>
    </div>
  );
}
