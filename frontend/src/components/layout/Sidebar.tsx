import React, { useState } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';

import { LayoutDashboard, Zap, TrendingUp, PieChart, GitCompare, Bot, Database, Settings, LogOut, Menu, X } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

import { useTheme } from '../../context/ThemeContext';

import { Button } from '../common/Button';



interface SidebarItemProps {

  icon: React.ReactNode;

  label: string;

  href: string;

  isActive: boolean;

  isDark: boolean;

}



const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, href, isActive, isDark }) => {

  return (

    <Link

      to={href}

      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${

        isActive

          ? isDark

            ? 'bg-[#2563EB] text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] font-semibold'

            : 'bg-[#2563EB]/10 text-[#2563EB] font-semibold'

          : isDark

            ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white'

            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'

      }`}

    >

      <span className={isActive ? (isDark ? 'text-white' : 'text-[#0F172A]') : isDark ? 'text-[#9AA6B5]' : 'text-[#475467]'}>{icon}</span>

      <span className="text-sm font-medium">{label}</span>

    </Link>

  );

};



export const Sidebar: React.FC = () => {

  const location = useLocation();

  const navigate = useNavigate();

  const { logout, user } = useAuth();

  const { resolvedTheme } = useTheme();

  const [isOpen, setIsOpen] = useState(true);

  const isDark = resolvedTheme === 'dark';

  const handleLogout = () => {
    logout();
    navigate('/');
  };



  const menuItems = [

    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', href: '/dashboard' },

    { icon: <Zap size={20} />, label: 'Strategy Builder', href: '/strategy-builder' },

    { icon: <TrendingUp size={20} />, label: 'Backtesting', href: '/backtesting' },

    { icon: <PieChart size={20} />, label: 'Portfolio', href: '/portfolio' },

    { icon: <GitCompare size={20} />, label: 'Compare', href: '/compare' },

    { icon: <Bot size={20} />, label: 'AI Assistant', href: '/ai-assistant' },

    { icon: <Database size={20} />, label: 'Market Data', href: '/market-data' },

  ];



  return (

    <>

      {/* Mobile toggle */}

      <button

        onClick={() => setIsOpen(!isOpen)}

        className="md:hidden fixed bottom-6 right-6 z-40 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] p-3 text-white shadow-lg transition hover:from-[#2563EB] hover:to-[#1E40AF]"

      >

        {isOpen ? <X size={24} /> : <Menu size={24} />}

      </button>



      {/* Sidebar */}

      <aside

        className={`fixed md:static left-0 top-0 h-screen w-64 overflow-y-auto border-r transition-transform duration-300 z-30 md:h-[calc(100vh-64px)] ${

          isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'

        } ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}

      >

        {/* Header (mobile only) */}

        <div className="flex items-center justify-between border-b border-white/10 p-6 md:hidden">

          <div>

            <h3 className="font-semibold text-white">{user?.name}</h3>

            <p className="text-xs text-[#9AA6B5]">{user?.email}</p>

          </div>

          <button onClick={() => setIsOpen(false)} className="text-[#9AA6B5] hover:text-white">

            <X size={20} />

          </button>

        </div>



        <div className="space-y-1 p-4">

          <div className="mb-6 hidden md:block">

            <h2 className="mb-4 px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9AA6B5]">Menu</h2>

          </div>



          {menuItems.map((item) => (

            <SidebarItem

              key={item.href}

              {...item}

              isActive={location.pathname === item.href}

              isDark={isDark}

            />

          ))}

        </div>



        {/* Bottom section */}

        <div className={`absolute bottom-0 left-0 right-0 border-t p-4 space-y-2 ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>

          <Link to="/settings" className="w-full">

            <Button

              variant="secondary"

              size="sm"

              fullWidth

              className="justify-center gap-2"

            >

              <Settings size={16} />

              Settings

            </Button>

          </Link>

          <Button

            variant="danger"

            size="sm"

            fullWidth

            onClick={handleLogout}

            className="justify-center gap-2"

          >

            <LogOut size={16} />

            Logout

          </Button>

        </div>

      </aside>



      {/* Mobile overlay */}

      {isOpen && (

        <div

          className="md:hidden fixed inset-0 bg-black/50 z-20"

          onClick={() => setIsOpen(false)}

        />

      )}

    </>

  );

};



export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`flex h-[calc(100vh-64px)] ${isDark ? 'bg-[#0B0F19]' : 'bg-[#F8FAFC]'}`}>
      <Sidebar />
      <main className={`flex-1 overflow-y-auto ${isDark ? 'bg-[#0B0F19]' : 'bg-[#F8FAFC]'}`}>
        {children}
      </main>
    </div>
  );
};

