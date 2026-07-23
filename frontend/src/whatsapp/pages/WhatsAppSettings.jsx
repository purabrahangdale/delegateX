import { useEffect, useState } from "react";
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
        { value: "simulation", label: "Simulation Mode", desc: "Demo mode — no real WhatsApp API. Messages stored locally.", badge: "Default", badgeColor: "text-green-600 bg-green-50" },
        { value: "meta_cloud", label: "Meta WhatsApp Cloud API", desc: "Official Meta Business Platform API (requires credentials).", badge: "Future", badgeColor: "text-blue-600 bg-blue-50" },
        { value: "maytapi", label: "Maytapi", desc: "Third-party WhatsApp API service (requires credentials).", badge: "Future", badgeColor: "text-violet-600 bg-violet-50" },
    ];

    const isSimulation = formData.provider === "simulation";

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-8 w-48 bg-slate-200 rounded-xl"></div>
                <div className="h-96 bg-slate-100 border border-slate-200 rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-2">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-600 text-white text-sm shadow-lg shadow-green-500/20">
                        <FiSettings size={16} />
                    </span>
                    WhatsApp Settings
                </h1>
                <p className="text-slate-500 text-xs mt-1">Configure your WhatsApp messaging provider and API credentials.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Provider Selection */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <h3 className="text-sm font-bold text-slate-900 font-display mb-4">Messaging Provider</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {providers.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, provider: p.value })}
                                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${formData.provider === p.value
                                    ? "border-green-500 bg-green-50/30 shadow-sm"
                                    : "border-slate-200 hover:border-slate-300"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-700">{p.label}</span>
                                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md ${p.badgeColor}`}>{p.badge}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">{p.desc}</p>
                                {formData.provider === p.value && (
                                    <div className="mt-2">
                                        <FiCheckCircle size={14} className="text-green-500" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Connection Status */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <h3 className="text-sm font-bold text-slate-900 font-display mb-4">Connection Status</h3>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-3 h-3 rounded-full ${settings?.is_active ? "bg-green-500 shadow-sm shadow-green-500/30" : "bg-red-500"} animate-pulse`}></div>
                        <div>
                            <p className="text-xs font-bold text-slate-700">{settings?.provider_info?.name || "Unknown Provider"}</p>
                            <p className="text-[10px] text-slate-400">
                                {isSimulation
                                    ? "Active — No credentials required in Simulation Mode"
                                    : settings?.is_active ? "Connected" : "Disconnected — check credentials"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* API Configuration */}
                <div className={`bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] transition-opacity ${isSimulation ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 font-display">API Configuration</h3>
                        {isSimulation && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                Not required in Simulation Mode
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiWifi size={10} /> Webhook URL</label>
                            <input type="text" value={formData.webhook_url} onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })} disabled={isSimulation} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-50 disabled:text-slate-400" placeholder="https://..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiServer size={10} /> API URL</label>
                            <input type="text" value={formData.api_url} onChange={(e) => setFormData({ ...formData, api_url: e.target.value })} disabled={isSimulation} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-50 disabled:text-slate-400" placeholder="https://graph.facebook.com/v18.0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiKey size={10} /> API Key</label>
                            <input type="password" value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} disabled={isSimulation} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-50 disabled:text-slate-400" placeholder="••••••••" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiPhone size={10} /> Phone Number ID</label>
                            <input type="text" value={formData.phone_number_id} onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })} disabled={isSimulation} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-50 disabled:text-slate-400" placeholder="12345678901234" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><FiHash size={10} /> Business Account ID</label>
                            <input type="text" value={formData.business_account_id} onChange={(e) => setFormData({ ...formData, business_account_id: e.target.value })} disabled={isSimulation} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-50 disabled:text-slate-400" placeholder="Business Account ID" />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-green-500/15 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? <FiCheckCircle size={14} className="animate-spin" /> : <FiSave size={14} />}
                        {saving ? "Saving..." : "Save Settings"}
                    </button>
                    {saved && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-semibold animate-fade-in">
                            <FiCheckCircle size={14} /> Settings saved successfully
                        </span>
                    )}
                </div>
            </form>
        </div>
    );
}

export default WhatsAppSettings;
