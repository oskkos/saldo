import { getSession } from '@/auth/authSession';
import { redirect } from 'next/navigation';
import { ErrorMessage } from './errorMessage';
import { OAuthSignin } from './oauthSignin';
import { CredentialsSignin } from './credentialsSignin';
import { Card } from '../card';
import { SignupPageLink } from './signupPageLink';

export default async function Signin({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  const content = [
    <OAuthSignin key="oauth-signin" />,
    <CredentialsSignin key="credentials-signin" />,
    <SignupPageLink key="signup-page-link" />,
  ];

  const params = await searchParams;
  return (
    <Card message={<ErrorMessage error={params.error} />} content={content} />
  );
}
