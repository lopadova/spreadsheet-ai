import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    type ReactNode,
} from 'react';

export interface Toast {
    id: string;
    title: string;
    body?: string;
    kind?: 'default' | 'error' | 'warn';
    duration?: number;
}

interface ToastApi {
    push(toast: Omit<Toast, 'id'>): void;
}

const ToastContext = createContext<ToastApi>({ push: () => {} });

export function useToast(): ToastApi {
    return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const seq = useRef(0);

    const push = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `t${seq.current++}`;
        setToasts((prev) => [...prev, { ...toast, id }]);
        const duration = toast.duration ?? 3600;
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    return (
        <ToastContext.Provider value={{ push }}>
            {children}
            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast ${t.kind && t.kind !== 'default' ? t.kind : ''}`}>
                        <b>{t.title}</b>
                        {t.body && <small>{t.body}</small>}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
