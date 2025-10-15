import { useState, useEffect } from 'react';

interface DetailsSectionProps {
  patientCase: any;
  onUpdateDetails: (details: string) => void;
  isUpdating: boolean;
}

export default function DetailsSection({ patientCase, onUpdateDetails, isUpdating }: DetailsSectionProps) {
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsText, setDetailsText] = useState('');

  // Set initial details text when patient case loads
  useEffect(() => {
    if (patientCase?.details) {
      setDetailsText(patientCase.details);
    }
  }, [patientCase]);

  const handleSave = () => {
    onUpdateDetails(detailsText);
    setIsEditingDetails(false);
  };

  const handleCancel = () => {
    setDetailsText(patientCase?.details || '');
    setIsEditingDetails(false);
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Details</h2>
        {!isEditingDetails ? (
          <button
            onClick={() => setIsEditingDetails(true)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #e5e5e5',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151'
            }}
          >
            Edit
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCancel}
              disabled={isUpdating}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #e5e5e5',
                backgroundColor: '#fff',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isUpdating}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
      {isEditingDetails ? (
        <textarea
          value={detailsText}
          onChange={(e) => setDetailsText(e.target.value)}
          placeholder="Add notes or details about this patient case..."
          style={{
            width: '100%',
            minHeight: '150px',
            padding: '0.75rem',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none'
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
      ) : (
        <div style={{
          fontSize: '0.875rem',
          lineHeight: '1.6',
          color: patientCase?.details ? '#374151' : '#9ca3af',
          whiteSpace: 'pre-wrap'
        }}>
          {patientCase?.details || 'No details added yet. Click "Edit" to add notes.'}
        </div>
      )}
    </div>
  );
}
