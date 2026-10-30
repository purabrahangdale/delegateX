import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { useWhatsAppNumber } from "../context/WhatsAppNumberContext";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, getKeywordAutoReplies, saveKeywordAutoReply } from "../services/whatsappApi";
import { FiSave, FiCheckCircle, FiSlash, FiThumbsUp, FiInfo, FiRotateCcw } from "react-icons/fi";

const MAX_LENGTH = 4096;
const PLACEHOLDERS = [
    { token: "{name}", hint: "Customer's WhatsApp name" },
    { token: "{first_name}", hint: "First word of the name" },
];
const SAMPLE_NAME = "Abhigyan Sharma";

// Same placeholders as render_customer_auto_reply on the backend, so the preview matches what is sent.
const renderPreview = (text) => text
    .replaceAll("{first_name}", SAMPLE_NAME.split(" ")[0])
    .replaceAll("{name}", SAMPLE_NAME);

const KEYWORDS = [
    {
        key: "stop",
        title: "STOP Auto-Reply",
        icon: FiSlash,
        iconClass: "text-rose-600 bg-rose-50 border-rose-100",
        trigger: "Sent when a customer replies STOP.",
        effects: [
            "The customer is always added to the Global DND list, even while this reply is off — campaigns and other automations skip them from then on.",
            "While off, no STOP confirmation is sent.",
        ],
    },
    {
        key: "yes",
        title: "YES Auto-Reply",
        icon: FiThumbsUp,
        iconClass: "text-emerald-700 bg-emerald-50 border-emerald-100",
        trigger: "Sent when a customer replies YES.",
        effects: [
            "The reply is recorded on matching CRM leads, and open leads move to Interested (Converted and Lost leads keep their status). No other automatic message is sent.",
            "While off, a YES is handled like any other customer reply (Customer Reply Auto-Reply in Settings).",
        ],
    },
];

