import 'server-only';

import { getUserByPasswordResetToken } from '@/repository/userRepository';
import Message from '@/components/message';
import { Card } from '../card';
import { Page2 } from './page2';

export default async function ResetPassword({
  searchParams,
}: {
  params: { slug: string };
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = params.token;
  if (!token || Array.isArray(token)) {
    return (
      <Card
        message={<Message type="error" title="Invalid token" />}
        content={[]}
      />
    );
  }

  const user = await getUserByPasswordResetToken(token);
  if (!user) {
    return (
      <Card
        message={<Message type="error" title="Invalid token" />}
        content={[]}
      />
    );
  }

  return <Page2 token={token} />;
}
