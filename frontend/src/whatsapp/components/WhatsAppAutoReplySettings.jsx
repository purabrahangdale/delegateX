import { useEffect, useRef, useState } from "react";
import { useWhatsAppNumber } from "../context/WhatsAppNumberContext";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, getCustomerAutoReply, saveCustomerAutoReply } from "../services/whatsappApi";
import { FiSave, FiCheckCircle, FiMessageSquare } from "react-icons/fi";

const MAX_LENGTH = 4096;
const PLACEHOLDERS = [
    { token: "{name}", hint: "Customer's WhatsApp name" },
    { token: "{first_name}", hint: "First word of the name" },
];
const SAMPLE_NAME = "Abhigyan Sharma";

// Mirrors render_customer_auto_reply on the backend so the preview matches what is sent.
const renderPreview = (text) => text
    .replaceAll("{first_name}", SAMPLE_NAME.split(" ")[0])
    .replaceAll("{name}", SAMPLE_NAME);

/**
 * Custom auto-reply for customer messages (e.g. a reply to a template) that match no keyword
 * command, configured per business number. While disabled, the AI assistant answers instead.
 */
function WhatsAppAutoReplySettings() {
    const { showToast } = useToast();
    const numberCtx = useWhatsAppNumber();
    const selected = numberCtx?.selected || null;
    const textareaRef = useRef(null);
    const [form, setForm] = useState({ enabled: false, message: "" });
    const [savedConfig, setSavedConfig] = useState(null);
    // Number whose config is in the form; loading until it matches the selected number.
    const [loadedFor, setLoadedFor] = useState(null);
    const [saving, setSaving] = useState(false);
    const loading = !!selected?.id && loadedFor !== selected.id;

    useEffect(() => {
        const numberId = selected?.id;
        if (!numberId) return;
        let cancelled = false;
        getCustomerAutoReply()
            .then((config) => {
                if (cancelled) return;
                setSavedConfig(config);
                setForm({ enabled: !!config?.enabled, message: config?.message || "" });
                setLoadedFor(numberId);
            })
            .catch((err) => {
                if (cancelled) return;
                showToast(apiErrorMessage(err, "Could not load the auto-reply"), "error");
                setSavedConfig(null);
                setLoadedFor(numberId);
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id]);

    const dirty = !!savedConfig && (form.enabled !== savedConfig.enabled || form.message.trim() !== (savedConfig.message || ""));
    const canSave = !!selected && !saving && dirty && !(form.enabled && !form.message.trim());

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
            const config = await saveCustomerAutoReply({ enabled: form.enabled, message: form.message });
            setSavedConfig(config);
            setForm({ enabled: config.enabled, message: config.message });
            showToast(config.enabled ? "Custom auto-reply is on" : "Auto-reply saved — the AI assistant will answer", "success");
        } catch (err) {
            showToast(apiErrorMessage(err, "Could not save the auto-reply"), "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-1.5">
                        <FiMessageSquare size={14} /> Customer Reply Auto-Reply
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                        Sent when a customer replies (for example to a template message) and the reply is not a keyword command
                        such as STATUS or AGENT. While off, the AI assistant answers instead.
                        {selected && <> Applies to {selected.display_name}.</>}
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={form.enabled}
                    aria-label="Use custom auto-reply"
                    disabled={!selected || loading}
                    onClick={() => setForm({ ...form, enabled: !form.enabled })}
                    className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${form.enabled ? "bg-[#25D366]" : "bg-slate-300"}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-4.5" : ""}`} />
                </button>
            </div>

            {!selected ? (
                <p className="text-xs text-slate-500">Add or select a WhatsApp business number to configure its auto-reply.</p>
            ) : loading ? (
                <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="customer-auto-reply" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Message</label>
                        <textarea
                            id="customer-auto-reply"
                            ref={textareaRef}
                            rows={7}
                            maxLength={MAX_LENGTH}
                            value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            placeholder={"Hi {first_name}! Thanks for your reply. Our team will get back to you shortly."}
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
                            <p className="text-[10px] text-rose-500 mt-1">Enter a message before turning the auto-reply on.</p>
                        )}
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Preview</span>
                        <div className="rounded-xl bg-[#efeae2] p-3 min-h-[9.5rem]">
                            {form.message.trim() ? (
                                <div className="ml-auto max-w-[90%] w-fit bg-[#d9fdd3] rounded-lg px-3 py-2 text-xs text-slate-800 whitespace-pre-wrap break-words shadow-xs">
                                    {renderPreview(form.message.trim())}
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-500 text-center pt-10">Your message preview appears here.</p>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Shown for a customer named “{SAMPLE_NAME}”. Without a WhatsApp name, “there” is used.</p>
                    </div>
                </div>
            )}

            {selected && !loading && (
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                        className="flex items-center gap-2 bg-[#25D366] hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <FiCheckCircle size={14} className="animate-spin" /> : <FiSave size={14} />}
                        {saving ? "Saving..." : "Save Auto-Reply"}
                    </button>
                    {savedConfig?.updated_at && !dirty && (
                        <span className="text-[10px] text-slate-400">
                            {savedConfig.enabled ? "On" : "Off"} · last saved {new Date(savedConfig.updated_at + (savedConfig.updated_at.endsWith("Z") ? "" : "Z")).toLocaleString()}
                            {savedConfig.updated_by && <> by {savedConfig.updated_by}</>}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export default WhatsAppAutoReplySettings;
