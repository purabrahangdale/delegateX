import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    FiPlus, FiEdit2, FiActivity, FiPower, FiTrash2, FiStar, FiX, FiCheckCircle, FiAlertCircle, FiLoader, FiLink, FiArchive, FiHelpCircle,
} from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useWhatsAppNumber, useNumberSwitchGuard } from "../context/WhatsAppNumberContext";
import { connectionDot } from "./numberStatus";
import {
    apiErrorMessage, createWhatsAppNumber, updateWhatsAppNumber, testWhatsAppNumber, verifyWhatsAppNumber, activateWhatsAppNumber,
    deactivateWhatsAppNumber, setDefaultWhatsAppNumber, removeWhatsAppNumber, getUnassignedLegacyRecords, assignLegacyRecordsToNumber,
} from "../services/whatsappApi";

const fmt = (iso) => (iso ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString() : null);
const inputCls = "w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block";

export function ConnectionBadge({ number }) {
    const status = number?.connection?.status || "unverified";
    const styles = {
        connected: "text-emerald-700 bg-emerald-50 border-emerald-200",
        error: "text-rose-700 bg-rose-50 border-rose-200",
        unverified: "text-amber-700 bg-amber-50 border-amber-200",
    };
    const label = { connected: "Connected", error: "Disconnected", unverified: "Not verified" }[status] || status;
    return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${styles[status] || styles.unverified}`}>{label}</span>;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onCancel }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 font-display">{title}</h3>
                <div className="text-xs text-slate-600 leading-relaxed">{message}</div>
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
                    <button type="button" onClick={onConfirm} disabled={busy}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50 ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#25D366] hover:bg-emerald-600"}`}>
                        {busy ? "Working..." : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

const EMPTY_FORM = {
    display_name: "", phone_number: "", purpose: "", business_portfolio_id: "", waba_id: "", waba_name: "",
    phone_number_id: "", access_token: "", copy_token_from: "", graph_api_version: "", app_id: "", app_secret: "", allowed_users: "",
};

function validate(form, isEdit, tokenOk) {
    const errors = {};
    if (!form.display_name.trim()) errors.display_name = "Display name is required.";
    if (!form.phone_number.trim()) errors.phone_number = "Business phone number is required.";
    else if (!/^\+?[\d\s\-()]{8,20}$/.test(form.phone_number.trim())) errors.phone_number = "Include the country code, e.g. +91 98765 43210.";
    if (!/^\d{5,25}$/.test(form.waba_id.trim())) errors.waba_id = "Numeric WABA ID from WhatsApp Manager.";
    if (!/^\d{5,25}$/.test(form.phone_number_id.trim())) errors.phone_number_id = "Numeric Phone Number ID from WhatsApp Manager → API Setup.";
    if (form.business_portfolio_id.trim() && !/^\d{5,25}$/.test(form.business_portfolio_id.trim())) errors.business_portfolio_id = "Portfolio ID must be numeric.";
    if (form.app_id.trim() && !/^\d{5,25}$/.test(form.app_id.trim())) errors.app_id = "Meta App ID must be numeric.";
    if (form.graph_api_version.trim() && !/^v?\d{1,3}\.\d{1,2}$/.test(form.graph_api_version.trim())) errors.graph_api_version = "Use a version like v22.0.";
    if (!isEdit && !form.access_token.trim() && !form.copy_token_from) errors.access_token = "Access token is required (or reuse the token of another number).";
    if (isEdit && !tokenOk && !form.access_token.trim()) errors.access_token = "This number has no usable token — enter one.";
    return errors;
}

const formFromNumber = (number, defaultVersion) => (number ? {
    ...EMPTY_FORM,
    display_name: number.display_name || "", phone_number: number.phone_number || "", purpose: number.purpose || "",
    business_portfolio_id: number.business_portfolio_id || "", waba_id: number.waba_id || "", waba_name: number.waba_name || "",
    phone_number_id: number.phone_number_id || "", graph_api_version: number.graph_api_version || "", app_id: number.app_id || "",
    allowed_users: (number.allowed_users || []).join(", "),
} : { ...EMPTY_FORM, graph_api_version: defaultVersion || "v22.0" });

const VERIFY_STATUS = {
    verified: { label: "Verification successful", cls: "bg-emerald-50 border-emerald-100 text-emerald-800" },
    failed: { label: "Verification failed", cls: "bg-rose-50 border-rose-100 text-rose-700" },
    invalid_credentials: { label: "Verification failed — invalid credentials", cls: "bg-rose-50 border-rose-100 text-rose-700" },
    incomplete: { label: "Configuration incomplete", cls: "bg-amber-50 border-amber-100 text-amber-800" },
    duplicate: { label: "Already configured", cls: "bg-amber-50 border-amber-100 text-amber-800" },
    permission: { label: "Permission issue", cls: "bg-rose-50 border-rose-100 text-rose-700" },
    inaccessible: { label: "Number or account inaccessible", cls: "bg-rose-50 border-rose-100 text-rose-700" },
    network: { label: "Network or Meta API error", cls: "bg-rose-50 border-rose-100 text-rose-700" },
};

/** Result of the pre-save Meta Graph API verification, exactly as the backend reported it. */
function VerificationResult({ result, stale }) {
    const status = VERIFY_STATUS[result.status] || VERIFY_STATUS.failed;
    return (
        <div className={`p-3 rounded-xl border text-[11px] space-y-2 ${status.cls}`}>
            <div className="flex items-start gap-2">
                {result.ok ? <FiCheckCircle className="mt-0.5 shrink-0" /> : <FiAlertCircle className="mt-0.5 shrink-0" />}
                <div className="min-w-0">
                    <p className="font-bold">{status.label}{stale ? " — fields changed since, verify again" : ""}</p>
                    <p className="break-words">{result.message}</p>
                </div>
            </div>
            {result.checks?.length > 0 && (
                <ul className="space-y-1 pl-5">
                    {result.checks.map((c) => (
                        <li key={c.key} className="flex items-start gap-1.5 text-slate-700">
                            {c.ok === true ? <FiCheckCircle size={11} className="mt-0.5 shrink-0 text-emerald-600" />
                                : c.ok === false ? <FiAlertCircle size={11} className={`mt-0.5 shrink-0 ${c.required ? "text-rose-600" : "text-amber-600"}`} />
                                    : <FiHelpCircle size={11} className="mt-0.5 shrink-0 text-slate-400" />}
                            <span className="break-words"><strong>{c.label}:</strong> {c.detail}{!c.required ? " (informational)" : ""}</span>
                        </li>
                    ))}
                </ul>
            )}
            {result.ok && result.same_waba_numbers?.length > 0 && (
                <p className="text-slate-600">Same WABA as {result.same_waba_numbers.join(", ")} — message templates are shared with {result.same_waba_numbers.length > 1 ? "those numbers" : "that number"}.</p>
            )}
            {result.checks?.length > 0 && <p className="text-[10px] text-slate-500">Sending and receiving messages are not tested by this check.</p>}
        </div>
    );
}

/** Add / edit form. Mounted fresh (keyed) each time it opens, so it always starts from the saved values. */
function NumberFormModal({ number, numbers, purposes, defaultVersion, callbackUrl, onClose, onSaved }) {
    const { showToast } = useToast();
    const isEdit = !!number;
    const [initial, setInitial] = useState(() => formFromNumber(number, defaultVersion));
    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [verification, setVerification] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(() => !!(number && (number.app_id || number.app_secret_configured || (number.allowed_users || []).length)));

    const dirty = JSON.stringify(form) !== JSON.stringify(initial);
    useNumberSwitchGuard(dirty, "The WhatsApp number form has unsaved changes.");

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
    const version = (form.graph_api_version.trim() || defaultVersion || "v22.0").replace(/^(?!v)/, "v");
    const graphUrl = `https://graph.facebook.com/${version}/${form.phone_number_id.trim() || "{phone-number-id}"}`;
    const tokenSources = numbers.filter((n) => n.id !== number?.id && n.token_configured);
    const sameWaba = tokenSources.filter((n) => n.waba_id && n.waba_id === form.waba_id.trim());
    const purposeOptions = Array.from(new Set([...(purposes || []), form.purpose].filter(Boolean)));

    // Values the Meta verification depends on; changing any of them makes a previous result stale.
    const verifyKey = JSON.stringify([form.phone_number.trim(), form.phone_number_id.trim(), form.waba_id.trim(),
        form.business_portfolio_id.trim(), form.access_token.trim(), form.copy_token_from, version]);
    const verificationStale = !!verification && verification.key !== verifyKey;
    const verifiedOk = !!verification?.result?.ok && !verificationStale;

    const checkForm = () => {
        const errs = validate(form, isEdit, number?.token_configured);
        setErrors(errs);
        setServerError(null);
        return Object.keys(errs).length === 0;
    };

    const buildPayload = () => {
        const payload = {
            display_name: form.display_name.trim(), phone_number: form.phone_number.trim(), purpose: form.purpose.trim(),
            business_portfolio_id: form.business_portfolio_id.trim(), waba_id: form.waba_id.trim(), waba_name: form.waba_name.trim(),
            phone_number_id: form.phone_number_id.trim(), graph_api_version: version, app_id: form.app_id.trim(),
            allowed_users: form.allowed_users.split(/[,\s]+/).map((u) => u.trim()).filter(Boolean),
        };
        if (form.access_token.trim()) payload.access_token = form.access_token.trim();
        else if (!isEdit && form.copy_token_from) payload.copy_token_from = form.copy_token_from;
        if (form.app_secret.trim()) payload.app_secret = form.app_secret.trim();
        return payload;
    };

    const verify = async () => {
        if (verifying || saving || !checkForm()) return;
        const key = verifyKey;
        setVerifying(true);
        try {
            const result = await verifyWhatsAppNumber({ ...buildPayload(), number_id: number?.id || null });
            setVerification({ key, result });
        } catch (err) {
            setVerification(null);
            setServerError(apiErrorMessage(err, "Could not verify the connection"));
        } finally {
            setVerifying(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (saving || verifying || !checkForm()) return;
        if (!isEdit && !verifiedOk) {
            setServerError("Verify the connection with Meta before saving this number.");
            return;
        }
        const payload = buildPayload();
        setSaving(true);
        try {
            const res = isEdit ? await updateWhatsAppNumber(number.id, payload) : await createWhatsAppNumber(payload);
            showToast(isEdit ? "WhatsApp number updated." : "WhatsApp number verified and saved.", "success");
            setInitial(form);
            onSaved(res.number);
        } catch (err) {
            const failed = err?.response?.data?.detail?.verification;
            if (failed) setVerification({ key: verifyKey, result: failed });
            setServerError(apiErrorMessage(err, "Could not save the number"));
        } finally {
            setSaving(false);
        }
    };

    const field = (key, label, { mono, ...props } = {}) => (
        <div>
            <label className={labelCls}>{label}</label>
            <input value={form[key]} onChange={set(key)} className={`${inputCls} ${errors[key] ? "border-rose-300" : ""} ${mono ? "font-mono" : ""}`} {...props} />
            {errors[key] && <p className="text-[10px] text-rose-600 mt-1">{errors[key]}</p>}
        </div>
    );

    const close = () => {
        if (dirty && !window.confirm("Discard unsaved changes to this number?")) return;
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-fade-in">
            <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full my-6">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 font-display">{isEdit ? `Edit ${number.display_name}` : "Add WhatsApp Business Number"}</h3>
                    <button type="button" onClick={close} className="text-slate-400 hover:text-slate-700 cursor-pointer"><FiX size={16} /></button>
                </div>

                <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    <section className="space-y-3">
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Basic details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {field("display_name", "Display name *", { placeholder: "e.g. Customer Support" })}
                            {field("phone_number", "WhatsApp business phone number *", { placeholder: "+91 98765 43210", mono: true })}
                            <div className="md:col-span-2">
                                <label className={labelCls}>Business purpose</label>
                                <input list="wa-number-purposes" value={form.purpose} onChange={set("purpose")} className={inputCls} placeholder="Marketing, Customer Support, Sales…" />
                                <datalist id="wa-number-purposes">{purposeOptions.map((p) => <option key={p} value={p} />)}</datalist>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Meta account details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {field("business_portfolio_id", "Meta Business Portfolio ID", { placeholder: "Optional", mono: true })}
                            {field("waba_id", "WhatsApp Business Account ID (WABA) *", { placeholder: "e.g. 102938475610293", mono: true })}
                            {field("phone_number_id", "WhatsApp Phone Number ID *", { placeholder: "e.g. 109876543210987", mono: true })}
                            {field("waba_name", "WABA / business name", { placeholder: "Optional — shown in the selector" })}
                            <div className="md:col-span-2">
                                <label className={labelCls}>Access token / System User Token {isEdit ? "" : "*"}</label>
                                {isEdit && number?.token_source === "env" ? (
                                    <p className="text-[11px] text-slate-500 mb-1.5">Currently read from the server environment (META_WHATSAPP_API_TOKEN). Enter a token to store it encrypted for this number instead.</p>
                                ) : null}
                                <input type="password" autoComplete="new-password" value={form.access_token} onChange={set("access_token")}
                                    className={`${inputCls} font-mono ${errors.access_token ? "border-rose-300" : ""}`}
                                    placeholder={isEdit && number?.token_configured ? `Leave blank to keep the current token (${number.token_hint})` : "EAAG…"} />
                                {!isEdit && !form.access_token && tokenSources.length > 0 && (
                                    <div className="mt-2">
                                        <label className="text-[10px] text-slate-500">…or reuse the stored token of another number (same System User){sameWaba.length ? " — recommended for numbers in the same WABA" : ""}:</label>
                                        <select value={form.copy_token_from} onChange={set("copy_token_from")} className={`${inputCls} mt-1`}>
                                            <option value="">Do not reuse</option>
                                            {(sameWaba.length ? sameWaba : tokenSources).map((n) => <option key={n.id} value={n.id}>{n.display_name} ({n.phone_number || n.phone_number_id})</option>)}
                                        </select>
                                    </div>
                                )}
                                {errors.access_token && <p className="text-[10px] text-rose-600 mt-1">{errors.access_token}</p>}
                                <p className="text-[10px] text-slate-400 mt-1">Stored encrypted on the server. It is never shown again or sent back to the browser.</p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Integration details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {field("graph_api_version", "Meta Graph API version", { placeholder: defaultVersion || "v22.0", mono: true })}
                            <div>
                                <label className={labelCls}>Graph API URL (generated)</label>
                                <div className="px-3.5 py-2.5 text-[11px] bg-slate-50 border border-slate-100 rounded-xl font-mono text-slate-600 break-all">{graphUrl}</div>
                            </div>
                            <div>
                                <label className={labelCls}>Webhook configuration</label>
                                <div className="px-3.5 py-2.5 text-[11px] bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
                                    {isEdit && number?.connection?.webhook_subscribed === true && <span className="text-emerald-700 font-semibold">App subscribed to this WABA. </span>}
                                    {isEdit && number?.connection?.webhook_subscribed === false && <span className="text-rose-700 font-semibold">No app subscribed to this WABA. </span>}
                                    {isEdit && number?.webhook?.last_event_at
                                        ? `Last event received ${fmt(number.webhook.last_event_at)}.`
                                        : "Uses the shared callback URL below; events are routed by phone number ID."}
                                    {callbackUrl && <span className="block font-mono text-[10px] text-slate-500 break-all mt-1">{callbackUrl}</span>}
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Connection status</label>
                                <div className="px-3.5 py-2.5 text-[11px] bg-slate-50 border border-slate-100 rounded-xl text-slate-600 flex items-center gap-2">
                                    {isEdit ? <><ConnectionBadge number={number} /> <span className="truncate">{number.connection?.message}</span></>
                                        : verifiedOk ? <span className="text-emerald-700 font-semibold">Verified with Meta — ready to save.</span>
                                            : "Verify the connection before saving."}
                                </div>
                            </div>
                        </div>

                        <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
                            {showAdvanced ? "Hide" : "Show"} advanced options
                        </button>
                        {showAdvanced && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {field("app_id", "Meta App ID (only if different app)", { placeholder: "Defaults to META_APP_ID", mono: true })}
                                <div>
                                    <label className={labelCls}>Meta App Secret (only if different app)</label>
                                    <input type="password" autoComplete="new-password" value={form.app_secret} onChange={set("app_secret")} className={`${inputCls} font-mono`}
                                        placeholder={number?.app_secret_configured ? "Configured — leave blank to keep" : "Defaults to META_APP_SECRET"} />
                                    <p className="text-[10px] text-slate-400 mt-1">Needed only when this WABA's webhooks come from a different Meta app; used to verify their signatures.</p>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Restrict access to users (emails)</label>
                                    <input value={form.allowed_users} onChange={set("allowed_users")} className={inputCls} placeholder="Leave empty to allow every WhatsApp user. Separate emails with commas." />
                                </div>
                            </div>
                        )}
                    </section>

                    {verification && <VerificationResult result={verification.result} stale={verificationStale} />}

                    {serverError && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-[11px] text-rose-700">
                            <FiAlertCircle className="mt-0.5 shrink-0" /> <span>{serverError}</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
                    <button type="button" onClick={close} className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
                    <button type="button" onClick={verify} disabled={verifying || saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                        {verifying ? <FiLoader size={13} className="animate-spin" /> : <FiActivity size={13} />} {verifying ? "Verifying..." : "Verify connection"}
                    </button>
                    <button type="submit" disabled={saving || verifying || (!isEdit && !verifiedOk)}
                        title={!isEdit && !verifiedOk ? "Verify the connection with Meta first" : undefined} className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50">
                        {saving ? <FiLoader size={13} className="animate-spin" /> : <FiCheckCircle size={13} />} {saving ? "Saving..." : isEdit ? "Save changes" : "Save number"}
                    </button>
                </div>
            </form>
        </div>
    );
}

function LegacyRecordsBanner({ selected, onAssigned }) {
    const { showToast } = useToast();
    const [counts, setCounts] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getUnassignedLegacyRecords().then(setCounts).catch(() => setCounts(null));
    }, []);

    if (!counts || !counts.total || !selected) return null;
    const parts = [
        [counts.whatsapp_messages, "messages"], [counts.whatsapp_campaigns, "campaigns"], [counts.whatsapp_templates, "templates"],
        [counts.whatsapp_automation_runs, "automation runs"], [counts.automation_logs, "automation logs"], [counts.chat_access_logs, "chat access logs"],
        [counts.whatsapp_campaign_recipients, "send jobs"],
    ].filter(([n]) => n > 0).map(([n, l]) => `${n} ${l}`);

    const assign = async () => {
        setBusy(true);
        try {
            await assignLegacyRecordsToNumber(selected.id);
            showToast(`Legacy records linked to ${selected.display_name}.`, "success");
            setCounts(await getUnassignedLegacyRecords());
            onAssigned?.();
        } catch (e) {
            showToast(apiErrorMessage(e), "error");
        } finally {
            setBusy(false);
            setConfirming(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-900">
            <FiArchive className="shrink-0 text-amber-600" size={16} />
            <p className="flex-1">
                <strong>{counts.total} records</strong> created before multi-number support could not be linked to a number automatically ({parts.join(", ")}).
                They are hidden from number-specific pages until you assign them.
            </p>
            <button type="button" onClick={() => setConfirming(true)} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer">
                Assign to {selected.display_name}
            </button>
            <ConfirmDialog open={confirming} busy={busy} title="Assign legacy records?"
                message={<>All {counts.total} unlinked records will be attached to <strong>{selected.display_name}</strong> ({selected.phone_number || selected.phone_number_id}). Only do this if they were sent or received through this number. This cannot be undone from the UI.</>}
                confirmLabel="Assign records" onConfirm={assign} onCancel={() => setConfirming(false)} />
        </div>
    );
}

/** "WhatsApp Business Numbers" section of the settings page. */
function WhatsAppNumberManager({ callbackUrl, editRequest }) {
    const { showToast } = useToast();
    const ctx = useWhatsAppNumber();
    const { numbers, selected, selectNumber, refresh, canManage, purposes, graphVersion } = ctx;
    const [modal, setModal] = useState({ open: false, number: null });
    const [busyId, setBusyId] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const signedIn = (() => { try { return !!localStorage.getItem("userEmail"); } catch { return false; } })();

    // "Edit configuration" from the credentials card opens this number's editor.
    useEffect(() => {
        if (!editRequest?.id) return;
        const n = numbers.find((x) => x.id === editRequest.id);
        if (n) setModal({ open: true, number: n });
    }, [editRequest]); // eslint-disable-line react-hooks/exhaustive-deps

    const sorted = useMemo(() => [...numbers].sort((a, b) => (b.is_default - a.is_default) || (b.is_active - a.is_active)), [numbers]);

    const act = async (id, fn, success) => {
        setBusyId(id);
        try {
            const res = await fn(id);
            if (success) showToast(typeof success === "function" ? success(res) : success, "success");
            await refresh();
            return res;
        } catch (e) {
            showToast(apiErrorMessage(e), "error");
            return null;
        } finally {
            setBusyId(null);
        }
    };

    const test = (n) => act(n.id, testWhatsAppNumber).then((res) => {
        if (!res) return;
        if (res.ok) showToast(`${n.display_name}: connected to Meta Graph API.`, "success");
        else showToast(`${n.display_name}: ${res.number?.connection?.message || "connection test failed"}`, "error");
    });

    const askToggle = (n) => setConfirm(n.is_active ? {
        title: `Deactivate ${n.display_name}?`, danger: true, confirmLabel: "Deactivate",
        message: <>No new messages, campaigns or automations will be sent from <strong>{n.phone_number || n.phone_number_id}</strong>. Queued messages for this number will fail instead of being sent from another number. History stays available.{n.is_default ? " It is the default number — choose a new default afterwards." : ""}</>,
        run: () => act(n.id, deactivateWhatsAppNumber, `${n.display_name} deactivated.`),
    } : { title: `Activate ${n.display_name}?`, confirmLabel: "Activate", message: "The number can be used for sending again.", run: () => act(n.id, activateWhatsAppNumber, `${n.display_name} activated.`) });

    const askRemove = (n) => setConfirm({
        title: `Remove ${n.display_name}?`, danger: true, confirmLabel: "Remove configuration",
        message: <>The configuration for <strong>{n.phone_number || n.phone_number_id}</strong> (Phone Number ID {n.phone_number_id}) will be removed and its credentials can no longer be used. Its conversations, campaigns and reports are kept and are <strong>not</strong> moved to another number. Adding the same Phone Number ID again restores them.</>,
        run: () => act(n.id, removeWhatsAppNumber, `${n.display_name} removed.`),
    });

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">WhatsApp Business Numbers</h3>
                    <p className="text-[10px] text-slate-400">Numbers can belong to the same WABA (shared templates) or to different WABAs / Business Portfolios.</p>
                </div>
                {/* Without an ERP sign-in no user identity reaches the backend, so it cannot recognise an administrator:
                    send the user to sign in (and back here) instead of showing a dead button. */}
                {/* <button type="button" onClick={() => (signedIn ? setModal({ open: true, number: null }) : navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`))}
                    disabled={signedIn && !canManage}
                    title={canManage ? undefined : signedIn
                        ? "Only WhatsApp administrators can add business numbers. Sign in with an administrator account."
                        : "You are not signed in. Sign in with an administrator account to add business numbers."}
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    <FiPlus size={13} /> Add Number
                </button> */}
            </div>

            {/* {canManage && <LegacyRecordsBanner selected={selected} onAssigned={refresh} />} */}

            {sorted.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-700">No WhatsApp business numbers yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">{canManage ? "Add your first number to connect the Meta WhatsApp Cloud API." : "Ask a WhatsApp administrator to add a number."}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {sorted.map((n) => {
                        const isSelected = n.id === selected?.id;
                        const busy = busyId === n.id;
                        return (
                            <div key={n.id} className={`p-4 rounded-2xl border-2 transition ${isSelected ? "border-[#25D366] bg-emerald-50/20" : "border-slate-200/80"} ${!n.is_active ? "opacity-75" : ""}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`w-2 h-2 rounded-full ${connectionDot(n)}`}></span>
                                            <span className="text-xs font-bold text-slate-800">{n.display_name}</span>
                                            {n.is_default && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md uppercase">Default</span>}
                                            {isSelected && <span className="text-[8px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md uppercase">Selected</span>}
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase border ${n.is_active ? "text-emerald-700 bg-white border-emerald-200" : "text-slate-500 bg-slate-100 border-slate-200"}`}>{n.is_active ? "Active" : "Inactive"}</span>
                                        </div>
                                        <p className="text-sm font-mono text-slate-700 mt-1">{n.phone_number || <span className="text-slate-400 text-xs">Phone number not set</span>}</p>
                                        {n.purpose && <p className="text-[10px] text-slate-500 mt-0.5">Purpose: {n.purpose}</p>}
                                    </div>
                                    <ConnectionBadge number={n} />
                                </div>
                                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-[10px]">
                                    <dt className="text-slate-400">Phone Number ID</dt><dd className="font-mono text-slate-700 truncate">{n.phone_number_id}</dd>
                                    <dt className="text-slate-400">WABA ID</dt><dd className="font-mono text-slate-700 truncate">{n.waba_id || "—"}{n.waba_name ? ` · ${n.waba_name}` : ""}</dd>
                                    <dt className="text-slate-400">Business Portfolio</dt><dd className="font-mono text-slate-700 truncate">{n.business_portfolio_id || "—"}</dd>
                                    <dt className="text-slate-400">Token</dt><dd className="font-mono text-slate-700 truncate">{n.token_configured ? `${n.token_hint}${n.token_source === "env" ? " (env)" : ""}` : <span className="text-rose-600">missing</span>}</dd>
                                    {n.connection?.checked_at && <><dt className="text-slate-400">Last tested</dt><dd className="text-slate-700 truncate">{fmt(n.connection.checked_at)}</dd></>}
                                </dl>
                                {n.connection?.status === "error" && n.connection?.message && <p className="text-[10px] text-rose-600 mt-2 break-words">{n.connection.message}</p>}
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                                    {!isSelected && (
                                        <button type="button" onClick={() => selectNumber(n.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-900 text-white cursor-pointer">
                                            <FiLink size={10} /> Select
                                        </button>
                                    )}
                                    <button type="button" onClick={() => test(n)} disabled={busy} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                                        <FiActivity size={10} className={busy ? "animate-spin" : ""} /> Test connection
                                    </button>
                                    {canManage && (
                                        <>
                                            <button type="button" onClick={() => setModal({ open: true, number: n })} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">
                                                <FiEdit2 size={10} /> Edit
                                            </button>
                                            {!n.is_default && n.is_active && (
                                                <button type="button" onClick={() => act(n.id, setDefaultWhatsAppNumber, `${n.display_name} is now the default number.`)} disabled={busy}
                                                    className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                                                    <FiStar size={10} /> Set as default
                                                </button>
                                            )}
                                            <button type="button" onClick={() => askToggle(n)} disabled={busy} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                                                <FiPower size={10} /> {n.is_active ? "Deactivate" : "Activate"}
                                            </button>
                                            <button type="button" onClick={() => askRemove(n)} disabled={busy} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50">
                                                <FiTrash2 size={10} /> Remove
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal.open && (
                <NumberFormModal key={modal.number?.id || "new"} number={modal.number} numbers={numbers} purposes={purposes} defaultVersion={graphVersion}
                    callbackUrl={callbackUrl} onClose={() => setModal({ open: false, number: null })}
                    onSaved={async (saved) => {
                        setModal({ open: false, number: null });
                        await refresh();
                        if (saved && !selected) selectNumber(saved.id);
                    }} />
            )}
            <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} confirmLabel={confirm?.confirmLabel}
                busy={!!busyId} onCancel={() => setConfirm(null)} onConfirm={async () => { await confirm.run(); setConfirm(null); }} />
        </div>
    );
}

export default WhatsAppNumberManager;
