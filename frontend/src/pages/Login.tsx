import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const redirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1.5rem',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
          }}>
            ✉️
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          }}>
            Check your email
          </h1>
          <p style={{
            color: '#666',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}>
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p style={{
            color: '#666',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}>
            Click the link in the email to sign in. The link will expire in 1 hour.
          </p>
          <button
            onClick={() => {
              setMagicLinkSent(false);
              setEmail('');
            }}
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
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          Afterimage CMS
        </h1>

        {!usePassword ? (
          // Magic Link Form
          <form onSubmit={handleMagicLink}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="email" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: '#374151',
              }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: '#991b1b',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: loading ? '#9ca3af' : '#2563eb',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '1rem',
              }}
            >
              {loading ? 'Sending link...' : 'Send magic link'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setUsePassword(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Sign in with password instead
              </button>
            </div>
          </form>
        ) : (
          // Password Form
          <form onSubmit={handlePasswordSignIn}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: '#374151',
              }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: '#374151',
              }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: '#991b1b',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: loading ? '#9ca3af' : '#2563eb',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '1rem',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setUsePassword(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Use magic link instead
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
