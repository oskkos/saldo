import { withAuth } from 'next-auth/middleware';

function middleware() {
  /*
    placeholder for custom middleware code
    https://nextjs.org/docs/app/building-your-application/routing/middleware
  */
}

export default withAuth(middleware, {
  callbacks: {
    authorized({ req, token }) {
      const path = req.nextUrl.pathname;
      if (path === '/signup' || path === '/signin') {
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
