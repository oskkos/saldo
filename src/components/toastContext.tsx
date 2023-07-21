import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useState,
} from 'react';
import Toast from './toast';

interface ToastMsg {
  type?: 'info' | 'success' | 'warning' | 'error';
  message: string | JSX.Element;
}

export const ToastContext = createContext<{
  msg: ToastMsg | null;
  setMsg: Dispatch<SetStateAction<ToastMsg | null>>;
}>({
  msg: null,
  setMsg: () => {
    /*no-op*/
  },
});

export default function ToastContextWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const [msg, setMsg] = useState<{
    type?: 'info' | 'success' | 'warning' | 'error';
    message: string | JSX.Element;
  } | null>(null);

  if (msg) {
    setTimeout(() => {
      setMsg(null);
    }, 2000);
  }
  return (
    <ToastContext.Provider value={{ msg, setMsg }}>
      {msg ? <Toast type={msg.type} msg={msg.message} /> : null}
      {children}
    </ToastContext.Provider>
  );
}
