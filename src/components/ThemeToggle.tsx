import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  /** "icon" = compact icon-only button (navbars/toolbars). "switch" = labeled pill switch (settings-style contexts). */
  variant?: 'icon' | 'switch';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'switch') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode'}
        className={`inline-flex items-center gap-2.5 cursor-pointer ${className}`}
      >
        <span className="text-xs font-semibold text-body">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
        <span
          className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ${
            isDark ? 'bg-accent' : 'bg-line-strong'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200 flex items-center justify-center ${
              isDark ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          >
            {isDark ? (
              <Moon className="w-3 h-3 text-accent" />
            ) : (
              <Sun className="w-3 h-3 text-muted" />
            )}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode'}
      title={isDark ? 'Light Mode' : 'Dark Mode'}
      className={`p-2.5 text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg transition-colors cursor-pointer ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
