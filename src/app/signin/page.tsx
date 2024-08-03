import { getSession } from '@/auth/authSession';
import SigninUI from './signin';
import { redirect } from 'next/navigation';

export default async function Signin({
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  const error =
    searchParams.error instanceof Array
      ? searchParams.error.join(', ')
      : searchParams.error;
  return <SigninUI error={error} />;
}
