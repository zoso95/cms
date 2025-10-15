import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e5e5',
        padding: '1rem 2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', textDecoration: 'none', color: '#333' }}>
              Afterimage CMS
            </Link>
            <Link to="/" style={{ textDecoration: 'none', color: '#666', fontSize: '0.95rem' }}>
              Dashboard
            </Link>
          </div>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#fff',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}
