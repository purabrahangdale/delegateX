import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheck, FiChevronDown, FiPhone, FiPlus, FiSettings } from "react-icons/fi";
import { useWhatsAppNumber } from "../context/WhatsAppNumberContext";
import { connectionDot } from "./numberStatus";

/** Global "WhatsApp Business Number" selector shown in the header of every WhatsApp page. */
function WhatsAppNumberSelector() {
    const ctx = useWhatsAppNumber();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    if (!ctx) return null;
    const { numbers, selected, selectNumber, canManage, loading } = ctx;

    if (!loading && numbers.length === 0) {
        return (
            <button type="button" onClick={() => navigate("/whatsapp/settings")}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-[11px] font-semibold cursor-pointer hover:bg-amber-100 transition">
                <FiPlus size={12} /> No WhatsApp number configured — Add number
            </button>
        );
    }

    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={() => setOpen((o) => !o)} disabled={loading}
                className="flex items-center gap-2.5 bg-white border border-slate-200/90 hover:border-emerald-300 rounded-xl pl-3 pr-2.5 py-1.5 text-left shadow-xs transition cursor-pointer min-w-[230px] max-w-[340px]"
                title="WhatsApp Business Number used across all WhatsApp pages">
                <span className={`w-2 h-2 rounded-full shrink-0 ${connectionDot(selected)}`}></span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Business Number</span>
                    <span className="block text-xs font-bold text-slate-800 truncate">
                        {selected ? `${selected.display_name} — ${selected.phone_number || selected.phone_number_id}` : "Select a number"}
                    </span>
                </span>
                <FiChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute left-0 mt-2 w-[320px] max-w-[85vw] bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-1.5 animate-fade-in">
                    <div className="max-h-72 overflow-y-auto">
                        {numbers.map((n) => {
                            const isSelected = n.id === selected?.id;
                            return (
                                <button key={n.id} type="button"
                                    onClick={() => { if (selectNumber(n.id)) setOpen(false); }}
                                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left cursor-pointer transition ${isSelected ? "bg-emerald-50/70" : "hover:bg-slate-50"}`}>
                                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${connectionDot(n)}`}></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-800 truncate">{n.display_name}</span>
                                            {n.is_default && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md uppercase">Default</span>}
                                            {!n.is_active && <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase">Inactive</span>}
                                        </span>
                                        <span className="block text-[11px] text-slate-500 font-mono">{n.phone_number || `ID ${n.phone_number_id}`}</span>
                                        <span className="block text-[10px] text-slate-400 truncate">
                                            {[n.purpose, n.waba_name || (n.waba_id && `WABA ${n.waba_id}`)].filter(Boolean).join(" · ")}
                                        </span>
                                    </span>
                                    {isSelected && <FiCheck size={14} className="text-emerald-600 mt-1 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                    {canManage && (
                        <button type="button" onClick={() => { setOpen(false); navigate("/whatsapp/settings"); }}
                            className="w-full flex items-center gap-1.5 mt-1 p-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
                            <FiSettings size={12} /> Manage business numbers
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export function SelectedNumberBadge() {
    const ctx = useWhatsAppNumber();
    if (!ctx?.selected) return null;
    const n = ctx.selected;
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <FiPhone size={11} className="text-emerald-600" /> {n.display_name} — {n.phone_number || n.phone_number_id}
        </span>
    );
}

export default WhatsAppNumberSelector;
