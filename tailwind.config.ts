import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: ["max-w-screen-xl"],
  theme: {
    extend: {
      colors: {
        // 主题色：青色/蓝绿色
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // 主要按钮色
          600: '#0d9488', // 深色主题
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // 辅助色：翠绿色
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      fontSize: {
        // 统一字体尺寸
        'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px - 小字提示
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px - 正文、按钮
        'base': ['1rem', { lineHeight: '1.5rem' }],     // 16px - 普通文本
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px - 小标题
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px - 标题
        '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px - 大标题
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px - 页面标题
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-primary": "linear-gradient(135deg, var(--tw-gradient-stops))",
      },
      boxShadow: {
        'primary': '0 4px 14px 0 rgba(20, 184, 166, 0.39)',
      },
    },
  },
  plugins: [],
};
export default config;
