export default function Toast({
  type,
  msg,
}: {
  type?: 'info' | 'success' | 'warning' | 'error';
  msg: string | JSX.Element;
}) {
  const map = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error',
  };
  return (
    <div className="toast toast-top toast-center z-10">
      <div className={`alert ${type ? map[type] : ''}`}>
        <span>{msg}</span>
      </div>
    </div>
  );
}
