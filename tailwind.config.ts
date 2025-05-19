import type { Config } from "tailwindcss";
// @ts-ignore
import safeArea from "tailwindcss-safe-area";

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "sm": "375px",
        "md": "430px",
        "lg": "768px",
        "xl": "1024px",
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        'safe': {'raw': '(padding-top: env(safe-area-inset-top))'},
        '3xl': '1920px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        orbitron: ['var(--font-orbitron)', 'sans-serif'],
        spacegrotesk: ['var(--font-space-grotesk)','sans-serif']
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#FFFFFF",
        foreground: "hsl(var(--foreground))",
        primary: '#2563EB',
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: '#000000',
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        text: '#000000',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        defai_primary: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
        },
        defai_secondary: {
          DEFAULT: '#4F46E5',
          light: '#6366F1',
          dark: '#4338CA',
        },
        defai_accent: {
          DEFAULT: '#EC4899',
          light: '#F472B6',
          dark: '#DB2777',
        },
        defai_success: '#10B981',
        defai_warning: '#F59E0B',
        defai_error: '#EF4444',
        defai_black: '#000000',
        defai_white: '#FFFFFF',
        defai_grey_light: '#F3F4F6',
        defai_grey_medium: '#9CA3AF',
        defai_grey_dark: '#374151',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
      },
      boxShadow: {
        'glow': '0 0 15px rgba(37, 99, 235, 0.5)',
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 3s ease-in-out infinite',
        fadeIn: 'fadeIn 0.5s ease-out',
        fadeUp: 'fadeUp 0.5s ease-out forwards',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        }
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    safeArea,
    require('@tailwindcss/typography'),
  ],
} satisfies Config;

export default config;
