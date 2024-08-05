import { withAuth } from 'next-auth/middleware';

function middleware() {
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
];

export default withAuth(middleware, {
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
