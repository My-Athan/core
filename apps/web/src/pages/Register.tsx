import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../lib/auth-api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register(email, password, displayName || undefined);
      signIn(res.token, res.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.googleAuth(credentialResponse.credential);
      signIn(res.token, res.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Get started with MyAthan</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Google */}
        {GOOGLE_CLIENT_ID && (
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <div className="mb-4">
              <GoogleLogin
                onSuccess={handleGoogle}
                onError={() => setError('Google sign-in failed')}
                width="100%"
                text="signup_with"
                shape="rectangular"
                theme="outline"
              />
            </div>
          </GoogleOAuthProvider>
        )}

        {GOOGLE_CLIENT_ID && (
          <div className="flex items-center gap-3 mb-4" aria-hidden="true">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-400 text-xs">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* Email form */}
        <form onSubmit={handleRegister} className="space-y-3">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Display name (optional)"
            autoComplete="name"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
