import { MdCheckCircleOutline, MdError } from 'react-icons/md';

const getIconByType = (type: 'success' | 'error') => {
  switch (type) {
    case 'success':
      return <MdCheckCircleOutline />;
    case 'error':
      return <MdError />;
    default:
      return null;
  }
};

export default function Message({
  type,
  title,
  description,
  icon,
}: {
  type: 'success' | 'error';
  title: string | JSX.Element;
  description?: string | JSX.Element;
  icon?: JSX.Element;
}) {
  return (
    <div
      role="alert"
      className={`alert alert-${type} mt-3 flex items-baseline`}
    >
      <span className="shrink-0">{icon ?? getIconByType(type)}</span>
      <div className="flex items-start flex-col">
        {title}
        {description && (
          <div className="flex flex-col items-start text-xs">{description}</div>
        )}
      </div>
    </div>
  );
}
