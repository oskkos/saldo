import { MdError } from 'react-icons/md';

export const errStringResolver = (error: string | undefined) => {
  if (!error) {
    return null;
  }
  switch (error) {
    case 'CredentialsSignin':
      return 'Invalid email or password. Please try again.';
    default:
      return 'An error occurred. Please try again.';
  }
};
export const ErrorMsg = ({ msg }: { msg: string }) => (
  <div role="alert" className="alert alert-error mt-3">
    <MdError />
    <span className="text-xs">{msg}</span>
  </div>
);
