import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'saldo',
    short_name: 'saldo',
    description: 'saldo - Logging work hours made easy',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#422ad5',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/img/saldo.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
