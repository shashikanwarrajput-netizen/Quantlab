import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { DashboardLayout } from '../components/layout/Sidebar';
import { Card, Button, Input } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { Bell, Lock, Palette, User, LogOut } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    name: user?.name || '',
    email: user?.email || '',
    timeframe: '1h',
    capital: '10000',
    emailNotifications: true,
    backtestNotifications: true,
  });

  const isLightTheme = resolvedTheme === 'light';
  const pageBackground = isLightTheme ? 'bg-[#F8FAFC]' : 'bg-[#0B0F19]';
  const pageText = isLightTheme ? 'text-[#0F172A]' : 'text-white';
  const mutedText = isLightTheme ? 'text-[#64748B]' : 'text-[#94A3B8]';
  const sectionCard = isLightTheme ? 'bg-white border border-[#E2E8F0] shadow-sm' : 'bg-[#111827] border border-[#1F2937]';
  const checkboxCard = isLightTheme ? 'bg-slate-50 border border-[#E2E8F0] hover:bg-slate-100' : 'bg-[#1F2937]/50 border border-[#1F2937] hover:bg-[#1F2937]';
  const checkboxInput = isLightTheme ? 'bg-white border-[#E2E8F0]' : 'bg-[#0B0F19] border-[#1F2937]';
  const fieldLabel = isLightTheme ? 'text-[#0F172A]' : 'text-slate-300';
  const fieldContainer = isLightTheme ? 'bg-white border-[#E2E8F0] text-[#0F172A]' : 'bg-[#0B0F19] border-[#1F2937] text-white';
  const infoBox = isLightTheme ? 'bg-blue-50 border border-blue-200' : 'bg-[#2563EB]/15 border border-[#2563EB]/30';
  const infoText = isLightTheme ? 'text-[#2563EB]' : 'text-[#60A5FA]';

  const handleLogout = (): void => {
    logout();
    navigate('/');
  };

  const handleSaveSettings = (): void => {
    alert('Settings saved!');
  };

  const handleChangePassword = (): void => {
    alert('Password change functionality would connect to backend');
  };

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className={`p-6 md:p-8 max-w-4xl ${pageBackground} ${pageText}`}>
          <div className="mb-8">
            <h1 className={`text-3xl font-bold ${pageText}`}>Settings</h1>
            <p className={mutedText}>Manage your account and preferences</p>
          </div>

          <div className="space-y-6">
            {/* Profile Section */}
            <Card className={sectionCard}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${pageText}`}>Profile</h2>
                  <p className={`text-sm ${mutedText}`}>Your account information</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <Input
                  label="Full Name"
                  labelClassName={fieldLabel}
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className={fieldContainer}
                />
                <Input
                  label="Email"
                  labelClassName={fieldLabel}
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className={fieldContainer}
                />
                <div className="pt-2">
                  <Button variant="secondary" onClick={handleChangePassword}>
                    <Lock size={18} className="mr-2" />
                    Change Password
                  </Button>
                </div>
              </div>
            </Card>

            {/* Preferences Section */}
            <Card className={sectionCard}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-cyan-600 rounded-full flex items-center justify-center">
                  <Palette size={20} className="text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${pageText}`}>Preferences</h2>
                  <p className={`text-sm ${mutedText}`}>Customize your experience</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${fieldLabel}`}>Theme</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as ThemeMode)}
                    className={`input-base ${fieldContainer}`}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${fieldLabel}`}>Default Timeframe</label>
                  <select
                    value={settings.timeframe}
                    onChange={(e) => setSettings({ ...settings, timeframe: e.target.value })}
                    className={`input-base ${fieldContainer}`}
                  >
                    <option value="1m">1 Minute</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="4h">4 Hours</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <Input
                  label="Default Starting Capital ($)"
                  labelClassName={fieldLabel}
                  type="number"
                  value={settings.capital}
                  onChange={(e) => setSettings({ ...settings, capital: e.target.value })}
                  className={fieldContainer}
                />
              </div>
            </Card>

            {/* Notifications Section */}
            <Card className={sectionCard}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  <Bell size={20} className="text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${pageText}`}>Notifications</h2>
                  <p className={`text-sm ${mutedText}`}>Control how you receive updates</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Email Notifications', key: 'emailNotifications', desc: 'Receive important updates via email' },
                  { label: 'Backtest Notifications', key: 'backtestNotifications', desc: 'Notify when backtests complete' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${checkboxCard}`}
                  >
                    <input
                      type="checkbox"
                      checked={(settings as any)[item.key]}
                      onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                      className={`w-4 h-4 rounded cursor-pointer ${checkboxInput}`}
                    />
                    <div className="ml-3">
                      <p className={`font-medium text-sm ${pageText}`}>{item.label}</p>
                      <p className={`text-xs ${mutedText}`}>{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Card>

            {/* Security Section */}
            <Card className={sectionCard}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <Lock size={20} className="text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${pageText}`}>Security</h2>
                  <p className={`text-sm ${mutedText}`}>Manage your account security</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className={`p-3 rounded-lg ${checkboxCard}`}>
                  <p className={`text-sm ${pageText}`}>
                    Your account is protected with localStorage-based mock authentication for this frontend.
                  </p>
                </div>
                <Button variant="secondary" fullWidth onClick={handleChangePassword}>
                  <Lock size={18} className="mr-2" />
                  Change Password
                </Button>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button onClick={handleSaveSettings} className="gap-2">
                Save Changes
              </Button>
              <Button
                variant="danger"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut size={18} />
                Logout
              </Button>
            </div>

            {/* Info Box */}
            <Card className={`${infoBox}`}>
              <p className={`text-sm ${infoText}`}>
                ℹ️ This is a frontend-only prototype. Account settings are stored in localStorage and will be lost after clearing browser data.
              </p>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
};
