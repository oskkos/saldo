import Message from '@/components/message';

const errStringResolver = (error: string | string[] | undefined) => {
  if (!error) {
    return null;
  }
  if (Array.isArray(error)) {
    return 'An error occurred. Please try again.';
  }
  switch (error) {
    case 'CredentialsSignin':
      return 'Invalid email or password. Please try again.';
    default:
      return 'An error occurred. Please try again.';
  }
};

export function ErrorMessage({
  error,
}: {
  error: string | string[] | undefined;
}) {
  const errMsg = errStringResolver(error);
  return errMsg ? (
    <Message type="error" title={<span className="text-xs">{errMsg}</span>} />
  ) : undefined;
}
