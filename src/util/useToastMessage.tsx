import Toast from '@/components/toast';
import { useState } from 'react';

export default function useToastMessage() {
  const [msg, setMsg] = useState<{
    type?: 'info' | 'success' | 'warning' | 'error';
    message: string | JSX.Element;
  } | null>(null);

  if (msg) {
    setTimeout(() => {
      setMsg(null);
    }, 2000);
  }

  const ToastMsg = () =>
    msg ? <Toast type={msg.type} msg={msg.message} /> : null;
  return [ToastMsg, setMsg] as const;
}