function KeywordReplyCard({ meta, config, numberName, onSaved }) {
    const { showToast } = useToast();
    const textareaRef = useRef(null);
    const [form, setForm] = useState({ enabled: !!config.enabled, message: config.message || "" });
    const [saving, setSaving] = useState(false);
    const Icon = meta.icon;
    const fieldId = `keyword-reply-${meta.key}`;

    const dirty = form.enabled !== config.enabled || form.message.trim() !== (config.message || "");
    const canSave = !saving && dirty && !(form.enabled && !form.message.trim());

    const insertPlaceholder = (token) => {
        const el = textareaRef.current;
        const start = el ? el.selectionStart : form.message.length;
        const end = el ? el.selectionEnd : form.message.length;
        const message = (form.message.slice(0, start) + token + form.message.slice(end)).slice(0, MAX_LENGTH);
        setForm({ ...form, message });
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(start + token.length, start + token.length);
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const saved = await saveKeywordAutoReply(meta.key, { enabled: form.enabled, message: form.message });
            onSaved(meta.key, saved);
            setForm({ enabled: saved.enabled, message: saved.message });
            showToast(saved.enabled ? `${saved.keyword} auto-reply is on` : `${saved.keyword} auto-reply is off — no automatic ${saved.keyword} reply will be sent`, "success");
        } catch (err) {
            showToast(apiErrorMessage(err, `Could not save the ${meta.title}`), "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconClass}`}><Icon size={16} /></div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 font-display">{meta.title}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{meta.trigger} Applies to {numberName}.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${form.enabled ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                        {form.enabled ? "On" : "Off"}
                    </span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={form.enabled}
                        aria-label={`Send ${meta.title}`}
                        onClick={() => setForm({ ...form, enabled: !form.enabled })}
                        className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${form.enabled ? "bg-[#25D366]" : "bg-slate-300"}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-4.5" : ""}`} />
                    </button>
                </div>
            </div>

            <ul className="space-y-1">
                {meta.effects.map((e) => (
                    <li key={e} className="flex items-start gap-1.5 text-[10px] text-slate-500"><FiInfo size={11} className="mt-px shrink-0 text-slate-400" />{e}</li>
                ))}
            </ul>

            <div>
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor={fieldId} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Response message</label>
                    {form.message.trim() !== config.default_message && (
                        <button type="button" onClick={() => setForm({ ...form, message: config.default_message })}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
                            <FiRotateCcw size={10} /> Use suggested text
                        </button>
                    )}
                </div>
                <textarea
                    id={fieldId}
                    ref={textareaRef}
                    rows={5}
                    maxLength={MAX_LENGTH}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={config.default_message}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-y"
                />
                <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex flex-wrap gap-1.5">
                        {PLACEHOLDERS.map((p) => (
                            <button key={p.token} type="button" title={p.hint} onClick={() => insertPlaceholder(p.token)}
                                className="text-[10px] font-mono text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                + {p.token}
                            </button>
                        ))}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{form.message.length}/{MAX_LENGTH}</span>
                </div>
                {form.enabled && !form.message.trim() && (
                    <p className="text-[10px] text-rose-500 mt-1">Enter a message before turning this reply on.</p>
                )}
            </div>

            <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Preview</span>
                <div className="rounded-xl bg-[#efeae2] p-3 space-y-2">
                    <div className="max-w-[90%] w-fit bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs">
                        {meta.key.toUpperCase()}
                    </div>
                    {form.message.trim() ? (
                        <div className="ml-auto max-w-[90%] w-fit bg-[#d9fdd3] rounded-lg px-3 py-2 text-xs text-slate-800 whitespace-pre-wrap break-words shadow-xs">
                            {renderPreview(form.message.trim())}
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-500 text-center py-3">Your message preview appears here.</p>
                    )}
                    {!form.enabled && (
                        <p className="text-[10px] text-slate-500 text-center">Off — this reply is not sent.</p>
                    )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Shown for a customer named “{SAMPLE_NAME}”. Without a WhatsApp name, “there” is used.</p>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="flex items-center gap-2 bg-[#25D366] hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <FiCheckCircle size={14} className="animate-spin" /> : <FiSave size={14} />}
                    {saving ? "Saving..." : "Save Configuration"}
                </button>
                {!dirty && (
                    <span className="text-[10px] text-slate-400">
                        {config.updated_at
                            ? <>{config.enabled ? "On" : "Off"} · last saved {new Date(config.updated_at + (config.updated_at.endsWith("Z") ? "" : "Z")).toLocaleString()}{config.updated_by && <> by {config.updated_by}</>}</>
                            : "Not configured yet"}
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * STOP / YES keyword auto-replies of the selected business number. Each keyword is saved on its own and is
 * independent of the Customer Reply Auto-Reply in Settings.
 */
function WhatsAppKeywordReplies() {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const numberCtx = useWhatsAppNumber();
    const selected = numberCtx?.selected || null;
    const [configs, setConfigs] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selected?.id) return;
        let cancelled = false;
        getKeywordAutoReplies()
            .then((data) => { if (!cancelled) setConfigs(data); })
            .catch((err) => {
                if (cancelled) return;
                const msg = apiErrorMessage(err, "Could not load the keyword auto-replies");
                setError(msg);
                showToast(msg, "error");
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id]);

    const handleSaved = (key, saved) => setConfigs((prev) => ({ ...prev, [key]: { ...prev[key], ...saved } }));

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="keyword-replies" />

            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <button type="button" onClick={() => navigate("/whatsapp/settings")} className="hover:text-slate-600 cursor-pointer">Settings</button>
                    {" → WhatsApp Automation → Keyword-Based Auto-Replies"}
                </p>
                <h2 className="text-base font-bold text-slate-900 font-display mt-1">Keyword-Based Auto-Replies</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                    Automatic replies to customers who answer exactly STOP or YES (any capitalisation, including quick-reply buttons).
                    Each reply has its own switch and is saved separately.
                </p>
            </div>

            {!selected ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
                    <p className="text-xs text-slate-500">Add or select a WhatsApp business number to configure its keyword auto-replies.</p>
                </div>
            ) : error && !configs ? (
                <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-2xs">
                    <p className="text-xs text-rose-600">{error}</p>
                </div>
            ) : !configs ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-pulse">
                    <div className="h-[30rem] bg-slate-100 border border-slate-200/80 rounded-2xl" />
                    <div className="h-[30rem] bg-slate-100 border border-slate-200/80 rounded-2xl" />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {KEYWORDS.map((meta) => (
                        <KeywordReplyCard key={meta.key} meta={meta} config={configs[meta.key]} numberName={selected.display_name} onSaved={handleSaved} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default WhatsAppKeywordReplies;
