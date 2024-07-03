/** @type {import('tailwindcss').Config} */

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      'light',
      {
        dark: {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          ...require('daisyui/src/theming/themes')['dark'],
          primary: '#6419e6',
          secondary: '#d926a9',
        },
      },
    ],
    darkTheme: 'dark',
  },
};
