import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import WorkflowSelector from '../components/WorkflowSelector';
import { getSocket, subscribeToPatientCase, unsubscribeFromPatientCase } from '../lib/socket';
import { getPriorityLabel, getPriorityColor, getStatusColor } from '../utils/patientHelpers';

// Workflow card component
function WorkflowCard({
  workflow,
  isChild = false,
  stopWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  deleteWorkflow,
  isStoppingWorkflow,
  isPausingWorkflow,
  isResumingWorkflow,
  isDeletingWorkflow,
}: {
  workflow: any;
  isChild?: boolean;
  stopWorkflow: (workflowId: string) => void;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  deleteWorkflow: (executionId: string) => void;
  isStoppingWorkflow: boolean;
  isPausingWorkflow: boolean;
  isResumingWorkflow: boolean;
  isDeletingWorkflow: boolean;
}) {
  return (
    <div
      key={workflow.id}
      style={{
        padding: '1rem',
        border: '1px solid #e5e5e5',
        borderRadius: '6px',
        marginLeft: isChild ? '2rem' : '0',
        borderLeft: isChild ? '3px solid #3b82f6' : undefined,
        backgroundColor: isChild ? '#f9fafb' : '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            {isChild && <span style={{ fontSize: '0.875rem', color: '#666' }}>↳</span>}
            <p style={{ fontWeight: '500' }}>
              {workflow.workflow_name || 'Unknown Workflow'}
            </p>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
            ID: {workflow.workflow_id}
          </p>
          {workflow.entity_type && workflow.entity_id && (
            <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
              {workflow.entity_type === 'provider' && workflow.entity_name ? (
                <>Provider: {workflow.entity_name}</>
              ) : (
                <>Entity: {workflow.entity_type} #{workflow.entity_id}</>
              )}
            </p>
          )}
          {workflow.status === 'scheduled' && workflow.scheduled_at ? (
            <p style={{ fontSize: '0.875rem', color: '#2563eb', marginTop: '0.5rem', fontWeight: '500' }}>
              Scheduled to run at: {new Date(workflow.scheduled_at).toLocaleString()}
            </p>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              Started: {new Date(workflow.started_at).toLocaleString()}
            </p>
          )}
          {workflow.completed_at && (
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Completed: {new Date(workflow.completed_at).toLocaleString()}
            </p>
          )}
          {workflow.status_message && (
            <p style={{ fontSize: '0.875rem', color: '#2563eb', marginTop: '0.5rem', fontWeight: '500' }}>
              Status: {workflow.status_message}
            </p>
          )}
          {workflow.error && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
              }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: '500', color: '#c00', marginBottom: '0.25rem' }}>
                Error:
              </p>
              <p style={{ fontSize: '0.75rem', color: '#600', whiteSpace: 'pre-wrap' }}>{workflow.error}</p>
            </div>
          )}
          <a
            href={`http://localhost:8233/namespaces/default/workflows/${workflow.workflow_id}/${workflow.run_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: '0.5rem',
              color: '#2563eb',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            View in Temporal UI →
          </a>
        </div>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '500',
            backgroundColor:
              workflow.status === 'scheduled'
                ? '#8b5cf6'
                : workflow.status === 'running'
                ? '#3b82f6'
                : workflow.status === 'completed'
                ? '#10b981'
                : workflow.status === 'failed'
                ? '#ef4444'
                : workflow.status === 'terminated'
                ? '#f97316'
                : '#6b7280',
            color: '#fff',
          }}
        >
          {workflow.status}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {workflow.status === 'running' && !workflow.paused && (
          <button
            onClick={() => pauseWorkflow(workflow.workflow_id)}
            disabled={isPausingWorkflow}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {isPausingWorkflow ? 'Pausing...' : 'Pause'}
          </button>
        )}
        {workflow.status === 'running' && workflow.paused && (
          <button
            onClick={() => resumeWorkflow(workflow.workflow_id)}
            disabled={isResumingWorkflow}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {isResumingWorkflow ? 'Resuming...' : 'Resume'}
          </button>
        )}
        {workflow.status === 'running' && (
          <button
            onClick={() => stopWorkflow(workflow.workflow_id)}
            disabled={isStoppingWorkflow}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {isStoppingWorkflow ? 'Stopping...' : 'Stop'}
          </button>
        )}
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this workflow execution record?')) {
              deleteWorkflow(workflow.id);
            }
          }}
          disabled={isDeletingWorkflow}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          {isDeletingWorkflow ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// Verification card component
function VerificationCard({
  verification,
  approveVerificationMutation,
  rejectVerificationMutation,
}: {
  verification: any;
  approveVerificationMutation: any;
  rejectVerificationMutation: any;
}) {
  const [formData, setFormData] = useState({
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
            {verification.verified_contact_info?.faxNumber && <div><strong>Fax:</strong> {verification.verified_contact_info.faxNumber}</div>}
            {verification.verified_contact_info?.email && <div><strong>Email:</strong> {verification.verified_contact_info.email}</div>}
            {verification.verified_contact_info?.organization && <div><strong>Organization:</strong> {verification.verified_contact_info.organization}</div>}
            {verification.verified_contact_info?.npi && <div><strong>NPI:</strong> {verification.verified_contact_info.npi}</div>}
            {verification.verified_contact_info?.address && (
              <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {verification.verified_contact_info.address}</div>
            )}
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

// Workflow hierarchy component
function WorkflowHierarchy({
  workflows,
  stopWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  deleteWorkflow,
  isStoppingWorkflow,
  isPausingWorkflow,
  isResumingWorkflow,
  isDeletingWorkflow,
}: {
  workflows: any[];
  stopWorkflow: (workflowId: string) => void;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  deleteWorkflow: (executionId: string) => void;
  isStoppingWorkflow: boolean;
  isPausingWorkflow: boolean;
  isResumingWorkflow: boolean;
  isDeletingWorkflow: boolean;
}) {
  // Separate parent workflows from children
  const parentWorkflows = workflows.filter((w) => !w.parent_workflow_id);
  const childWorkflows = workflows.filter((w) => w.parent_workflow_id);

  // Group children by parent workflow ID
  const childrenByParent = childWorkflows.reduce((acc, child) => {
    const parentId = child.parent_workflow_id;
    if (!acc[parentId]) {
      acc[parentId] = [];
    }
    acc[parentId].push(child);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {parentWorkflows.map((parent) => (
        <div key={parent.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Parent workflow */}
          <WorkflowCard
            workflow={parent}
            isChild={false}
            stopWorkflow={stopWorkflow}
            pauseWorkflow={pauseWorkflow}
            resumeWorkflow={resumeWorkflow}
            deleteWorkflow={deleteWorkflow}
            isStoppingWorkflow={isStoppingWorkflow}
            isPausingWorkflow={isPausingWorkflow}
            isResumingWorkflow={isResumingWorkflow}
            isDeletingWorkflow={isDeletingWorkflow}
          />

          {/* Child workflows */}
          {childrenByParent[parent.workflow_id]
            ?.sort((a: any, b: any) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
            .map((child: any) => (
              <WorkflowCard
                key={child.id}
                workflow={child}
                isChild={true}
                stopWorkflow={stopWorkflow}
                pauseWorkflow={pauseWorkflow}
                resumeWorkflow={resumeWorkflow}
                deleteWorkflow={deleteWorkflow}
                isStoppingWorkflow={isStoppingWorkflow}
                isPausingWorkflow={isPausingWorkflow}
                isResumingWorkflow={isResumingWorkflow}
                isDeletingWorkflow={isDeletingWorkflow}
              />
            ))}
        </div>
      ))}
    </div>
  );
}

export default function PatientCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'workflows' | 'communications' | 'providers' | 'transcripts' | 'analysis' | 'verifications'>('workflows');
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);

  const { data: patientCase, isLoading: caseLoading } = useQuery({
    queryKey: ['patient-case', id],
    queryFn: () => api.getPatientCase(id!),
    enabled: !!id,
  });

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['patient-case-workflows', id],
    queryFn: () => api.getPatientCaseWorkflows(id!),
    enabled: !!id,
  });

  const { data: communications } = useQuery({
    queryKey: ['patient-case-communications', id],
    queryFn: () => api.getPatientCaseCommunications(id!),
    enabled: !!id && activeTab === 'communications',
  });

  const { data: providers } = useQuery({
    queryKey: ['patient-case-providers', id],
    queryFn: () => api.getPatientCaseProviders(id!),
    enabled: !!id && activeTab === 'providers',
  });

  const { data: transcripts } = useQuery({
    queryKey: ['patient-case-transcripts', id],
    queryFn: () => api.getPatientCaseTranscripts(id!),
    enabled: !!id && activeTab === 'transcripts',
  });

  const { data: analysis } = useQuery({
    queryKey: ['patient-case-analysis', id],
    queryFn: () => api.getPatientCaseAnalysis(id!),
    enabled: !!id && activeTab === 'analysis',
  });

  const { data: verifications } = useQuery({
    queryKey: ['patient-case-verifications', id],
    queryFn: () => api.getPatientCaseVerifications(id!),
    enabled: !!id,
    refetchInterval: activeTab === 'verifications' ? false : 5000, // Poll when not active
  });

  // Count pending verifications
  const pendingVerificationsCount = verifications?.filter((v: any) => v.status === 'pending').length || 0;

  const startWorkflowMutation = useMutation({
    mutationFn: ({ workflowName, parameters, scheduledAt }: { workflowName: string; parameters: any; scheduledAt?: string }) =>
      api.startWorkflow(Number(id), workflowName, parameters, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case', id] });
      setShowWorkflowSelector(false);
    },
  });

  const stopWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => api.stopWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
    },
  });

  const pauseWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => api.pauseWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
    },
  });

  const resumeWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => api.resumeWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (executionId: string) => api.deleteWorkflow(executionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-cases-with-workflows'] });
    },
  });

  const approveVerificationMutation = useMutation({
    mutationFn: ({ verificationId, contactInfo }: { verificationId: string; contactInfo: any }) =>
      api.approveVerification(verificationId, contactInfo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-verifications', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-providers', id] });
    },
  });

  const rejectVerificationMutation = useMutation({
    mutationFn: ({ verificationId, reason }: { verificationId: string; reason: string }) =>
      api.rejectVerification(verificationId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-verifications', id] });
    },
  });

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!id) return;

    const patientCaseId = Number(id);
    const socket = getSocket();

    // Subscribe to this patient case
    subscribeToPatientCase(patientCaseId);

    // Listen for workflow updates
    const handleWorkflowUpdate = (data: any) => {
      console.log('Workflow updated:', data);

      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-communications', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-providers', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-transcripts', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-analysis', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-verifications', id] });
    };

    socket.on('workflow-updated', handleWorkflowUpdate);

    // Cleanup on unmount
    return () => {
      socket.off('workflow-updated', handleWorkflowUpdate);
      unsubscribeFromPatientCase(patientCaseId);
    };
  }, [id, queryClient]);

  if (caseLoading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>;
  }

  if (!patientCase) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Patient case not found</div>;
  }

  return (
    <div>
      {showWorkflowSelector && (
        <WorkflowSelector
          patientCaseId={Number(id)}
          onStart={(workflowName, parameters, scheduledAt) => {
            startWorkflowMutation.mutate({ workflowName, parameters, scheduledAt });
          }}
          onCancel={() => setShowWorkflowSelector(false)}
        />
      )}

      <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>
        ← Back to Dashboard
      </Link>

      {/* Patient Info Card */}
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
            onClick={() => setShowWorkflowSelector(true)}
            disabled={startWorkflowMutation.isPending}
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
            {startWorkflowMutation.isPending ? 'Starting...' : 'Start Workflow'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid #e5e5e5',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '2rem'
      }}>
        {(['workflows', 'communications', 'providers', 'verifications', 'transcripts', 'analysis'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: activeTab === tab ? '#2563eb' : '#666',
              borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
              textTransform: 'capitalize',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              position: 'relative'
            }}
          >
            {tab}
            {tab === 'verifications' && pendingVerificationsCount > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '1.25rem',
                height: '1.25rem',
                padding: '0 0.35rem',
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                lineHeight: '1'
              }}>
                {pendingVerificationsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'workflows' && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Workflows</h2>
          {workflowsLoading ? (
            <p>Loading workflows...</p>
          ) : workflows && workflows.length > 0 ? (
            <WorkflowHierarchy
              workflows={workflows}
              stopWorkflow={stopWorkflowMutation.mutate}
              pauseWorkflow={pauseWorkflowMutation.mutate}
              resumeWorkflow={resumeWorkflowMutation.mutate}
              deleteWorkflow={deleteWorkflowMutation.mutate}
              isStoppingWorkflow={stopWorkflowMutation.isPending}
              isPausingWorkflow={pauseWorkflowMutation.isPending}
              isResumingWorkflow={resumeWorkflowMutation.isPending}
              isDeletingWorkflow={deleteWorkflowMutation.isPending}
            />
          ) : (
            <p style={{ color: '#666' }}>No workflows started yet. Click "Start Workflow" to begin.</p>
          )}
        </div>
      )}

      {activeTab === 'communications' && (
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
      )}

      {activeTab === 'providers' && (
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
      )}

      {activeTab === 'verifications' && (
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
      )}

      {activeTab === 'transcripts' && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Call Transcripts</h2>
          {transcripts && transcripts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transcripts.map((transcript: any) => (
                <div key={transcript.id} style={{
                  padding: '1rem',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px'
                }}>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                    {new Date(transcript.created_at).toLocaleString()}
                  </p>
                  <p style={{ fontSize: '0.875rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {transcript.transcript}
                  </p>
                  {transcript.analysis && Object.keys(transcript.analysis).length > 0 && (
                    <details style={{ marginTop: '1rem' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                        View Analysis
                      </summary>
                      <pre style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(transcript.analysis, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666' }}>No transcripts available yet.</p>
          )}
        </div>
      )}

      {activeTab === 'analysis' && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Claude Case Analysis</h2>
          {analysis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Quality Score - Always Visible */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f9fafb',
                border: '2px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Quality Score</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2563eb' }}>
                      {analysis.quality_score ? analysis.quality_score.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.6' }}>
                      {analysis.summary || 'No summary available'}
                    </p>
                  </div>
                </div>
                {analysis.medical_subject && (
                  <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '1rem' }}>
                    <strong>Medical Subject:</strong> {analysis.medical_subject}
                  </p>
                )}
              </div>

              {/* Core Scales */}
              {analysis.core_scales && (
                <details open style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Core Scales
                  </summary>
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(analysis.core_scales).map(([key, value]: [string, any]) => (
                      <div key={key} style={{
                        padding: '0.75rem',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <strong style={{ fontSize: '0.875rem' }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </strong>
                          <span style={{
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            color: value?.score >= 7 ? '#10b981' : value?.score >= 4 ? '#f59e0b' : '#ef4444'
                          }}>
                            {value?.score || 'N/A'}/10
                          </span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#666' }}>{value?.reasoning || 'No reasoning provided'}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Patient Info */}
              {analysis.patient_info && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Patient Information
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.patient_info, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Doctor Info Quality */}
              {analysis.doctor_info_quality && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Doctor Information Quality
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.doctor_info_quality, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Case Factors */}
              {analysis.case_factors && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Case Factors
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.case_factors, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Legal & Practical Factors */}
              {analysis.legal_practical_factors && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Legal & Practical Factors
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.legal_practical_factors, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Call Quality Assessment */}
              {analysis.call_quality_assessment && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Call Quality Assessment
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.call_quality_assessment, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Next Actions */}
              {analysis.next_actions && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Next Actions
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.next_actions, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Compliance Notes */}
              {analysis.compliance_notes && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Compliance Notes
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.compliance_notes, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Overall Case Assessment */}
              {analysis.overall_case_assessment && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    Overall Case Assessment
                  </summary>
                  <div style={{ padding: '1rem' }}>
                    <pre style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(analysis.overall_case_assessment, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Created timestamp */}
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem', textAlign: 'right' }}>
                Analysis created: {new Date(analysis.created_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <p style={{ color: '#666' }}>No analysis available yet. The analysis will appear after a call is completed and analyzed.</p>
          )}
        </div>
      )}
    </div>
  );
}
