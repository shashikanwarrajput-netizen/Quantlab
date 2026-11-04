import React, { useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

import { useTheme } from '../../context/ThemeContext';

import { Button } from '../common/Button';

import { Menu, X, LogOut, Settings } from 'lucide-react';
import { Sun, Moon } from 'lucide-react';



export const Navbar: React.FC = () => {

  const { isAuthenticated, logout, user } = useAuth();

  const { resolvedTheme, setTheme } = useTheme();

  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDark = resolvedTheme === 'dark';

  const navClasses = isDark

    ? 'bg-[#0B0F19]/85 border-[#1F2937] shadow-[0_10px_30px_rgba(0,0,0,0.4)]'

    : 'bg-[#F8FAFC]/85 border-[#E2E8F0] shadow-[0_10px_30px_rgba(16,24,40,0.06)]';

  const textClasses = isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]';

  const titleClasses = isDark ? 'text-white' : 'text-[#0F172A]';

  const mobilePanelClasses = isDark ? 'border-[#1F2937] bg-[#0B0F19]/90' : 'border-[#E2E8F0] bg-white/80';



  const handleLogout = () => {

    logout();

    navigate('/');

  };



  return (

    <nav className={`sticky top-0 z-40 backdrop-blur-xl border-b ${navClasses}`}>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between h-16">

          {/* Logo */}

          <Link to="/" className="flex items-center gap-2 group">

            <img 

              src="/logo.svg" 

              alt="QuantLab" 

              className="h-12 w-12 hover:shadow-lg hover:shadow-[#3B82F6]/30 transition-all"

            />

            <span className={`text-xl font-bold hidden sm:inline ${titleClasses}`}>QuantLab</span>

          </Link>



          {/* Desktop Navigation */}

          <div className="hidden md:flex items-center gap-8">

            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-xl transition-all ${isDark ? 'text-slate-400 hover:text-white hover:bg-[#1F2937]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`}
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
            >
              {resolvedTheme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-600" />}
            </button>
            {!isAuthenticated ? (

              <>

                <a href="/#features" className={`text-[15px] font-medium transition-colors ${textClasses}`}>Features</a>

                <a href="/#how-it-works" className={`text-[15px] font-medium transition-colors ${textClasses}`}>How It Works</a>

                <a href="/#ai-assistant" className={`text-[15px] font-medium transition-colors ${textClasses}`}>AI Assistant</a>

                <a href="/#about" className={`text-[15px] font-medium transition-colors ${textClasses}`}>About</a>

              </>

            ) : (

              <>

                <Link to="/dashboard" className="text-[15px] font-medium text-[#344054] hover:text-[#3B82F6] transition-colors">Dashboard</Link>

                <Link to="/strategy-builder" className="text-[15px] font-medium text-[#344054] hover:text-[#3B82F6] transition-colors">Build</Link>

                <Link to="/backtesting" className="text-[15px] font-medium text-[#344054] hover:text-[#3B82F6] transition-colors">Backtest</Link>

                <Link to="/portfolio" className="text-[15px] font-medium text-[#344054] hover:text-[#3B82F6] transition-colors">Analytics</Link>

                <Link to="/ai-assistant" className="text-[15px] font-medium text-[#344054] hover:text-[#3B82F6] transition-colors">AI</Link>

              </>

            )}

          </div>



          {/* Right Side */}

          <div className="hidden md:flex items-center gap-4">

            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-xl transition-all ${isDark ? 'text-slate-400 hover:text-white hover:bg-[#1F2937]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`}
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
            >
              {resolvedTheme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-600" />}
            </button>
            {!isAuthenticated ? (

              <>

                <Link to="/login" className={`text-[15px] font-medium transition-colors ${titleClasses}`}>

                  Login

                </Link>

                <Link to="/signup">

                  <Button size="sm">Get Started</Button>

                </Link>

              </>

            ) : (

              <>

                <Link to="/settings" className={isDark ? 'text-white hover:text-[#60A5FA] transition-colors' : 'text-[#0F172A] hover:text-[#3B82F6] transition-colors'}>

                  <Settings size={20} />

                </Link>

                <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-[#344054]'}`}>

                  {user?.name}

                </div>

                <Button

                  variant="ghost"

                  size="sm"

                  onClick={handleLogout}

                  className="gap-2"

                >

                  <LogOut size={16} />

                  Logout

                </Button>

              </>

            )}

          </div>



          {/* Mobile Menu Button */}

          <button

            className={isDark ? 'md:hidden text-white hover:text-[#60A5FA]' : 'md:hidden text-[#0F172A] hover:text-[#3B82F6]'}

            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}

          >

            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}

          </button>

        </div>



        {/* Mobile Menu */}

        {mobileMenuOpen && (

          <div className={`md:hidden pb-4 space-y-2 border-t backdrop-blur-xl rounded-b-2xl ${mobilePanelClasses}`}>

            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-xl transition-all ${isDark ? 'text-slate-400 hover:text-white hover:bg-[#1F2937]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`}
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
            >
              {resolvedTheme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-600" />}
            </button>
            {!isAuthenticated ? (

              <>

                <a href="/#features" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Features</a>

                <a href="/#how-it-works" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>How It Works</a>

                <a href="/#ai-assistant" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>AI Assistant</a>

                <a href="/#about" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>About</a>

                <div className="pt-2 space-y-2">

                  <Link to="/login" className={`block text-[15px] font-medium ${isDark ? 'text-white hover:text-[#60A5FA]' : 'text-[#0F172A] hover:text-[#3B82F6]'}`}>

                    Login

                  </Link>

                  <Link to="/signup" className="block">

                    <Button fullWidth size="sm">Get Started</Button>

                  </Link>

                </div>

              </>

            ) : (

              <>

                <Link to="/dashboard" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Dashboard</Link>

                <Link to="/strategy-builder" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Strategy Builder</Link>

                <Link to="/backtesting" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Backtesting</Link>

                <Link to="/portfolio" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Portfolio</Link>

                <Link to="/compare" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Compare</Link>

                <Link to="/ai-assistant" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>AI Assistant</Link>

                <Link to="/market-data" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Market Data</Link>

                <Link to="/settings" className={`block px-4 py-2 text-[15px] font-medium rounded ${isDark ? 'text-slate-200 hover:text-white' : 'text-[#344054] hover:text-[#3B82F6]'}`}>Settings</Link>

                <button

                  onClick={handleLogout}

                  className="w-full mt-2 px-4 py-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded text-left"

                >

                  Logout

                </button>

              </>

            )}

          </div>

        )}

      </div>

    </nav>

  );

};

