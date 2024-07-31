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
      if (req.nextUrl.pathname === '/signup') {
        return true;
      }
      if (token) {
        return true;
      }
      return false;
    },
  },
});
