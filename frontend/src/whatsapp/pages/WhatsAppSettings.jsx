import { useEffect, useState } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import WhatsAppDiagnostics from "../components/WhatsAppDiagnostics";
import WhatsAppNumberManager, { ConnectionBadge } from "../components/WhatsAppNumberManager";
import { useWhatsAppNumber } from "../context/WhatsAppNumberContext";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, getWhatsAppSettings, updateWhatsAppSettings } from "../services/whatsappApi";
import { FiSave, FiCheckCircle, FiWifi, FiServer, FiKey, FiPhone, FiEdit2 } from "react-icons/fi";

function WhatsAppSettings() {
    const { showToast } = useToast();
    const numberCtx = useWhatsAppNumber();
    const selected = numberCtx?.selected || null;
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [editRequest, setEditRequest] = useState(null);
    // Global settings only — Meta credentials belong to each business number.
    const [formData, setFormData] = useState({
        provider: "simulation",
        webhook_url: "",
        is_active: true,
    });

    const fetchSettings = async () => {
        try {
            const data = await getWhatsAppSettings();
            if (data) {
                setSettings(data);
                setFormData({
                    provider: data.provider || "simulation",
                    webhook_url: data.webhook_url || "",
                    is_active: data.is_active !== false,
                });
            }
        } catch (err) {
            console.error("Failed to load settings", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaved(false);
        try {
            await updateWhatsAppSettings(formData);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            await fetchSettings();
        } catch (err) {
            showToast(apiErrorMessage(err, "Could not save settings"), "error");
        } finally {
            setSaving(false);
        }
    };

    const providers = [
        { value: "meta_cloud", label: "Meta WhatsApp Cloud API", desc: "Official Meta Business Platform API (Meta WhatsApp Cloud API).", badge: "Active Production", badgeColor: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        { value: "simulation", label: "Simulation Mode", desc: "Demo mode — local sandbox testing without sending real WhatsApp messages.", badge: "Demo / Test", badgeColor: "text-amber-700 bg-amber-50 border-amber-200" },
        { value: "maytapi", label: "Maytapi API", desc: "Third-party WhatsApp Web gateway service (requires Maytapi token).", badge: "Gateway Ready", badgeColor: "text-indigo-600 bg-indigo-50 border-indigo-100" },
    ];

    const isSimulation = formData.provider === "simulation";
    const status = selected?.connection?.status;
    const callbackUrl = formData.webhook_url || `${(import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "")}/api/whatsapp/webhook`;

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="h-96 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="settings" />

            {/* Not a <form>: the number editor below is a form of its own and forms cannot be nested. */}
            <div className="space-y-6">
                {/* Messaging Provider Selector */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 font-display">Messaging Provider Abstraction</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {providers.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, provider: p.value })}
                                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${formData.provider === p.value
                                    ? "border-[#25D366] bg-emerald-50/30 shadow-xs"
                                    : "border-slate-200/80 hover:border-slate-300"
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-800 font-display">{p.label}</span>
                                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md border ${p.badgeColor}`}>{p.badge}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{p.desc}</p>
                                </div>
                                {formData.provider === p.value && (
                                    <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                        <FiCheckCircle size={14} className="text-[#25D366]" /> Selected
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Business numbers (multi-number / multi-WABA) */}
                <WhatsAppNumberManager callbackUrl={callbackUrl} editRequest={editRequest} />

                {/* Connection Status Card — selected number */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 font-display">Connection & Health Status</h3>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-3.5 h-3.5 rounded-full ${isSimulation ? "bg-amber-400" : status === "connected" ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : status === "error" ? "bg-rose-500" : "bg-amber-400"} animate-pulse`}></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800">
                                {settings?.provider_info?.name || "Simulation Mode"}
                                {selected && <span className="font-normal text-slate-500"> · {selected.display_name} ({selected.phone_number || selected.phone_number_id})</span>}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                {isSimulation
                                    ? "Active — 100% simulated response cycles for local testing"
                                    : !selected
                                        ? "No WhatsApp business number selected — add or select a number above"
                                        : !selected.is_active
                                            ? "This number is deactivated — it cannot send messages"
                                            : selected.connection?.message || "Connection not tested yet — use Test connection above"}
                            </p>
                        </div>
                        {!isSimulation && selected && <ConnectionBadge number={selected} />}
                    </div>
                </div>

                {/* API Credentials — of the selected number */}
                <div className={`bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 transition-opacity ${isSimulation ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 font-display">API Credentials & Endpoints</h3>
                            {selected && <p className="text-[10px] text-slate-400">Showing the selected number: {selected.display_name}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            {isSimulation && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 uppercase">
                                    Not required in Simulation Mode
                                </span>
                            )}
                            {selected && numberCtx?.canManage && (
                                <button type="button" onClick={() => setEditRequest({ id: selected.id, at: Date.now() })}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                    <FiEdit2 size={11} /> Edit configuration
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiWifi size={11} /> Webhook Callback URL</label>
                            <input type="text" value={formData.webhook_url} onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })} disabled={isSimulation} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400 font-mono" placeholder="https://your-domain.com/api/whatsapp/webhook" />
                            <p className="text-[10px] text-slate-400 mt-1">One callback URL serves every number; events are routed by Phone Number ID.</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiServer size={11} /> Meta Graph API URL</label>
                            <input type="text" readOnly value={selected?.graph_api_url || ""} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-mono" placeholder="Generated from the selected number" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiKey size={11} /> System User Token (API Key)</label>
                            <input type="text" readOnly value={selected ? (selected.token_configured ? `${selected.token_hint}${selected.token_source === "env" ? "  (server environment)" : ""}` : "Not configured") : ""} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-mono" placeholder="••••••••••••••••••••" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiPhone size={11} /> WhatsApp Phone Number ID</label>
                            <input type="text" readOnly value={selected?.phone_number_id || ""} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-mono" placeholder="Select or add a number" />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-4 pt-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-[#25D366] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <FiCheckCircle size={14} className="animate-spin" /> : <FiSave size={14} />}
                        {saving ? "Saving..." : "Save Settings"}
                    </button>
                    {saved && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-fade-in">
                            <FiCheckCircle size={14} /> Settings updated successfully!
                        </span>
                    )}
                </div>
            </div>

            <WhatsAppDiagnostics />
        </div>
    );
}

export default WhatsAppSettings;
