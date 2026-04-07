export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
}) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]'

  const variants = {
    primary:  'bg-brand-600 hover:bg-brand-700 text-white focus:ring-brand-500 shadow-sm',
    secondary:'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 focus:ring-brand-500',
    danger:   'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400',
    ghost:    'text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm gap-1.5',
    md: 'px-5 py-3 text-base gap-2',
    lg: 'px-6 py-4 text-lg gap-2',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${base}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {children}
    </button>
  )
}
