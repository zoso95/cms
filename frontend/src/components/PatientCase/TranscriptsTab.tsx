interface TranscriptsTabProps {
  transcripts: any[] | undefined;
}

interface Message {
  role: 'agent' | 'user';
  content: string;
}

function parseTranscript(transcript: string): Message[] {
  const lines = transcript.split('\n');
  const messages: Message[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.startsWith('agent:')) {
      const content = trimmedLine.substring(6).trim();
      if (content && content !== 'null') {
        messages.push({ role: 'agent', content });
      }
    } else if (trimmedLine.startsWith('user:')) {
      const content = trimmedLine.substring(5).trim();
      if (content && content !== 'null') {
        messages.push({ role: 'user', content });
      }
    }
  }

  return messages;
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {transcripts.map((transcript: any) => {
            const messages = parseTranscript(transcript.transcript);

            return (
              <div key={transcript.id} style={{
                padding: '1.5rem',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                backgroundColor: '#fafafa'
              }}>
                <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem', fontWeight: '600' }}>
                  {new Date(transcript.created_at).toLocaleString()}
                </p>

                {/* Chat messages */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  padding: '0.5rem'
                }}>
                  {messages.map((message, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: message.role === 'agent' ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '75%',
                          padding: '0.75rem 1rem',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          backgroundColor: message.role === 'agent' ? '#3b82f6' : '#e5e7eb',
                          color: message.role === 'agent' ? '#ffffff' : '#1f2937',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          marginBottom: '0.25rem',
                          opacity: 0.8,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {message.role === 'agent' ? 'Carebot' : 'Patient'}
                        </div>
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>

                {transcript.analysis && Object.keys(transcript.analysis).length > 0 && (
                  <details style={{ marginTop: '1rem' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
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
            );
          })}
        </div>
      ) : (
        <p style={{ color: '#666' }}>No transcripts available yet.</p>
      )}
    </div>
  );
}
