// src/lib/design-tokens.ts

// Spacing scale (based on a 4pt grid system)
export const spacing = {
    xxs: '4px',    // 1 * 4pt
    xs: '8px',     // 2 * 4pt
    s: '12px',     // 3 * 4pt
    m: '16px',     // 4 * 4pt (base)
    l: '24px',     // 6 * 4pt
    xl: '32px',    // 8 * 4pt
    xxl: '48px',   // 12 * 4pt
    xxxl: '64px',  // 16 * 4pt
  };
  
  // Font scale (relative to a base size, e.g., 16px)
  // These can be mapped to Tailwind's text-xs, text-sm, text-base, etc.,
  // or used directly in components for more granular control.
  export const fontScale = {
    '-2': '0.75rem',   // 12px (text-xs)
    '-1': '0.875rem',  // 14px (text-sm)
    '0': '1rem',       // 16px (text-base)
    '+1': '1.125rem',  // 18px (text-lg)
    '+2': '1.25rem',   // 20px (text-xl)
    '+3': '1.5rem',    // 24px (text-2xl)
    '+4': '1.875rem',  // 30px (text-3xl)
    '+5': '2.25rem',   // 36px (text-4xl)
    '+6': '3rem',      // 48px (text-5xl)
    '+7': '3.75rem',   // 60px (text-6xl)
    '+8': '4.5rem',    // 72px (text-7xl)
  };
  
  // Color roles (semantic names mapping to Tailwind config)
  // These are more for documentation and conceptual grouping here,
  // as Tailwind classes will be used directly (e.g., bg-defai_primary, text-muted-foreground)
  export const colorRoles = {
    primary: 'defai_primary',         // Main brand color
    secondary: 'defai_secondary',     // Secondary brand color
    accent: 'defai_accent',           // Accent color for highlights
    destructive: 'destructive',       // For error states, destructive actions
    
    textPrimary: 'foreground',        // Default text color
    textSecondary: 'muted-foreground',// Muted/secondary text
    textDisabled: 'gray-400',         // Text for disabled states (example)
    textOnPrimary: 'defai_white',      // Text on primary-colored backgrounds
    
    backgroundPrimary: 'background',      // Main page background
    backgroundSecondary: 'defai_grey_light',// Secondary page background
    surface: 'card',                  // Card backgrounds, elevated surfaces
    surfaceElevated: 'popover',         // Popovers, modals
  
    borderDefault: 'border',
    borderSubtle: 'gray-200',        // (example, can be defined in Tailwind)
  };
  
  // You can expand this file with more design tokens as needed,
  // for example, border-radius, shadows, animation timings, etc.
  // For now, Tailwind's `theme.extend` handles many of these.
  