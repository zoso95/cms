interface TranscriptsTabProps {
  transcripts: any[] | undefined;
}

export default function TranscriptsTab({ transcripts }: TranscriptsTabProps) {
  return (
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
  );
}
