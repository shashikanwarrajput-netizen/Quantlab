import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Button, Input, Card } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!formData.email || !formData.password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch {
      setLocalError(error || 'Login failed');
    }
  };

  const handleDemoLogin = async () => {
    try {
      await login('demo@example.com', 'Demo@123456');
      navigate('/dashboard');
    } catch {
      setLocalError('Demo login failed');
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950' : 'bg-gradient-to-b from-slate-100 via-white to-slate-200'}`}>
      <Navbar />

      <div className="max-w-md mx-auto px-4 py-20">
        <Card className="p-8">
          <div className="mb-8 text-center">
            <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Welcome Back</h1>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>Login to your QuantLab account</p>
          </div>

          {(localError || error) && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-dark-700 border border-dark-600 cursor-pointer"
                />
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Remember me</span>
              </label>
              <a href="#forgot" className="text-sm text-purple-400 hover:text-purple-300">
                Forgot password?
              </a>
            </div>

            <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${isDark ? 'border-dark-700' : 'border-slate-300'}`} />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${isDark ? 'bg-dark-800 text-gray-500' : 'bg-white text-slate-500'}`}>Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            size="lg"
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            Try Demo Account
          </Button>

          <div className="mt-6 text-center">
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>
              Don't have an account?{' '}
              <Link to="/signup" className={isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}>
                Create one
                <ArrowRight size={16} />
              </Link>
            </p>
          </div>
        </Card>

        <div className={`mt-8 rounded-lg p-6 ${isDark ? 'bg-dark-800/50 border border-dark-700' : 'bg-white border border-slate-200 shadow-sm'}`}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Demo Account:</span><br />
            Email: demo@example.com<br />
            Password: Demo@123456
          </p>
        </div>
      </div>
    </div>
  );
};
