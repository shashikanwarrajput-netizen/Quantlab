import React from 'react';



interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {

  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';

  size?: 'sm' | 'md' | 'lg';

  isLoading?: boolean;

  fullWidth?: boolean;

}



export const Button: React.FC<ButtonProps> = ({

  variant = 'primary',

  size = 'md',

  isLoading = false,

  fullWidth = false,

  className = '',

  children,

  disabled,

  ...props

}) => {

  const baseClass = 'font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2';



  const variantClass = {
    primary: 'bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1E40AF] text-white border border-white/10 shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.45)]',
    secondary: 'border border-[var(--quantlab-border)] bg-[var(--quantlab-card)] text-[var(--quantlab-text)] hover:bg-[var(--quantlab-surface)] shadow-sm',
    ghost: 'text-[var(--quantlab-text-muted)] hover:text-[var(--quantlab-text)] hover:bg-white/5',
    danger: 'bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30',
  };



  const sizeClass = {

    sm: 'px-3 py-1.5 text-sm',

    md: 'px-4 py-2 text-base',

    lg: 'px-6 py-3 text-lg',

  };



  const widthClass = fullWidth ? 'w-full' : '';

  const disabledClass = disabled || isLoading ? 'opacity-50 cursor-not-allowed' : '';



  return (

    <button

      className={`${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${widthClass} ${disabledClass} ${className}`}

      disabled={disabled || isLoading}

      {...props}

    >

      {isLoading && <span className="animate-spin">⏳</span>}

      {children}

    </button>

  );

};



interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {

  label?: string;

  error?: string;

  helpText?: string;

  labelClassName?: string;

}



export const Input: React.FC<InputProps> = ({

  label,

  error,

  helpText,

  className = '',

  labelClassName = 'text-[var(--quantlab-text)]',

  ...props

}) => {

  return (

    <div className="w-full">

      {label && (

        <label className={`mb-2 block text-sm font-medium ${labelClassName}`}>

          {label}

        </label>

      )}

      <input

        className={`input-base ${error ? 'border-[#EF4444] focus:border-[#EF4444] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.20)]' : ''} ${className}`}

        {...props}

      />

      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}

      {helpText && <p className="mt-1 text-xs text-[var(--quantlab-text-muted)]">{helpText}</p>}

    </div>

  );

};



interface PasswordInputProps extends Omit<InputProps, 'type'> {

  showStrength?: boolean;

}



export const PasswordInput: React.FC<PasswordInputProps> = ({

  label,

  value,

  showStrength = false,

  ...props

}) => {

  const [showPassword, setShowPassword] = React.useState(false);

  

  const getStrength = (pwd: string) => {

    if (!pwd) return 0;

    let strength = 0;

    if (pwd.length >= 8) strength++;

    if (/[A-Z]/.test(pwd)) strength++;

    if (/[a-z]/.test(pwd)) strength++;

    if (/[0-9]/.test(pwd)) strength++;

    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    return strength;

  };



  const strength = getStrength(value as string || '');

  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];

  const strengthColors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500'];



  return (

    <div className="w-full">

      {label && (

        <label className="block text-sm font-medium mb-2 text-gray-300">

          {label}

        </label>

      )}

      <div className="relative">

        <input

          type={showPassword ? 'text' : 'password'}

          value={value}

          className="input-base pr-10"

          {...props}

        />

        <button

          type="button"

          onClick={() => setShowPassword(!showPassword)}

          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"

        >

          {showPassword ? '👁️' : '👁️‍🗨️'}

        </button>

      </div>

      

      {showStrength && value && (

        <div className="mt-2">

          <div className="flex gap-1 mb-1">

            {[0, 1, 2, 3, 4].map(i => (

              <div

                key={i}

                className={`h-1 flex-1 rounded-full ${

                  i < strength ? strengthColors[strength - 1] : 'bg-dark-700'

                }`}

              />

            ))}

          </div>

          <p className="text-xs text-gray-400">{strengthLabels[strength - 1] || 'Weak'}</p>

        </div>

      )}

    </div>

  );

};



interface CardProps extends React.HTMLAttributes<HTMLDivElement> {

  children: React.ReactNode;

  className?: string;

}



export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {

  return (

    <div className={`card p-6 ${className}`} {...props}>

      {children}

    </div>

  );

};



interface MetricCardProps {

  label: string;

  value: string | number;

