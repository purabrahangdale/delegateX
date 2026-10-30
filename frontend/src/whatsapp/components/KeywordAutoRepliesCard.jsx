import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useWhatsAppNumber } from "../context/WhatsAppNumberContext";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, getKeywordAutoReplies, saveKeywordAutoReply } from "../services/whatsappApi";
import { FiCornerUpLeft, FiRotateCcw } from "react-icons/fi";

const MAX_LENGTH = 4096;
// Meta's limit for a quick-reply button title (MAX_KEYWORD_LENGTH on the backend).
const MAX_KEYWORD_LENGTH = 25;
const SAMPLE_NAME = "Abhigyan Sharma";
const OPT_OUT_KEYS = ["stop", "unsubscribe", "remove", "quit", "dnd"];

// Same placeholders as render_customer_auto_reply on the backend, so the preview matches what is sent.
const renderPreview = (text) => text
    .replaceAll("{first_name}", SAMPLE_NAME.split(" ")[0])
    .replaceAll("{name}", SAMPLE_NAME);

// Same as normalize_keyword / keyword_key on the backend, so a button maps to the reply its tap triggers.
const normalizeKeyword = (text) => (text || "").trim().replace(/[.! ]+$/, "").toUpperCase().split(/\s+/).filter(Boolean).join(" ");
const keywordKey = (text) => normalizeKeyword(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || null;

const keywordEffect = (key) => {
    if (OPT_OUT_KEYS.includes(key)) return "Also adds the customer to Global DND";
    if (key === "yes") return "Also marks matching CRM leads Interested";
    return null;
};

function KeywordRow({ title, config, form, dirty, onChange, onRevert }) {
    const fieldId = `keyword-reply-${config.key}`;
    const tooLong = normalizeKeyword(title).length > MAX_KEYWORD_LENGTH;
    const effect = keywordEffect(config.key);
    const status = dirty ? "Saves with template" : config.updated_at ? (config.enabled ? "On" : "Off") : "Not saved";

    return (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-2.5">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[60%]">{title}</span>
                {effect && <span className="text-[10px] text-slate-400 truncate hidden sm:inline">{effect}</span>}
                <span className={`ml-auto text-[10px] shrink-0 ${dirty ? "text-amber-600 font-semibold" : "text-slate-400"}`}>{status}</span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={form.enabled}
                    aria-label={`Send the ${title} auto-reply`}
                    title={form.enabled ? "Reply on" : "Reply off"}
                    onClick={() => onChange({ ...form, enabled: !form.enabled })}
                    className={`relative shrink-0 w-9 h-5 rounded-full transition-colors cursor-pointer ${form.enabled ? "bg-emerald-500" : "bg-slate-200"}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-4" : ""}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-2.5">
                <div>
                    <textarea
                        id={fieldId}
                        rows={3}
                        maxLength={MAX_LENGTH}
                        value={form.message}
                        onChange={(e) => onChange({ ...form, message: e.target.value })}
                        placeholder={config.default_message || `Reply sent when a customer taps ${title}`}
                        aria-label={`${title} reply message`}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-y"
                    />
                    {tooLong ? (
                        <p className="text-[10px] text-rose-500">Button titles over {MAX_KEYWORD_LENGTH} characters can't have an auto-reply.</p>
                    ) : form.enabled && !form.message.trim() && (
                        <p className="text-[10px] text-rose-500">Enter a message before turning this reply on.</p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-400">
                        <span>{"{name}"}, {"{first_name}"} · {form.message.length}/{MAX_LENGTH}</span>
                        <span className="flex items-center gap-2.5">
                            {config.default_message && form.message.trim() !== config.default_message && (
                                <button type="button" onClick={() => onChange({ ...form, message: config.default_message })}
                                    className="font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
                                    Use suggested
                                </button>
                            )}
                            {dirty && (
                                <button type="button" onClick={onRevert}
                                    className="flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
                                    <FiRotateCcw size={10} /> Revert
                                </button>
                            )}
                        </span>
                    </div>
                </div>

                <div className="rounded-lg bg-[#efeae2] p-2 space-y-1.5 self-start">
                    <div className="w-fit max-w-full bg-white rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-xs truncate">{title}</div>
                    {form.message.trim() && form.enabled ? (
                        <div className="ml-auto max-w-[90%] w-fit bg-[#d9fdd3] rounded-md px-2.5 py-1.5 text-[11px] text-slate-800 whitespace-pre-wrap break-words shadow-xs">
                            {renderPreview(form.message.trim())}
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-500 text-center py-0.5">{form.enabled ? "Enter a message" : "No auto-reply"}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Auto-replies for the template's quick-reply (Custom) buttons: one row per distinct button title.
 * A tap sends the button title, so replies are saved per number under that title (shared by every
 * template using it). Unsaved edits belong to the button (by id): they follow a rename and are dropped
 * with the button. A row without edits shows the reply saved for its current title.
 * Edited replies are saved by the template's own Save / Submit through the ref: validate() then saveAll().
 */
const KeywordAutoRepliesCard = forwardRef(function KeywordAutoRepliesCard({ buttons = [] }, ref) {
    const { showToast } = useToast();
    const numberCtx = useWhatsAppNumber();
    const selected = numberCtx?.selected || null;
    // Tagged with the number they belong to, so switching numbers never shows the previous one's replies.
    const [loaded, setLoaded] = useState({ numberId: null, configs: null, error: null });
    const [drafts, setDrafts] = useState({}); // button id → { enabled, message }
    const configs = loaded.numberId === selected?.id ? loaded.configs : null;
    const error = loaded.numberId === selected?.id ? loaded.error : null;

    useEffect(() => {
        if (!selected?.id) return;
        const numberId = selected.id;
        let cancelled = false;
        getKeywordAutoReplies()
            .then((data) => { if (!cancelled) setLoaded({ numberId, configs: data, error: null }); })
            .catch((err) => {
                if (cancelled) return;
                const msg = apiErrorMessage(err, "Could not load the keyword auto-replies");
                setLoaded({ numberId, configs: null, error: msg });
                showToast(msg, "error");
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id]);

    // Writes one button's draft; drafts of deleted buttons are dropped on the way.
    const setDraft = (buttonId, draft) => setDrafts((prev) => {
        const ids = new Set(buttons.map((b) => b.id));
        const next = Object.fromEntries(Object.entries(prev).filter(([id]) => ids.has(id) && id !== buttonId));
        return draft ? { ...next, [buttonId]: draft } : next;
    });

    // The first button with a given title owns its row; a duplicate title would trigger the same reply.
    const rows = [];
    const seen = new Set();
    buttons.forEach((btn) => {
        const key = btn.type === "custom" ? keywordKey(btn.text) : null;
        if (!key || seen.has(key)) return;
        seen.add(key);
        rows.push({ btn, key });
    });

    const configFor = (key) => configs?.[key] || { key, enabled: false, message: "", default_message: "", updated_at: null };
    const isDirty = (draft, config) => !!draft && (draft.enabled !== !!config.enabled || draft.message.trim() !== (config.message || ""));
    const pending = () => rows
        .map(({ btn, key }) => ({ btn, key, draft: drafts[btn.id] }))
        .filter(({ key, draft }) => isDirty(draft, configFor(key)));

    useImperativeHandle(ref, () => ({
        // First problem that would stop an edited reply from saving, or null.
        validate: () => {
            for (const { btn, draft } of pending()) {
                const title = btn.text.trim();
                if (normalizeKeyword(title).length > MAX_KEYWORD_LENGTH) return `Button "${title}" is longer than ${MAX_KEYWORD_LENGTH} characters, so it can't have an auto-reply.`;
                if (draft.enabled && !draft.message.trim()) return `Enter the auto-reply message for "${title}" before turning it on.`;
            }
            return null;
        },
        // Saves every edited reply; resolves to the number saved, rejects if any save fails.
        saveAll: async () => {
            const items = pending();
            const results = await Promise.allSettled(items.map(({ btn, key, draft }) =>
                saveKeywordAutoReply(key, { keyword: normalizeKeyword(btn.text), enabled: draft.enabled, message: draft.message })));
            const saved = Object.fromEntries(results.flatMap((r, i) => (r.status === "fulfilled" ? [[items[i].key, r.value]] : [])));
            setLoaded((prev) => ({ ...prev, configs: { ...prev.configs, ...saved } }));
            const failed = results.findIndex((r) => r.status === "rejected");
            if (failed !== -1) throw new Error(apiErrorMessage(results[failed].reason, `Could not save the "${items[failed].btn.text.trim()}" auto-reply`));
            return items.length;
        },
    }));

    return (
        <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 font-display"><FiCornerUpLeft size={13} /> Button Auto-Replies</h4>
                {selected && <span className="text-[10px] text-slate-400">Saved for {selected.display_name} · used by every template</span>}
            </div>

            {!selected ? (
                <p className="text-xs text-slate-500">Select a WhatsApp business number to configure button auto-replies.</p>
            ) : error && !configs ? (
                <p className="text-xs text-rose-600">{error}</p>
            ) : rows.length === 0 ? (
                <p className="text-[11px] text-slate-400">Add a Custom (quick reply) button with a title to set its auto-reply.</p>
            ) : !configs ? (
                <div className="space-y-2 animate-pulse">
                    {rows.map(({ btn }) => <div key={btn.id} className="h-32 bg-slate-100 rounded-xl" />)}
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map(({ btn, key }) => {
                        const config = configFor(key);
                        const draft = drafts[btn.id];
                        const form = draft || { enabled: !!config.enabled, message: config.message || "" };
                        const dirty = isDirty(draft, config);
                        return (
                            <KeywordRow
                                key={btn.id}
                                title={btn.text.trim()}
                                config={config}
                                form={form}
                                dirty={dirty}
                                onChange={(next) => setDraft(btn.id, next)}
                                onRevert={() => setDraft(btn.id, null)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
});

export default KeywordAutoRepliesCard;
