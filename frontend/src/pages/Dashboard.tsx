import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PatientCaseSelector from '../components/PatientCaseSelector';
import WorkflowSelector from '../components/WorkflowSelector';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);
  const [selectedPatientCaseId, setSelectedPatientCaseId] = useState<number | null>(null);

  const { data: patientCases, isLoading, error } = useQuery({
    queryKey: ['patient-cases-with-workflows'],
    queryFn: api.getPatientCasesWithWorkflows,
  });

  const startWorkflowMutation = useMutation({
    mutationFn: ({ patientCaseId, workflowName, parameters, scheduledAt }: {
      patientCaseId: number;
      workflowName: string;
      parameters: any;
      scheduledAt?: string;
    }) => api.startWorkflow(patientCaseId, workflowName, parameters, scheduledAt),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-cases-with-workflows'] });
      setShowWorkflowSelector(false);
      setSelectedPatientCaseId(null);
      // Navigate to the patient case detail page
      navigate(`/cases/${variables.patientCaseId}`);
    },
  });

  const handlePatientSelect = (patientCaseId: number) => {
    setSelectedPatientCaseId(patientCaseId);
    setShowPatientSelector(false);
    setShowWorkflowSelector(true);
  };

  const handleWorkflowStart = (workflowName: string, parameters: any, scheduledAt?: string) => {
    if (selectedPatientCaseId) {
      startWorkflowMutation.mutate({ patientCaseId: selectedPatientCaseId, workflowName, parameters, scheduledAt });
    }
  };

  const handleCancel = () => {
    setShowPatientSelector(false);
    setShowWorkflowSelector(false);
    setSelectedPatientCaseId(null);
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading patient cases...</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626' }}>
        Error loading patient cases: {error.message}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Patient Cases with Workflows</h1>
          <p style={{ color: '#666' }}>Patients with active or completed workflows</p>
        </div>
        <button
          onClick={() => setShowPatientSelector(true)}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>+</span>
          Create New Workflow
        </button>
      </div>

      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e5e5',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e5e5' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                ID
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Name
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Phone
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Condition
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Status
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Created
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {patientCases?.map((patientCase: any) => (
              <tr key={patientCase.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.id}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  {patientCase.first_name} {patientCase.last_name}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.phone || 'N/A'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.condition || 'N/A'}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
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
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  {new Date(patientCase.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Link
                    to={`/cases/${patientCase.id}`}
                    style={{
                      color: '#2563eb',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}
                  >
                    View Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Patient Case Selector Modal */}
      {showPatientSelector && (
        <PatientCaseSelector
          onSelect={handlePatientSelect}
          onCancel={handleCancel}
        />
      )}

      {/* Workflow Selector Modal */}
      {showWorkflowSelector && selectedPatientCaseId && (
        <WorkflowSelector
          patientCaseId={selectedPatientCaseId}
          onStart={handleWorkflowStart}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

function getStatusColor(status: string | null) {
  switch (status?.toLowerCase()) {
    case 'pending':
      return '#9ca3af';
    case 'in_progress':
      return '#3b82f6';
    case 'completed':
      return '#10b981';
    case 'failed':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}