  change?: number;

  icon?: React.ReactNode;

  className?: string;

}



export const MetricCard: React.FC<MetricCardProps> = ({

  label,

  value,

  change,

  icon,

  className = '',

}) => {

  return (

    <Card className={`card-hover ${className}`}>

      <div className="flex items-start justify-between gap-3">

        <div className="flex-1">

          <p className="mb-1 text-sm text-[var(--quantlab-text-muted)]">{label}</p>

          <p className="text-2xl font-bold text-[var(--quantlab-text)]">{value}</p>

          {change !== undefined && (

            <p className={`mt-1 text-xs font-medium ${change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>

              {change >= 0 ? '+' : ''}{change}%

            </p>

          )}

        </div>

        {icon && <div className="text-2xl text-[#3B82F6] opacity-80">{icon}</div>}

      </div>

    </Card>

  );

};



interface BadgeProps {

  variant?: 'success' | 'danger' | 'warning' | 'info' | 'primary';

  children: React.ReactNode;

  className?: string;

}



export const Badge: React.FC<BadgeProps> = ({

  variant = 'primary',

  children,

  className = '',

}) => {

  const variantClass = {

    success: 'badge-success',

    danger: 'badge-danger',

    warning: 'badge-warning',

    info: 'badge-info',

    primary: 'badge-primary',

  };



  return (

    <span className={`${variantClass[variant]} ${className}`}>

      {children}

    </span>

  );

};



export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {

  const sizeClass = {

    sm: 'w-4 h-4',

    md: 'w-8 h-8',

    lg: 'w-12 h-12',

  };



  return (

    <div className={`${sizeClass[size]} animate-spin rounded-full border-2 border-[#3B82F6]/25 border-t-[#3B82F6]`} />

  );

};



export const Toast: React.FC<{

  message: string;

  type?: 'success' | 'error' | 'info' | 'warning';

  onClose?: () => void;

}> = ({ message, type = 'info', onClose }) => {

  const bgClass = {

    success: 'border border-[#10B981]/30 bg-[#10B981]/15 text-[#10B981]',

    error: 'border border-[#EF4444]/30 bg-[#EF4444]/15 text-[#EF4444]',

    info: 'border border-[#2563EB]/30 bg-[#2563EB]/15 text-[#3B82F6]',

    warning: 'border border-[#F59E0B]/30 bg-[#F59E0B]/15 text-[#F59E0B]',

  };



  return (

    <div className={`${bgClass[type]} border rounded-lg px-4 py-3 flex items-center justify-between`}>

      <p className="text-sm">{message}</p>

      {onClose && (

        <button

          onClick={onClose}

          className="ml-4 text-current hover:opacity-70 transition-opacity"

        >

          ✕

        </button>

      )}

    </div>

  );

};



interface EmptyStateProps {

  title: string;

  description?: string;

  icon?: React.ReactNode;

  action?: React.ReactNode;

}



export const EmptyState: React.FC<EmptyStateProps> = ({

  title,

  description,

  icon,

  action,

}) => {

  return (

    <div className="flex flex-col items-center justify-center py-12 text-center">

      {icon && <div className="text-5xl mb-4 opacity-50">{icon}</div>}

      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>

      {description && <p className="text-gray-400 mb-6 max-w-md">{description}</p>}

      {action}

    </div>

  );

};



interface ModalProps {

  isOpen: boolean;

  onClose: () => void;

  title?: string;

  children: React.ReactNode;

  size?: 'sm' | 'md' | 'lg';

}



export const Modal: React.FC<ModalProps> = ({

  isOpen,

  onClose,

  title,

  children,

  size = 'md',

}) => {

  if (!isOpen) return null;



  const sizeClass = {

    sm: 'max-w-sm',

    md: 'max-w-md',

    lg: 'max-w-lg',

  };



  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center">

      <div

        className="absolute inset-0 bg-black/50 backdrop-blur-sm"

        onClick={onClose}

      />

      <div className={`relative ${sizeClass[size]} w-full mx-4 card p-6 slide-in-up`}>

        <div className="flex items-center justify-between mb-4">

          {title && <h2 className="text-xl font-bold text-white">{title}</h2>}

          <button

            onClick={onClose}

            className="text-gray-400 hover:text-white transition-colors"

          >

            ✕

          </button>

        </div>

        {children}

      </div>

    </div>

  );

};



