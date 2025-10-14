import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface WorkflowSelectorProps {
  patientCaseId: number;
  onStart: (workflowName: string, parameters: any) => void;
  onCancel: () => void;
}

export default function WorkflowSelector({ patientCaseId: _patientCaseId, onStart, onCancel }: WorkflowSelectorProps) {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflow-catalog'],
    queryFn: api.getWorkflowCatalog,
  });

  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [showSource, setShowSource] = useState(false);

  const { data: sourceData } = useQuery({
    queryKey: ['workflow-source', selectedWorkflow?.name],
    queryFn: () => api.getWorkflowSource(selectedWorkflow!.name),
    enabled: showSource && !!selectedWorkflow,
  });

  useEffect(() => {
    if (selectedWorkflow) {
      // Initialize parameters with defaults
      setParameters(selectedWorkflow.defaultParams || {});
    }
  }, [selectedWorkflow]);

  const handleParameterChange = (path: string, value: any) => {
    setParameters(prev => {
      const newParams = { ...prev };
      const keys = path.split('.');
      let current: any = newParams;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newParams;
    });
  };

  const renderParameterField = (key: string, value: any, path: string = '') => {
    const fullPath = path ? `${path}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div key={fullPath} style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
          <p style={{ fontWeight: '500', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{key}</p>
          {Object.entries(value).map(([k, v]) => renderParameterField(k, v, fullPath))}
        </div>
      );
    }

    return (
      <div key={fullPath} style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', textTransform: 'capitalize' }}>
          {key.replace(/([A-Z])/g, ' $1').trim()}
        </label>
        {typeof value === 'boolean' ? (
          <input
            type="checkbox"
            checked={parameters[key] ?? value}
            onChange={(e) => handleParameterChange(fullPath, e.target.checked)}
            style={{ width: '1rem', height: '1rem' }}
          />
        ) : typeof value === 'number' ? (
          <input
            type="number"
            value={parameters[key] ?? value}
            onChange={(e) => handleParameterChange(fullPath, Number(e.target.value))}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
            }}
          />
        ) : (
          <input
            type="text"
            value={parameters[key] ?? value}
            onChange={(e) => handleParameterChange(fullPath, e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
            }}
          />
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '600px',
          width: '90%',
        }}>
          Loading workflows...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      overflowY: 'auto',
      padding: '2rem 0',
    }} onClick={onCancel}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
          Select Workflow
        </h2>

        {!selectedWorkflow ? (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => setSelectedWorkflow(workflows?.find((w: any) => w.category === 'production'))}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Production
              </button>
              <button
                onClick={() => setSelectedWorkflow(workflows?.find((w: any) => w.category === 'test'))}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Test
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {workflows?.map((workflow: any) => (
                <div
                  key={workflow.name}
                  onClick={() => setSelectedWorkflow(workflow)}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e5e5';
                    e.currentTarget.style.backgroundColor = '#fff';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h3 style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{workflow.displayName}</h3>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>{workflow.description}</p>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: workflow.category === 'production' ? '#dbeafe' : '#f3f4f6',
                      color: workflow.category === 'production' ? '#1e40af' : '#374151',
                    }}>
                      {workflow.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{selectedWorkflow.displayName}</h3>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>{selectedWorkflow.description}</p>
              </div>
              <button
                onClick={() => setShowSource(!showSource)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {showSource ? 'Hide' : 'View'} Code
              </button>
            </div>

            {showSource && sourceData && (
              <pre style={{
                padding: '1rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '0.75rem',
                marginBottom: '1.5rem',
                maxHeight: '300px',
              }}>
                {sourceData.source}
              </pre>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontWeight: '500', marginBottom: '1rem' }}>Parameters</h4>
              {Object.entries(selectedWorkflow.defaultParams).map(([key, value]) =>
                renderParameterField(key, value)
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedWorkflow(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Back
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => onStart(selectedWorkflow.name, parameters)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Start Workflow
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
