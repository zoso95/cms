import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface PatientCaseSelectorProps {
  onSelect: (patientCaseId: number) => void;
  onCancel: () => void;
}

export default function PatientCaseSelector({ onSelect, onCancel }: PatientCaseSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const handleSearch = () => {
    setSubmittedSearch(searchQuery);
    setPage(1); // Reset to first page when search changes
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Use server-side search
  const { data: patientCasesResponse, isLoading } = useQuery({
    queryKey: ['patient-cases-selector', page, submittedSearch],
    queryFn: () => api.getPatientCases(page, limit, submittedSearch || undefined),
  });

  const patientCases = patientCasesResponse?.data || [];
  const pagination = patientCasesResponse?.pagination;

  if (isLoading && !patientCases.length) {
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Search by name, phone, condition, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              style={{
                flex: 1,
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
            <button
              onClick={handleSearch}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
            >
              Search
            </button>
            {submittedSearch && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSubmittedSearch('');
                  setPage(1);
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #e5e5e5',
                  backgroundColor: '#fff',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                Clear
              </button>
            )}
          </div>
          {pagination && (
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
              Showing {patientCases.length} of {pagination.total} patients
            </div>
          )}
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
              {isLoading && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
                    Searching...
                  </td>
                </tr>
              )}
              {!isLoading && patientCases.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
                    {submittedSearch ? `No patient cases found matching "${submittedSearch}"` : 'No patient cases found'}
                  </td>
                </tr>
              )}
              {!isLoading && patientCases.map((patientCase: any) => (
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}>
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
        )}

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
