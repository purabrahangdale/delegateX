import { createContext, useContext, useState, useCallback } from "react";
import { FiCheck, FiX, FiAlertCircle, FiInfo } from "react-icons/fi";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = "success") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3500);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-xl border shadow-lg animate-slide-up bg-white text-slate-800 transition-all duration-300 ${
                            toast.type === "error"
                                ? "border-rose-100 bg-rose-50/90 text-rose-800"
                                : toast.type === "warning"
                                ? "border-amber-100 bg-amber-50/90 text-amber-800"
                                : toast.type === "info"
                                ? "border-sky-100 bg-sky-50/90 text-sky-800"
                                : "border-emerald-100 bg-emerald-50/90 text-emerald-800"
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            {toast.type === "error" && <FiAlertCircle className="text-rose-500 shrink-0" size={16} />}
                            {toast.type === "warning" && <FiAlertCircle className="text-amber-500 shrink-0" size={16} />}
                            {toast.type === "info" && <FiInfo className="text-sky-500 shrink-0" size={16} />}
                            {toast.type === "success" && <FiCheck className="text-emerald-500 shrink-0" size={16} />}
                            <span className="text-xs font-semibold leading-normal">{toast.message}</span>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition cursor-pointer"
                        >
                            <FiX size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
