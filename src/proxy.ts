import { withAuth } from 'next-auth/middleware';

function proxy() {
  /*
    placeholder for custom middleware code
    https://nextjs.org/docs/app/building-your-application/routing/middleware
  */
}

const unAuthorizedPaths = [
  '/signup',
  '/signin',
  '/forgot-password',
  '/reset-password',
  '/manifest.webmanifest',
];

export default withAuth(proxy, {
  callbacks: {
    authorized({ req, token }) {
      const path = req.nextUrl.pathname;
      if (unAuthorizedPaths.includes(path)) {
        return true;
      }
      if (path.split('/')[1] === 'img') {
        return true;
      }
      if (token) {
        return true;
      }
      return false;
    },
  },
});
