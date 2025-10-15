import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface PatientCaseSelectorProps {
  onSelect: (patientCaseId: number) => void;
  onCancel: () => void;
}

export default function PatientCaseSelector({ onSelect, onCancel }: PatientCaseSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allPatientCasesResponse, isLoading } = useQuery({
    queryKey: ['patient-cases-all'],
    queryFn: () => api.getPatientCases(1, 10000), // Get all for search purposes
  });

  const allPatientCases = allPatientCasesResponse?.data || [];

  // Filter patient cases based on search query
  const filteredCases = allPatientCases?.filter((patientCase: any) => {
    const query = searchQuery.toLowerCase();
    const fullName = `${patientCase.first_name || ''} ${patientCase.last_name || ''}`.toLowerCase();
    const phone = (patientCase.phone || '').toLowerCase();
    const condition = (patientCase.condition || '').toLowerCase();
    const id = patientCase.id.toString();

    return (
      fullName.includes(query) ||
      phone.includes(query) ||
      condition.includes(query) ||
      id.includes(query)
    );
  });

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
          Loading patient cases...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
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
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '900px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Select Patient Case
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            Choose a patient to create a new workflow
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            placeholder="Search by name, phone, condition, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              fontSize: '0.875rem',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#2563eb';
              e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e5e5';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Patient Cases Table */}
        <div style={{
          border: '1px solid #e5e5e5',
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: '1.5rem',
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#374151' }}>
                  ID
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#374151' }}>
                  Name
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#374151' }}>
                  Phone
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#374151' }}>
                  Condition
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#374151' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCases?.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
                    No patient cases found matching "{searchQuery}"
                  </td>
                </tr>
              ) : (
                filteredCases?.map((patientCase: any) => (
                  <tr
                    key={patientCase.id}
                    style={{
                      borderBottom: '1px solid #e5e5e5',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff';
                    }}
                    onClick={() => onSelect(patientCase.id)}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.id}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      {patientCase.first_name} {patientCase.last_name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.phone || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{patientCase.condition || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(patientCase.id);
                        }}
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Cancel Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
        </div>
      </div>
    </div>
  );
}
