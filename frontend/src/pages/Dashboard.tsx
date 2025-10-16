import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PatientCaseSelector from '../components/PatientCaseSelector';
import WorkflowSelector from '../components/WorkflowSelector';
import { AddPatientModal } from '../components/AddPatientModal';
import { getPriorityLabel, getPriorityColor, getStatusColor } from '../utils/patientHelpers';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [selectedPatientCaseId, setSelectedPatientCaseId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const { data: patientCasesWithWorkflows, isLoading: loadingWithWorkflows, error: errorWithWorkflows } = useQuery({
    queryKey: ['patient-cases-with-workflows'],
    queryFn: api.getPatientCasesWithWorkflows,
  });

  const { data: allPatientCasesResponse, isLoading: loadingAllCases, error: errorAllCases } = useQuery({
    queryKey: ['patient-cases', page, limit],
    queryFn: () => api.getPatientCases(page, limit),
  });

  const isLoading = loadingWithWorkflows || loadingAllCases;
  const error = errorWithWorkflows || errorAllCases;

  const allPatientCases = allPatientCasesResponse?.data || [];
  const pagination = allPatientCasesResponse?.pagination;

  // Calculate patients without workflows
  const patientCasesWithoutWorkflows = allPatientCases.filter((patientCase: any) => {
    return !patientCasesWithWorkflows?.some((pc: any) => pc.id === patientCase.id);
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

  const initializeTasksMutation = useMutation({
    mutationFn: (patientCaseId: number) => api.initializePatientTasks(String(patientCaseId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-tasks', selectedPatientCaseId] });
    },
  });

  // Fetch tasks for selected patient case
  const { data: tasks } = useQuery({
    queryKey: ['patient-case-tasks', selectedPatientCaseId],
    queryFn: () => api.getPatientCaseTasks(String(selectedPatientCaseId)),
    enabled: !!selectedPatientCaseId,
  });

  const handlePatientSelect = (patientCaseId: number) => {
    setSelectedPatientCaseId(patientCaseId);
    setShowPatientSelector(false);
    setShowWorkflowSelector(true);
  };

  const handleWorkflowStart = async (workflowName: string, parameters: any, scheduledAt?: string) => {
    if (selectedPatientCaseId) {
      // Frontend hack: Initialize tasks if they don't exist
      if (!tasks || tasks.length === 0) {
        await initializeTasksMutation.mutateAsync(selectedPatientCaseId);
      }
      startWorkflowMutation.mutate({ patientCaseId: selectedPatientCaseId, workflowName, parameters, scheduledAt });
    }
  };

  const handleCancel = () => {
    setShowPatientSelector(false);
    setShowWorkflowSelector(false);
    setSelectedPatientCaseId(null);
  };

  const handlePatientCreated = () => {
    // Invalidate queries to refresh the patient list
    queryClient.invalidateQueries({ queryKey: ['patient-cases'] });
    queryClient.invalidateQueries({ queryKey: ['patient-cases-with-workflows'] });
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
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setShowAddPatientModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              border: '1px solid #2563eb',
              backgroundColor: '#fff',
              color: '#2563eb',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>+</span>
            Add New Patient
          </button>
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
                State
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Incident Date
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                Priority
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
            {patientCasesWithWorkflows?.map((patientCase: any) => (
              <tr key={patientCase.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.id}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  {patientCase.first_name} {patientCase.last_name}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.phone || 'N/A'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <div style={{
                    maxWidth: '400px',
                    maxHeight: '60px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    wordWrap: 'break-word',
                  }}>
                    {patientCase.condition || 'N/A'}
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.state || 'N/A'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  {patientCase.incident_date ? new Date(patientCase.incident_date).toLocaleDateString() : 'N/A'}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
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
                </td>
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

      {/* Patients Without Workflows */}
      {patientCasesWithoutWorkflows.length > 0 && (
        <>
          <div style={{ marginTop: '3rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Patient Cases Without Workflows
            </h2>
            <p style={{ color: '#666' }}>Patients that haven't had workflows started yet</p>
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
                    State
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Incident Date
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Priority
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
                {patientCasesWithoutWorkflows.map((patientCase: any) => (
                  <tr key={patientCase.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.id}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      {patientCase.first_name} {patientCase.last_name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.phone || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <div style={{
                        maxWidth: '400px',
                        maxHeight: '60px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        wordWrap: 'break-word',
                      }}>
                        {patientCase.condition || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.state || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      {patientCase.incident_date ? new Date(patientCase.incident_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
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
                    </td>
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

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div style={{
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f9fafb',
                borderTop: '1px solid #e5e5e5',
              }}>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} patient cases
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '4px',
                      border: '1px solid #e5e5e5',
                      backgroundColor: page === 1 ? '#f3f4f6' : '#fff',
                      cursor: page === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      color: page === 1 ? '#9ca3af' : '#374151',
                    }}
                  >
                    Previous
                  </button>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #e5e5e5',
                            backgroundColor: page === pageNum ? '#2563eb' : '#fff',
                            color: page === pageNum ? '#fff' : '#374151',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: page === pageNum ? '500' : '400',
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '4px',
                      border: '1px solid #e5e5e5',
                      backgroundColor: page === pagination.totalPages ? '#f3f4f6' : '#fff',
                      cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      color: page === pagination.totalPages ? '#9ca3af' : '#374151',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Patient Modal */}
      <AddPatientModal
        isOpen={showAddPatientModal}
        onClose={() => setShowAddPatientModal(false)}
        onSuccess={handlePatientCreated}
      />

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
