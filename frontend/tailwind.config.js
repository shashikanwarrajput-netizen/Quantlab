/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0F19',
          card: '#111827',
          surface: '#1F2937',
          950: '#0B0F19',
          900: '#111827',
          800: '#1F2937',
          700: '#374151',
          600: '#4B5563',
        },
        light: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          surface: '#E2E8F0',
        },
        quant: {
          primary: '#2563EB',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          accent: '#A78BFA',
          bgDark: '#0B0F19',
          cardDark: '#111827',
          surfaceDark: '#1F2937',
          bgLight: '#F8FAFC',
          cardLight: '#FFFFFF',
          surfaceLight: '#E2E8F0',
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563EB',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          500: '#10B981',
          600: '#059669',
        },
        warning: {
          500: '#F59E0B',
          600: '#D97706',
        },
        danger: {
          500: '#EF4444',
          600: '#DC2626',
        },
        accent: {
          purple: '#8B5CF6',
          indigo: '#6366F1',
          violet: '#A78BFA',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
        'gradient-success': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-accent': 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
        'gradient-warning': 'linear-gradient(135deg, #F43F5E 0%, #F97316 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0B0F19 0%, #111827 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-primary': '0 4px 20px -2px rgba(59, 130, 246, 0.4)',
        'glow-success': '0 4px 20px -2px rgba(16, 185, 129, 0.4)',
        'glow-accent': '0 4px 20px -2px rgba(139, 92, 246, 0.4)',
      },
    },
  },
  plugins: [],
}
