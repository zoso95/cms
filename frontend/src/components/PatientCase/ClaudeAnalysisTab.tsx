interface ClaudeAnalysisTabProps {
  analysis: any;
}

// Helper function to render JSON as structured tables
function renderJsonAsTable(data: any, depth: number = 0): JSX.Element {
  if (!data || typeof data !== 'object') {
    return <span>{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    return (
      <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
        {data.map((item, index) => (
          <li key={index} style={{ marginBottom: '0.25rem' }}>
            {typeof item === 'object' ? renderJsonAsTable(item, depth + 1) : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  // Check if this is a flat object (all values are primitives)
  const isFlat = Object.values(data).every(v =>
    v === null || typeof v !== 'object' || Array.isArray(v)
  );

  if (isFlat && depth === 0) {
    // Render as simple key-value table
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key} style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td style={{
                padding: '0.75rem',
                fontWeight: '600',
                width: '40%',
                backgroundColor: '#f9fafb',
                textTransform: 'capitalize'
              }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </td>
              <td style={{ padding: '0.75rem' }}>
                {Array.isArray(value) ? renderJsonAsTable(value, depth + 1) : String(value || 'N/A')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Render nested object as sections
  return (
    <div style={{ marginTop: depth > 0 ? '0.5rem' : '0' }}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} style={{ marginBottom: '1rem' }}>
          <h4 style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: '#374151',
            textTransform: 'capitalize'
          }}>
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </h4>
          <div style={{ paddingLeft: depth > 0 ? '1rem' : '0' }}>
            {renderJsonAsTable(value, depth + 1)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClaudeAnalysisTab({ analysis }: ClaudeAnalysisTabProps) {
  return (
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
                {renderJsonAsTable(analysis.patient_info)}
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
                {renderJsonAsTable(analysis.doctor_info_quality)}
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
                {renderJsonAsTable(analysis.case_factors)}
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
                {renderJsonAsTable(analysis.legal_practical_factors)}
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
                {renderJsonAsTable(analysis.call_quality_assessment)}
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
                {renderJsonAsTable(analysis.next_actions)}
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
                {renderJsonAsTable(analysis.compliance_notes)}
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
                {renderJsonAsTable(analysis.overall_case_assessment)}
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
  );
}
