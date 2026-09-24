/**
 * Charte iAgent pour la boutique : les mêmes valeurs que
 * desktop/src/charte.css, déclinées en nuances Tailwind.
 * banc/charte.mjs vérifie que les couleurs du logo restent identiques des
 * deux côtés.
 *
 * - neon  : le cyan du logo (#03F3FF en 400), couleur d'action et de lien
 * - rose  : le rose du dégradé du logo (#E65090 en 500)
 * - braise: l'orange du dégradé du logo (#F28E44 en 500)
 * - nuit  : les fonds bleu nuit et les gris bleutés du texte
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          100: '#ccfdff',
          200: '#7ff9ff',
          300: '#4df6ff',
          400: '#03f3ff',
          500: '#00d9e6',
          600: '#00b3c2',
          700: '#008a96',
          800: '#00616a',
          900: '#003d43',
        },
        rose: {
          100: '#fbd5e5',
          200: '#f5a8c9',
          300: '#ef7fae',
          400: '#ea6a9f',
          500: '#e65090',
          600: '#c93a78',
          700: '#9e2c5e',
          800: '#721f44',
          900: '#46132a',
        },
        braise: {
          300: '#f8b98a',
          400: '#f5a26a',
          500: '#f28e44',
          600: '#d97530',
        },
        nuit: {
          50: '#e9fbff',
          100: '#d6f3fb',
          200: '#a7bdd3',
          300: '#8aa2ba',
          400: '#6c8198',
          500: '#4a5f78',
          600: '#1f3350',
          700: '#132540',
          800: '#0a1830',
          900: '#050a18',
          950: '#03050c',
        },
        succes: '#2dfc9a',
      },
      fontFamily: {
        sans: ['"Exo 2"', 'system-ui', 'sans-serif'],
        display: ['Orbitron', '"Exo 2"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 6px rgba(3, 243, 255, 0.6), 0 0 22px rgba(3, 243, 255, 0.25)',
        'neon-fort': '0 0 8px rgba(3, 243, 255, 0.9), 0 0 32px rgba(3, 243, 255, 0.45)',
        rose: '0 0 8px rgba(230, 80, 144, 0.7), 0 0 26px rgba(242, 142, 68, 0.3)',
      },
    },
  },
  plugins: [],
};
