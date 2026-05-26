import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
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
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        return () => {
            timers.current.forEach(clearTimeout);
        };
    }, []);

    const push = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `t${seq.current++}`;
        setToasts((prev) => [...prev, { ...toast, id }]);
        const duration = toast.duration ?? 3600;
        const timerId = setTimeout(() => {
            timers.current.delete(id);
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
        timers.current.set(id, timerId);
    }, []);

    const api = useMemo(() => ({ push }), [push]);

    return (
        <ToastContext.Provider value={api}>
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
