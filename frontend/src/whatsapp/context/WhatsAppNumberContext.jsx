import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FiPhone, FiSettings } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, getActiveNumberId, getWhatsAppNumbers, setActiveNumberId } from "../services/whatsappApi";

/*
 * Global WhatsApp business number selection.
 * - The selected number id is persisted (localStorage) and attached to every WhatsApp API request.
 * - Pages are remounted when the number changes, so no data of the previous number stays on screen.
 * - Pages with unsaved work register a guard; switching then asks for confirmation instead of silently
 *   moving a draft to another number.
 */
const WhatsAppNumberContext = createContext(null);

export function useWhatsAppNumber() {
    return useContext(WhatsAppNumberContext);
}

export function useNumberSwitchGuard(isDirty, message) {
    const ctx = useContext(WhatsAppNumberContext);
    const state = useRef({ isDirty, message });
    useEffect(() => {
        state.current = { isDirty, message };
    });
    useEffect(() => {
        if (!ctx) return undefined;
        const guard = () => (state.current.isDirty ? state.current.message || "You have unsaved changes on this page." : null);
        ctx.addGuard(guard);
        return () => ctx.removeGuard(guard);
    }, [ctx]);
}

export function WhatsAppNumberProvider({ children }) {
    const { showToast } = useToast();
    const [numbers, setNumbers] = useState([]);
    const [info, setInfo] = useState({ canManage: false, purposes: [], defaultNumberId: null, graphVersion: "v22.0" });
    const [selectedId, setSelectedId] = useState(getActiveNumberId());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const guards = useRef(new Set());
    const lastRefresh = useRef(0);

    const refresh = useCallback(async () => {
        lastRefresh.current = Date.now();
        try {
            const data = await getWhatsAppNumbers();
            const list = data.numbers || [];
            setNumbers(list);
            setInfo({
                canManage: !!data.can_manage,
                purposes: data.purposes || [],
                defaultNumberId: data.default_number_id || null,
                graphVersion: data.graph_api_default_version || "v22.0",
            });
            setError(null);
            const current = getActiveNumberId();
            if (!current || !list.some((n) => n.id === current)) {
                // The stored selection is missing, removed or no longer accessible: use the default number
                // (the administrator's explicit choice) — otherwise the user must pick one.
                const next = data.default_number_id || null;
                if (current && list.length) {
                    showToast(next
                        ? "The previously selected WhatsApp number is no longer available. Switched to the default number."
                        : "The previously selected WhatsApp number is no longer available. Please select a number.", "warning");
                }
                setActiveNumberId(next);
                setSelectedId(next);
            }
            return data;
        } catch (e) {
            setError(apiErrorMessage(e, "Could not load WhatsApp numbers"));
            return null;
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { refresh(); }, [refresh]);

    // The backend reports a removed / forbidden / missing selection → re-validate (throttled).
    useEffect(() => {
        const onInvalid = () => {
            if (Date.now() - lastRefresh.current > 2000) refresh();
        };
        window.addEventListener("whatsapp:number-invalid", onInvalid);
        return () => window.removeEventListener("whatsapp:number-invalid", onInvalid);
    }, [refresh]);

    const addGuard = useCallback((g) => guards.current.add(g), []);
    const removeGuard = useCallback((g) => guards.current.delete(g), []);

    const selectNumber = useCallback((id) => {
        if (!id || id === getActiveNumberId()) return true;
        for (const guard of guards.current) {
            const warning = guard();
            if (warning && !window.confirm(`${warning}\n\nSwitch WhatsApp number anyway? Unsaved changes will be discarded.`)) {
                return false;
            }
        }
        setActiveNumberId(id);
        setSelectedId(id);
        return true;
    }, []);

    const selected = numbers.find((n) => n.id === selectedId) || null;

    const value = useMemo(() => ({
        numbers, selected, selectedId, loading, error, refresh, selectNumber, addGuard, removeGuard, ...info,
    }), [numbers, selected, selectedId, loading, error, refresh, selectNumber, addGuard, removeGuard, info]);

    return <WhatsAppNumberContext.Provider value={value}>{children}</WhatsAppNumberContext.Provider>;
}

function NumberRequiredPanel() {
    const { numbers, selectNumber, canManage } = useWhatsAppNumber();
    const navigate = useNavigate();
    return (
        <div className="max-w-xl mx-auto mt-10 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><FiPhone size={18} /></div>
                <div>
                    <h2 className="text-sm font-bold text-slate-900 font-display">Select a WhatsApp business number</h2>
                    <p className="text-[11px] text-slate-500">No default number is set. Choose the number you want to work with.</p>
                </div>
            </div>
            <div className="space-y-2">
                {numbers.map((n) => (
                    <button key={n.id} type="button" onClick={() => selectNumber(n.id)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-left cursor-pointer transition">
                        <span>
                            <span className="block text-xs font-bold text-slate-800">{n.display_name}</span>
                            <span className="block text-[11px] text-slate-500 font-mono">{n.phone_number || n.phone_number_id}</span>
                        </span>
                        {!n.is_active && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase">Inactive</span>}
                    </button>
                ))}
            </div>
            {canManage && (
                <button type="button" onClick={() => navigate("/whatsapp/settings")} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
                    <FiSettings size={12} /> Manage numbers and set a default
                </button>
            )}
        </div>
    );
}

function NumberGate() {
    const { loading, numbers, selectedId } = useWhatsAppNumber();
    const location = useLocation();
    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="h-96 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
            </div>
        );
    }
    const onSettings = location.pathname.startsWith("/whatsapp/settings");
    if (numbers.length > 0 && !selectedId && !onSettings) return <NumberRequiredPanel />;
    // Keyed by number: switching remounts the page, discarding every cached list of the previous number.
    return <Outlet key={selectedId || "no-number"} />;
}

export function WhatsAppNumberLayout() {
    return (
        <WhatsAppNumberProvider>
            <NumberGate />
        </WhatsAppNumberProvider>
    );
}
