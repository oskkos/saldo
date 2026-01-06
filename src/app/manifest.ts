import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'saldo',
    short_name: 'saldo',
    description: 'saldo - Logging work hours made easy',
    start_url: '/',
    display: 'standalone',
    background_color: '#1d232a',
    theme_color: '#605dff',
    icons: [
      {
        src: '/img/saldo.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
