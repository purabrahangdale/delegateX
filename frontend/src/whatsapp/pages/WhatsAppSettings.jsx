import { useEffect, useState } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { getWhatsAppSettings, updateWhatsAppSettings } from "../services/whatsappApi";
import { FiSettings, FiSave, FiCheckCircle, FiAlertCircle, FiWifi, FiServer, FiKey, FiPhone, FiHash } from "react-icons/fi";

function WhatsAppSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [formData, setFormData] = useState({
        provider: "simulation",
        webhook_url: "",
        api_url: "",
        api_key: "",
        phone_number_id: "",
        business_account_id: "",
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
                    api_url: data.api_url || "",
                    api_key: data.api_key || "",
                    phone_number_id: data.phone_number_id || "",
                    business_account_id: data.business_account_id || "",
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
            console.error("Save error:", err);
        } finally {
            setSaving(false);
        }
    };

    const providers = [
        { value: "simulation", label: "Simulation Mode", desc: "Demo mode — no real WhatsApp API. Messages stored locally.", badge: "Default Active", badgeColor: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        { value: "meta_cloud", label: "Meta WhatsApp Cloud API", desc: "Official Meta Business Platform API (requires Meta App credentials).", badge: "Production Ready", badgeColor: "text-blue-600 bg-blue-50 border-blue-100" },
        { value: "maytapi", label: "Maytapi API", desc: "Third-party WhatsApp Web gateway service (requires Maytapi token).", badge: "Gateway Ready", badgeColor: "text-indigo-600 bg-indigo-50 border-indigo-100" },
    ];

    const isSimulation = formData.provider === "simulation";

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

            <form onSubmit={handleSave} className="space-y-6">
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

                {/* Connection Status Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 font-display">Connection & Health Status</h3>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-3.5 h-3.5 rounded-full ${settings?.is_active ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-rose-500"} animate-pulse`}></div>
                        <div>
                            <p className="text-xs font-bold text-slate-800">{settings?.provider_info?.name || "Simulation Mode"}</p>
                            <p className="text-[10px] text-slate-400">
                                {isSimulation
                                    ? "Active — 100% simulated response cycles for local testing"
                                    : settings?.is_active ? "Connected to Meta Graph API" : "Disconnected — configure credentials below"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* API Credentials */}
                <div className={`bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 transition-opacity ${isSimulation ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-bold text-slate-900 font-display">API Credentials & Endpoints</h3>
                        {isSimulation && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 uppercase">
                                Not required in Simulation Mode
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiWifi size={11} /> Webhook Callback URL</label>
                            <input type="text" value={formData.webhook_url} onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })} disabled={isSimulation} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400 font-mono" placeholder="https://your-domain.com/api/whatsapp/webhook" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiServer size={11} /> Meta Graph API URL</label>
                            <input type="text" value={formData.api_url} onChange={(e) => setFormData({ ...formData, api_url: e.target.value })} disabled={isSimulation} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400 font-mono" placeholder="https://graph.facebook.com/v18.0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiKey size={11} /> System User Token (API Key)</label>
                            <input type="password" value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} disabled={isSimulation} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400 font-mono" placeholder="••••••••••••••••••••" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiPhone size={11} /> WhatsApp Phone Number ID</label>
                            <input type="text" value={formData.phone_number_id} onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })} disabled={isSimulation} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400 font-mono" placeholder="102938475610" />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-4 pt-2">
                    <button
                        type="submit"
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
            </form>
        </div>
    );
}

export default WhatsAppSettings;
