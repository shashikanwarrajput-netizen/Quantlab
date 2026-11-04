import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Button, Input, PasswordInput, Card } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ArrowRight, CheckCircle, X } from 'lucide-react';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup, isLoading, error } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState('');
  const [emailError, setEmailError] = useState('');

  const passwordRequirements = useMemo(() => ({
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password),
  }), [formData.password]);

  const passwordStrength = Object.values(passwordRequirements).filter(Boolean).length;
  const isPasswordValid = passwordStrength === 5;
  const passwordsMatch = formData.password === formData.confirmPassword && formData.password.length > 0;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const email = e.target.value;
    
    // Check for uppercase
    if (/[A-Z]/.test(email)) {
      setEmailError('Email must contain only lowercase characters');
    } else {
      setEmailError('');
    }
    
    setFormData({ ...formData, email });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setEmailError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (/[A-Z]/.test(formData.email)) {
      setEmailError('Email must contain only lowercase characters');
      return;
    }

    if (!isPasswordValid) {
      setLocalError('Password does not meet all requirements');
      return;
    }

    if (!passwordsMatch) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await signup(formData.name, formData.email, formData.password);
      navigate('/login');
    } catch {
      setLocalError(error || 'Signup failed');
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950' : 'bg-gradient-to-b from-slate-100 via-white to-slate-200'}`}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
        <Card className="p-8">
          <div className="mb-8 text-center">
            <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Create Account</h1>
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>Start your QuantLab journey today</p>
          </div>

          {(localError || error) && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleEmailChange}
              error={emailError}
              required
            />

            <PasswordInput
              label="Password"
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              showStrength={true}
              required
            />

            {/* Password Requirements */}
            {formData.password && (
              <div className={`rounded-lg p-4 space-y-2 ${isDark ? 'bg-dark-800/50' : 'bg-slate-100'}`}>
                <p className={`text-xs font-semibold uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Password Requirements</p>
                <div className="space-y-1">
                  {[
                    { met: passwordRequirements.length, label: 'At least 8 characters' },
                    { met: passwordRequirements.uppercase, label: 'At least one uppercase letter' },
                    { met: passwordRequirements.lowercase, label: 'At least one lowercase letter' },
                    { met: passwordRequirements.number, label: 'At least one number' },
                    { met: passwordRequirements.special, label: 'At least one special character' },
                  ].map((req, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {req.met ? (
                        <CheckCircle size={16} className="text-green-400" />
                      ) : (
                        <X size={16} className="text-gray-500" />
                      )}
                      <span className={`text-xs ${req.met ? 'text-green-400' : isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              error={formData.confirmPassword && !passwordsMatch ? 'Passwords do not match' : ''}
              required
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              disabled={Boolean(!isPasswordValid || (formData.confirmPassword && !passwordsMatch))}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>
              Already have an account?{' '}
              <Link to="/login" className={isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}>
                Login
                <ArrowRight size={16} />
              </Link>
            </p>
          </div>

          <div className={`mt-6 p-4 border rounded-lg ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
            <p className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
              By signing up, you agree to our Terms of Service and Privacy Policy. QuantLab is a simulation platform for educational purposes.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
