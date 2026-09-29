import React, { createContext, useContext, useState, useRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, isError = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, isError });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="toast-box show"
          style={{
            borderColor: toast.isError ? '#ff5555' : 'var(--accent)',
            boxShadow: toast.isError ? '4px 4px 0px 0px #ff5555' : '4px 4px 0px 0px var(--accent)',
          }}
        >
          {toast.isError ? (
            <AlertCircle size={18} color="#ff5555" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
