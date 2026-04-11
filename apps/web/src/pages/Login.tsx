import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../lib/auth-api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<Record<string, boolean>>({ email: true, google: false });

  // Already logged in → redirect
  useEffect(() => {
    if (user) navigate(from, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // from is derived from location.state at render time; re-running on from change would cause redirect loops

  useEffect(() => {
    authApi.getProviders()
      .then(r => setProviders(r.providers))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — fetch once on mount

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      signIn(res.token, res.user);
      navigate(res.user.mustChangePassword ? '/change-password' : from, { replace: true });
    } catch (err: any) {
      if (err.code === 'account_blocked') {
        setError('Your account has been blocked. Contact support.');
      } else if (err.code === 'account_deleted') {
        setError('This account has been deleted.');
      } else {
        setError(err.message || 'Invalid email or password');
      }
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
      navigate(res.user.mustChangePassword ? '/change-password' : from, { replace: true });
    } catch (err: any) {
      if (err.code === 'account_blocked') {
        setError('Your account has been blocked. Contact support.');
      } else {
        setError(err.message || 'Google sign-in failed');
      }
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
          <h1 className="text-2xl font-bold text-gray-900">MyAthan</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to manage your device</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Google sign-in */}
        {providers.google && GOOGLE_CLIENT_ID && (
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <div className="mb-4">
              <GoogleLogin
                onSuccess={handleGoogle}
                onError={() => setError('Google sign-in failed')}
                width="100%"
                text="signin_with"
                shape="rectangular"
                theme="outline"
              />
            </div>
          </GoogleOAuthProvider>
        )}

        {/* Divider — shown only when both providers available */}
        {providers.google && providers.email && GOOGLE_CLIENT_ID && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-400 text-xs">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* Email/password form */}
        {providers.email && (
          <form onSubmit={handleEmailLogin} className="space-y-3">
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {/* Register link */}
        {providers.email && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-700 font-medium">
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
