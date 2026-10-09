import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import TemplateSelector from "../components/TemplateSelector";
import VariableMappingEditor from "../components/VariableMappingEditor";
import { suggestMapping, unmappedSlots } from "../components/variableMapping";
import {
    apiErrorMessage, getSendableTemplates, getWhatsAppSettings, previewCampaign, createCampaign,
    listCampaigns, getCampaign, getCampaignRecipients, launchCampaign, cancelCampaign, pauseCampaign,
    resumeCampaign, retryFailedCampaignRecipients, deleteDraftCampaign, isEventForActiveNumber, contactsStorageKey,
} from "../services/whatsappApi";
import { useNumberSwitchGuard, useWhatsAppNumber } from "../context/WhatsAppNumberContext";
import { useToast } from "../../context/ToastContext";
import { useWebSockets } from "../../context/WebSocketContext";
import {
    FiSend, FiPlus, FiX, FiChevronLeft, FiChevronRight, FiUsers, FiFileText, FiSliders, FiEye,
    FiCalendar, FiCheckCircle, FiAlertTriangle, FiRefreshCw, FiPause, FiPlay, FiSlash, FiRotateCcw,
    FiInfo, FiTrash2, FiClock, FiPhone,
} from "react-icons/fi";

const getSavedContacts = () => {
    try {
        // Contacts of the selected business number only.
        const parsed = JSON.parse(localStorage.getItem(contactsStorageKey()) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const newRequestId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const CAMPAIGN_STATUS = {
    draft: { label: "Draft", cls: "text-slate-600 bg-slate-50 border-slate-200" },
    scheduled: { label: "Scheduled", cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    queued: { label: "Queued", cls: "text-amber-700 bg-amber-50 border-amber-200" },
    processing: { label: "Sending", cls: "text-blue-700 bg-blue-50 border-blue-200" },
    paused: { label: "Paused", cls: "text-orange-700 bg-orange-50 border-orange-200" },
    completed: { label: "Completed", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    partially_failed: { label: "Partially failed", cls: "text-rose-700 bg-rose-50 border-rose-200" },
    failed: { label: "Failed", cls: "text-rose-700 bg-rose-50 border-rose-200" },
    cancelled: { label: "Cancelled", cls: "text-slate-500 bg-slate-100 border-slate-200" },
};

const RECIPIENT_STATE = {
    draft: { label: "Not launched", cls: "text-slate-500 bg-slate-50 border-slate-200" },
    scheduled: { label: "Scheduled", cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    queued: { label: "Queued", cls: "text-amber-700 bg-amber-50 border-amber-200" },
    paused: { label: "Paused", cls: "text-orange-700 bg-orange-50 border-orange-200" },
    sending: { label: "Sending", cls: "text-blue-700 bg-blue-50 border-blue-200" },
    accepted: { label: "Accepted by Meta", cls: "text-sky-700 bg-sky-50 border-sky-200", help: "Meta accepted the request. Waiting for a 'sent' / 'delivered' webhook." },
    sent: { label: "Sent", cls: "text-teal-700 bg-teal-50 border-teal-200" },
    delivered: { label: "Delivered", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    read: { label: "Read", cls: "text-emerald-800 bg-emerald-100 border-emerald-300" },
    failed: { label: "Failed", cls: "text-rose-700 bg-rose-50 border-rose-200" },
    unknown: { label: "Outcome unknown", cls: "text-purple-700 bg-purple-50 border-purple-200", help: "The send was interrupted after it may have reached Meta. It is not retried automatically to avoid a duplicate message." },
    invalid: { label: "Invalid", cls: "text-rose-600 bg-white border-rose-200" },
    skipped: { label: "Skipped", cls: "text-slate-600 bg-white border-slate-300" },
    cancelled: { label: "Cancelled", cls: "text-slate-500 bg-slate-100 border-slate-200" },
};

const ACTIVE_CAMPAIGN = new Set(["scheduled", "queued", "processing", "paused"]);

const AUDIENCE_FIELDS = {
    contacts: [
        { value: "name", label: "Contact name" }, { value: "first_name", label: "First name" },
        { value: "phone", label: "Phone" }, { value: "email", label: "Email" }, { value: "category", label: "Category" },
    ],
    crm_leads: [
        { value: "name", label: "Lead name" }, { value: "first_name", label: "First name" }, { value: "phone", label: "Phone" },
        { value: "email", label: "Email" }, { value: "project_type", label: "Project type" },
        { value: "assigned_to", label: "Assigned to" }, { value: "status", label: "Lead status" },
    ],
    employees: [
        { value: "name", label: "Employee name" }, { value: "first_name", label: "First name" }, { value: "phone", label: "Phone" },
        { value: "email", label: "Email" }, { value: "department", label: "Department" }, { value: "role", label: "Role" },
    ],
};

const fmt = (iso) => (iso ? new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).toLocaleString() : "—");
const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);

function Badge({ map, value }) {
    const s = map[value] || { label: value, cls: "text-slate-600 bg-slate-50 border-slate-200" };
    return <span title={s.help || ""} className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

// ═══════════════════════════════════════════════════════════════════
// CAMPAIGN BUILDER
// ═══════════════════════════════════════════════════════════════════

const STEPS = [
    { key: "basics", label: "Campaign", icon: FiSend },
    { key: "template", label: "Template", icon: FiFileText },
    { key: "recipients", label: "Recipients", icon: FiUsers },
    { key: "variables", label: "Variables", icon: FiSliders },
    { key: "preview", label: "Preview", icon: FiEye },
    { key: "launch", label: "Schedule & Launch", icon: FiCalendar },
];

function CampaignBuilder({ onClose, onCreated }) {
    const { showToast } = useToast();
    const numberCtx = useWhatsAppNumber();
    const [step, setStep] = useState(0);
    const [name, setName] = useState("");
    const [purpose, setPurpose] = useState("");
    const [sender, setSender] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [templatesError, setTemplatesError] = useState(null);
    const [template, setTemplate] = useState(null);
    const [audienceSource, setAudienceSource] = useState("contacts");
    const [contacts] = useState(getSavedContacts);
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState(() => new Set(getSavedContacts().map((c) => String(c.id ?? c.phone))));
    const [mapping, setMapping] = useState({});
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [sendMode, setSendMode] = useState("now");
    const [scheduleAt, setScheduleAt] = useState("");
    const [consent, setConsent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const requestId = useRef(newRequestId());
    // A campaign draft belongs to the number it was started on — switching numbers asks first.
    useNumberSwitchGuard(step > 0 || !!name.trim(), "A campaign is being created for the current WhatsApp number.");
    const [nowMs, setNowMs] = useState(() => Date.now());
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    useEffect(() => {
        getSendableTemplates()
            .then(setTemplates)
            .catch((e) => setTemplatesError(apiErrorMessage(e)))
            .finally(() => setTemplatesLoading(false));
        getWhatsAppSettings().then((s) => setSender(s?.effective || null));
    }, []);

    const categories = useMemo(() => Array.from(new Set(contacts.map((c) => c.category).filter(Boolean))), [contacts]);
    const visibleContacts = useMemo(
        () => contacts.filter((c) => categoryFilter === "all" || c.category === categoryFilter),
        [contacts, categoryFilter]
    );
    const chosenContacts = useMemo(
        () => contacts.filter((c) => selectedIds.has(String(c.id ?? c.phone))),
        [contacts, selectedIds]
    );

    const fieldOptions = useMemo(() => {
        const base = AUDIENCE_FIELDS[audienceSource];
        if (audienceSource !== "contacts") return base;
        const extra = new Set();
        chosenContacts.forEach((c) => Object.entries(c).forEach(([k, v]) => {
            if (["string", "number"].includes(typeof v) && !["id", "status", "createdAt", "created_at"].includes(k)) extra.add(k);
        }));
        const known = new Set(base.map((b) => b.value));
        return [...base, ...[...extra].filter((k) => !known.has(k)).map((k) => ({ value: k, label: k }))];
    }, [audienceSource, chosenContacts]);

    const recipientsPayload = useMemo(
        () => (audienceSource === "contacts"
            ? chosenContacts.map((c) => {
                const rest = Object.fromEntries(Object.entries(c).filter(([k]) => k !== "id" && k !== "status"));
                return { ...rest, opt_in: rest.opt_in ?? (c.status === "DND" ? false : undefined) };
            })
            : null),
        [audienceSource, chosenContacts]
    );

    const selectTemplate = (t) => {
        setTemplate(t);
        setMapping(suggestMapping(t.slots, AUDIENCE_FIELDS[audienceSource], {}));
        setPreview(null);
    };

    useEffect(() => {
        if (template) setMapping((m) => suggestMapping(template.slots, fieldOptions, m));
        setPreview(null);
    }, [audienceSource]); // eslint-disable-line react-hooks/exhaustive-deps

    const runPreview = useCallback(async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            setPreview(await previewCampaign({
                template_id: template._id, variable_mapping: mapping, audience_source: audienceSource, recipients: recipientsPayload,
            }));
        } catch (e) {
            setPreviewError(apiErrorMessage(e));
        } finally {
            setPreviewLoading(false);
        }
    }, [template, mapping, audienceSource, recipientsPayload]);

    useEffect(() => {
        if (STEPS[step].key === "preview" && !preview && !previewLoading) runPreview();
    }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

    const missingSlots = template ? unmappedSlots(template.slots, mapping) : [];
    const stepError = (() => {
        switch (STEPS[step].key) {
            case "basics": return !name.trim() ? "Enter a campaign name." : null;
            case "template": return !template ? "Select an approved template." : null;
            case "recipients":
                if (audienceSource === "contacts" && !chosenContacts.length) return "Select at least one contact.";
                return null;
            case "variables": return missingSlots.length ? `Map all variables (${missingSlots.length} missing).` : null;
            case "preview":
                if (previewLoading) return "Validating recipients...";
                if (previewError) return previewError;
                if (preview && preview.eligible === 0) return "No eligible recipients — fix the issues listed above.";
                return !preview ? "Run validation first." : null;
            default: return null;
        }
    })();

    const scheduledIso = sendMode === "later" && scheduleAt ? new Date(scheduleAt).toISOString() : null;
    useEffect(() => {
        const t = setInterval(() => setNowMs(Date.now()), 30000);
        return () => clearInterval(t);
    }, []);
    const scheduleInvalid = sendMode === "later" && (!scheduleAt || new Date(scheduleAt).getTime() < nowMs + 60000);

    const submit = async (launch) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const created = await createCampaign({
                name: name.trim(), purpose: purpose.trim(), template_id: template._id, variable_mapping: mapping,
                audience_source: audienceSource,
                audience_label: audienceSource === "contacts" ? (categoryFilter === "all" ? "WhatsApp contacts" : `Contacts: ${categoryFilter}`) : audienceSource,
                recipients: recipientsPayload, timezone, client_request_id: requestId.current,
            });
            let result = created;
            if (launch) {
                result = await launchCampaign(created._id, { confirm_consent: consent, scheduled_at: scheduledIso, timezone });
                showToast(result.status === "scheduled" ? `Campaign scheduled for ${fmt(result.schedule?.scheduled_at)}` : "Campaign queued — messages are being sent in the background.", "success");
            } else {
                showToast("Campaign saved as draft.", "success");
            }
            onCreated(result);
        } catch (e) {
            showToast(apiErrorMessage(e, "Could not create the campaign"), "error");
        } finally {
            setSubmitting(false);
        }
    };

    const renderPreviewBubble = (text) => (
        <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-none p-3 border border-emerald-200 shadow-2xs">
            <p className="text-[11px] whitespace-pre-wrap leading-relaxed text-slate-900">{text}</p>
        </div>
    );

    const firstContact = chosenContacts[0];
    const livePreviewText = useMemo(() => {
        if (!template) return "";
        const sample = { ...(firstContact || {}), first_name: (firstContact?.name || "").split(" ")[0] };
        const valueFor = (key) => {
            const rule = mapping[key];
            if (!rule?.value) return null;
            return rule.source === "static" ? rule.value : sample[rule.value];
        };
        const sub = (text, prefix) => (text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, p) => valueFor(`${prefix}.${p}`) || `[${p}]`);
        const comps = template.components || [];
        const header = comps.find((c) => c.type === "HEADER");
        const body = comps.find((c) => c.type === "BODY");
        const footer = comps.find((c) => c.type === "FOOTER");
        return [header?.format === "TEXT" ? sub(header.text, "header") : header ? `[${header.format}]` : null, sub(body?.text, "body"), footer?.text]
            .filter(Boolean).join("\n\n");
    }, [template, mapping, firstContact]);

    const toggleContact = (c) => {
        const id = String(c.id ?? c.phone);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setPreview(null);
    };

    const key = STEPS[step].key;

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                    <h2 className="text-sm font-bold text-slate-900 font-display">New WhatsApp Campaign</h2>
                    <p className="text-[10px] text-slate-400">Messages are sent with a Meta-approved template through the background queue.</p>
                </div>
                <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
            </div>

            {/* Stepper */}
            <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50 px-3">
                {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const state = i < step ? "done" : i === step ? "active" : "todo";
                    return (
                        <div key={s.key} className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-semibold whitespace-nowrap border-b-2 ${state === "active" ? "border-[#25D366] text-slate-900" : state === "done" ? "border-transparent text-emerald-600" : "border-transparent text-slate-400"}`}>
                            {state === "done" ? <FiCheckCircle size={12} /> : <Icon size={12} />} {i + 1}. {s.label}
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                <div className="lg:col-span-2 space-y-4">
                    {key === "basics" && (
                        <>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Campaign name *</label>
                                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. October site-visit invitations" className="mt-1 w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Purpose (internal note)</label>
                                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} placeholder="Why is this campaign being sent?" className="mt-1 w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                                <FiPhone className="text-emerald-600" />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Sender (selected WhatsApp business number)</p>
                                    {numberCtx?.selected && <p className="text-xs font-semibold text-slate-800">{numberCtx.selected.display_name} — {numberCtx.selected.phone_number}</p>}
                                    <p className="text-xs font-mono text-slate-800">{sender?.phone_number_id ? `Phone number ID ${sender.phone_number_id}` : "Not configured — see WhatsApp Settings"}</p>
                                </div>
                            </div>
                        </>
                    )}

                    {key === "template" && (
                        templatesError
                            ? <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl">{templatesError}</p>
                            : <TemplateSelector templates={templates} selectedId={template?._id} onSelect={selectTemplate} loading={templatesLoading} />
                    )}

                    {key === "recipients" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { v: "contacts", l: "WhatsApp Contacts", d: `${contacts.length} saved` },
                                    { v: "crm_leads", l: "CRM Leads", d: "All leads with a phone" },
                                    { v: "employees", l: "Employees", d: "All employees with a phone" },
                                ].map((o) => (
                                    <button key={o.v} type="button" onClick={() => { setAudienceSource(o.v); setPreview(null); }}
                                        className={`p-3 rounded-xl border-2 text-left cursor-pointer ${audienceSource === o.v ? "border-[#25D366] bg-emerald-50/30" : "border-slate-200"}`}>
                                        <p className="text-xs font-bold text-slate-800">{o.l}</p>
                                        <p className="text-[10px] text-slate-400">{o.d}</p>
                                    </button>
                                ))}
                            </div>
                            {audienceSource === "contacts" ? (
                                contacts.length === 0 ? (
                                    <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">No saved contacts. Add or import contacts on the Contacts page.</p>
                                ) : (
                                    <div className="border border-slate-200 rounded-xl">
                                        <div className="flex items-center justify-between gap-2 p-2.5 border-b border-slate-100">
                                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-2 py-1">
                                                <option value="all">All categories</option>
                                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <div className="flex gap-2 text-[10px] font-semibold">
                                                <button type="button" className="text-emerald-700 cursor-pointer" onClick={() => { setSelectedIds((p) => new Set([...p, ...visibleContacts.map((c) => String(c.id ?? c.phone))])); setPreview(null); }}>Select shown</button>
                                                <button type="button" className="text-slate-500 cursor-pointer" onClick={() => { setSelectedIds(new Set()); setPreview(null); }}>Clear</button>
                                                <span className="text-slate-400">{chosenContacts.length} selected</span>
                                            </div>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                                            {visibleContacts.map((c) => (
                                                <label key={String(c.id ?? c.phone)} className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
                                                    <input type="checkbox" checked={selectedIds.has(String(c.id ?? c.phone))} onChange={() => toggleContact(c)} />
                                                    <span className="font-semibold text-slate-800">{c.name || "—"}</span>
                                                    <span className="font-mono text-slate-500">{c.phone}</span>
                                                    {c.category && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 rounded">{c.category}</span>}
                                                    {c.status === "DND" && <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 rounded">DND</span>}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )
                            ) : (
                                <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl flex gap-2"><FiInfo className="shrink-0 mt-0.5" /> Recipients are loaded on the server from the ERP {audienceSource === "crm_leads" ? "CRM leads" : "employee"} records. You'll see exactly who is eligible in the Preview step.</p>
                            )}
                            <p className="text-[10px] text-slate-400">Numbers on the Global DND list, contacts marked as not opted in, duplicates and invalid numbers are excluded automatically.</p>
                        </div>
                    )}

                    {key === "variables" && (
                        <VariableMappingEditor slots={template?.slots} mapping={mapping} onChange={(m) => { setMapping(m); setPreview(null); }} fieldOptions={fieldOptions} />
                    )}

                    {key === "preview" && (
                        <div className="space-y-3">
                            {previewLoading && <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />}
                            {previewError && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl">{previewError}</p>}
                            {preview && (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[["Selected", preview.total, "text-slate-800"], ["Eligible", preview.eligible, "text-emerald-700"],
                                          ["Invalid", preview.invalid.length, "text-rose-600"], ["Skipped", preview.skipped.length + preview.duplicates_removed, "text-slate-600"]].map(([l, v, c]) => (
                                            <div key={l} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <p className="text-[9px] uppercase font-bold text-slate-400">{l}</p>
                                                <p className={`text-lg font-bold ${c}`}>{v}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {preview.duplicates_removed > 0 && <p className="text-[10px] text-slate-500">{preview.duplicates_removed} duplicate phone number(s) removed.</p>}
                                    {[...preview.invalid, ...preview.skipped].length > 0 && (
                                        <div className="border border-amber-200 bg-amber-50/40 rounded-xl max-h-40 overflow-y-auto">
                                            {[...preview.invalid.map((r) => ({ ...r, t: "Invalid" })), ...preview.skipped.map((r) => ({ ...r, t: "Skipped" }))].map((r, i) => (
                                                <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-[10px] border-b border-amber-100 last:border-0">
                                                    <FiAlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={11} />
                                                    <span className="font-semibold text-slate-700">{r.name || "—"}</span>
                                                    <span className="font-mono text-slate-500">{r.phone || "no phone"}</span>
                                                    <span className="text-amber-800">{r.t}: {r.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Rendered messages (first {preview.samples.length})</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {preview.samples.map((s) => (
                                            <div key={s.phone}>
                                                <p className="text-[10px] text-slate-500 mb-1">{s.name} · <span className="font-mono">+{s.phone}</span></p>
                                                {renderPreviewBubble(s.preview)}
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={runPreview} className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 cursor-pointer"><FiRefreshCw size={11} /> Re-validate</button>
                                </>
                            )}
                        </div>
                    )}

                    {key === "launch" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                {[["now", "Send now", "Queued immediately"], ["later", "Schedule", "Send at a later time"]].map(([v, l, d]) => (
                                    <button key={v} type="button" onClick={() => setSendMode(v)} className={`p-3 rounded-xl border-2 text-left cursor-pointer ${sendMode === v ? "border-[#25D366] bg-emerald-50/30" : "border-slate-200"}`}>
                                        <p className="text-xs font-bold text-slate-800">{l}</p><p className="text-[10px] text-slate-400">{d}</p>
                                    </button>
                                ))}
                            </div>
                            {sendMode === "later" && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Send at ({timezone})</label>
                                    <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="mt-1 w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl" />
                                    {scheduleInvalid && <p className="text-[10px] text-rose-600 mt-1">Choose a time at least 1 minute in the future.</p>}
                                    <p className="text-[10px] text-slate-400 mt-1">Scheduling runs on the server — you can close this page.</p>
                                </div>
                            )}
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                                <p><span className="text-slate-400">Campaign:</span> <strong>{name}</strong></p>
                                <p><span className="text-slate-400">Template:</span> <strong>{template?.name}</strong> <span className="font-mono text-[10px]">({template?.meta_template_name} · {template?.language})</span></p>
                                <p><span className="text-slate-400">Eligible recipients:</span> <strong>{preview?.eligible ?? "—"}</strong></p>
                                <p><span className="text-slate-400">When:</span> <strong>{sendMode === "now" ? "Immediately" : scheduleAt ? new Date(scheduleAt).toLocaleString() : "—"}</strong></p>
                            </div>
                            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-[11px] text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                                <span>I confirm that every recipient has opted in to receive WhatsApp messages from us, and this message complies with WhatsApp Business messaging policy.</span>
                            </label>
                        </div>
                    )}
                </div>

                {/* Live preview column */}
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Live preview {firstContact && audienceSource === "contacts" ? `· ${firstContact.name}` : ""}</p>
                    <div className="bg-[#E5DDD5] rounded-2xl p-4 min-h-[180px]">
                        {template ? renderPreviewBubble(livePreviewText) : <p className="text-[11px] text-slate-500">Select a template to see the message.</p>}
                        {template && (template.components || []).find((c) => c.type === "BUTTONS")?.buttons?.map((b, i) => (
                            <div key={i} className="mt-1.5 bg-white rounded-xl text-center text-[11px] font-semibold text-sky-700 py-1.5">{b.text || b.type}</div>
                        ))}
                    </div>
                    {audienceSource !== "contacts" && template && <p className="text-[10px] text-slate-400">Field values are filled per recipient — see the Preview step for real rendered messages.</p>}
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-100 bg-slate-50/40">
                <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="flex items-center gap-1 text-xs font-semibold text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-100 disabled:opacity-40 cursor-pointer"><FiChevronLeft /> Back</button>
                <div className="flex items-center gap-3">
                    {stepError && <span className="text-[11px] text-amber-700 hidden sm:inline">{stepError}</span>}
                    {key !== "launch" ? (
                        <button type="button" disabled={!!stepError} onClick={() => setStep(step + 1)} className="flex items-center gap-1 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-40 cursor-pointer">Next <FiChevronRight /></button>
                    ) : (
                        <>
                            <button type="button" disabled={submitting} onClick={() => submit(false)} className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl disabled:opacity-40 cursor-pointer">Save as draft</button>
                            <button type="button" disabled={submitting || !consent || scheduleInvalid} onClick={() => submit(true)} className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-40 cursor-pointer">
                                <FiSend size={12} /> {submitting ? "Working..." : sendMode === "now" ? `Launch to ${preview?.eligible ?? 0} recipients` : "Schedule campaign"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// CAMPAIGN DETAIL
// ═══════════════════════════════════════════════════════════════════

function CampaignDetail({ campaignId, onClose, onChanged, refreshSignal }) {
    const { showToast } = useToast();
    const [camp, setCamp] = useState(null);
    const [recipients, setRecipients] = useState({ recipients: [], total: 0 });
    const [stateFilter, setStateFilter] = useState("");
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const [error, setError] = useState(null);
    const [consent, setConsent] = useState(false);

    const load = useCallback(async () => {
        try {
            const [c, r] = await Promise.all([
                getCampaign(campaignId),
                getCampaignRecipients(campaignId, { state: stateFilter || undefined, search: search || undefined, limit: 500 }),
            ]);
            setCamp(c);
            setRecipients(r);
            setError(null);
        } catch (e) {
            setError(apiErrorMessage(e));
        }
    }, [campaignId, stateFilter, search]);

    useEffect(() => { load(); }, [load, refreshSignal]);
    useEffect(() => {
        const live = camp && (ACTIVE_CAMPAIGN.has(camp.status) || camp.counts?.awaiting_status > 0);
        if (!live) return undefined;
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, [camp, load]);

    const act = async (fn, okMsg) => {
        setBusy(true);
        try {
            const res = await fn();
            showToast(typeof okMsg === "function" ? okMsg(res) : okMsg, "success");
            await load();
            onChanged();
        } catch (e) {
            showToast(apiErrorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    if (error) return <div className="p-6 text-xs text-rose-600">{error}</div>;
    if (!camp) return <div className="p-6"><div className="h-40 bg-slate-100 rounded-xl animate-pulse" /></div>;
    const c = camp.counts || {};

    const metric = (label, value, cls, hint) => (
        <div className="p-3 bg-white rounded-xl border border-slate-200" title={hint || ""}>
            <p className="text-[9px] uppercase font-bold text-slate-400">{label}</p>
            <p className={`text-lg font-bold ${cls}`}>{value}</p>
        </div>
    );

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 font-display">{camp.name}</h2>
                        <Badge map={CAMPAIGN_STATUS} value={camp.status} />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        Template <strong>{camp.template?.display_name}</strong> <span className="font-mono">({camp.template?.name} · {camp.template?.language})</span> · Audience: {camp.audience?.label}
                    </p>
                    {camp.purpose && <p className="text-[11px] text-slate-400 mt-0.5">{camp.purpose}</p>}
                </div>
                <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
            </div>

            <div className="flex flex-wrap gap-2">
                {camp.status === "draft" && (
                    <>
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl px-2.5">
                            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Recipients have opted in
                        </label>
                        <button disabled={busy || !consent} onClick={() => act(() => launchCampaign(camp._id, { confirm_consent: true }), "Campaign queued")} className="flex items-center gap-1 bg-[#25D366] text-white text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-40 cursor-pointer"><FiSend size={12} /> Launch now</button>
                        <button disabled={busy} onClick={() => { if (confirm("Delete this draft campaign?")) act(() => deleteDraftCampaign(camp._id), "Draft deleted").then(onClose); }} className="flex items-center gap-1 bg-white border border-slate-200 text-rose-600 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"><FiTrash2 size={12} /> Delete draft</button>
                    </>
                )}
                {["queued", "processing"].includes(camp.status) && (
                    <button disabled={busy} onClick={() => act(() => pauseCampaign(camp._id), "Paused — unsent messages are on hold")} className="flex items-center gap-1 bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"><FiPause size={12} /> Pause</button>
                )}
                {camp.status === "paused" && (
                    <button disabled={busy} onClick={() => act(() => resumeCampaign(camp._id), "Resumed")} className="flex items-center gap-1 bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"><FiPlay size={12} /> Resume</button>
                )}
                {ACTIVE_CAMPAIGN.has(camp.status) && (
                    <button disabled={busy} onClick={() => { if (confirm("Cancel all messages that have not been sent yet? Messages already accepted by Meta cannot be recalled.")) act(() => cancelCampaign(camp._id), (r) => `Cancelled ${r.cancelled_jobs} unsent message(s)`); }} className="flex items-center gap-1 bg-white border border-rose-200 text-rose-600 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"><FiSlash size={12} /> Cancel unsent</button>
                )}
                {c.failed > 0 && !ACTIVE_CAMPAIGN.has(camp.status) && camp.status !== "cancelled" && (
                    <button disabled={busy} onClick={() => act(() => retryFailedCampaignRecipients(camp._id), (r) => `${r.requeued} recipient(s) re-queued`)} title="Only recipients Meta never accepted are retried, so nobody receives the message twice." className="flex items-center gap-1 bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"><FiRotateCcw size={12} /> Retry failed (not accepted)</button>
                )}
                <button onClick={load} className="flex items-center gap-1 bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"><FiRefreshCw size={12} /> Refresh</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {metric("Total", c.total, "text-slate-800")}
                {metric("Eligible", c.eligible, "text-slate-800")}
                {metric("Invalid / skipped", `${c.invalid} / ${c.skipped}`, "text-slate-500")}
                {metric("Queued", c.queued + c.sending, "text-amber-600")}
                {metric("Accepted", c.accepted, "text-sky-700", "Meta accepted the API request (has a WhatsApp message ID). Not the same as delivered.")}
                {metric("Delivered", c.delivered, "text-emerald-700", "Includes read")}
                {metric("Read", c.read, "text-emerald-800")}
                {metric("Failed", c.failed, "text-rose-600")}
                {metric("Unknown", c.unknown, "text-purple-700", RECIPIENT_STATE.unknown.help)}
                {metric("Cancelled", c.cancelled, "text-slate-500")}
                {metric("Delivery rate", pct(c.delivery_rate), "text-emerald-700", "Delivered ÷ accepted")}
                {metric("Read rate", pct(c.read_rate), "text-emerald-800", "Read ÷ delivered")}
                {metric("Failure rate", pct(c.failure_rate), "text-rose-600", "Failed ÷ attempted")}
                {metric("Progress", `${c.progress ?? 0}%`, "text-slate-800", "Share of eligible recipients handed to Meta or finished")}
            </div>

            {c.awaiting_status > 0 && (
                <p className="text-[11px] text-sky-800 bg-sky-50 border border-sky-100 rounded-xl p-3 flex gap-2">
                    <FiClock className="shrink-0 mt-0.5" /> {c.awaiting_status} message(s) were accepted by Meta and are waiting for delivery webhooks. Counts update automatically as status events arrive; some recipients (e.g. phones offline) may stay pending for a while.
                </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <p><span className="text-slate-400">Created:</span> {fmt(camp.created_at)}{camp.created_by ? ` by ${camp.created_by}` : ""}</p>
                <p><span className="text-slate-400">{camp.schedule?.mode === "scheduled" ? "Scheduled for" : "Launched"}:</span> {fmt(camp.schedule?.scheduled_at || camp.launched_at)}</p>
                <p><span className="text-slate-400">Started:</span> {fmt(camp.started_at)}</p>
                <p><span className="text-slate-400">Dispatch finished:</span> {fmt(camp.completed_at)}</p>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-800 mr-auto">Recipients ({recipients.total})</p>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / phone" className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5" />
                    <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5">
                        <option value="">All statuses</option>
                        {Object.entries(RECIPIENT_STATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto max-h-[480px]">
                    <table className="w-full text-[11px]">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] sticky top-0">
                            <tr>
                                <th className="text-left px-3 py-2">Recipient</th><th className="text-left px-3 py-2">Status</th>
                                <th className="text-left px-3 py-2">Accepted</th><th className="text-left px-3 py-2">Delivered</th>
                                <th className="text-left px-3 py-2">Read</th><th className="text-left px-3 py-2">Attempts</th><th className="text-left px-3 py-2">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {recipients.recipients.map((r) => (
                                <Fragment key={r._id}>
                                    <tr className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setExpanded(expanded === r._id ? null : r._id)}>
                                        <td className="px-3 py-2"><p className="font-semibold text-slate-800">{r.name || "—"}</p><p className="font-mono text-slate-400">{r.phone ? `+${r.phone}` : r.raw_phone}</p></td>
                                        <td className="px-3 py-2"><Badge map={RECIPIENT_STATE} value={r.state} /></td>
                                        <td className="px-3 py-2 text-slate-500">{fmt(r.accepted_at)}</td>
                                        <td className="px-3 py-2 text-slate-500">{fmt(r.delivered_at)}</td>
                                        <td className="px-3 py-2 text-slate-500">{fmt(r.read_at)}</td>
                                        <td className="px-3 py-2 text-slate-500">{r.attempts || 0}</td>
                                        <td className="px-3 py-2 text-rose-600 max-w-[260px] truncate" title={r.error?.message || r.reason || ""}>
                                            {r.error ? `${r.error.code ? `[${r.error.code}] ` : ""}${r.error.message || ""}${r.error.details ? ` — ${r.error.details}` : ""}` : (r.reason || "")}
                                        </td>
                                    </tr>
                                    {expanded === r._id && (
                                        <tr className="bg-slate-50/60">
                                            <td colSpan={7} className="px-4 py-3 space-y-2">
                                                {r.preview && <div className="max-w-md"><div className="bg-[#DCF8C6] rounded-xl p-2.5 text-[11px] whitespace-pre-wrap">{r.preview}</div></div>}
                                                {r.wamid && <p className="text-[10px] text-slate-500">WhatsApp message ID: <span className="font-mono">{r.wamid}</span></p>}
                                                <div className="text-[10px] text-slate-600">
                                                    <p className="font-bold text-slate-500 uppercase text-[9px] mb-1">Status history</p>
                                                    {(r.status_history || []).map((h, i) => <p key={i}>{fmt(h.at)} — {h.state} <span className="text-slate-400">({h.source})</span></p>)}
                                                </div>
                                                {(r.errors || []).length > 0 && (
                                                    <div className="text-[10px] text-rose-700">
                                                        <p className="font-bold text-slate-500 uppercase text-[9px] mb-1">Error / retry history</p>
                                                        {r.errors.map((e, i) => <p key={i}>{fmt(e.at)} — attempt {e.attempt ?? "-"}: {e.code ? `[${e.code}] ` : ""}{e.message}{e.retryable ? " (retryable)" : ""}</p>)}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                            {!recipients.recipients.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No recipients match.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

function WhatsAppCampaigns({ isWizardOnly = false }) {
    const navigate = useNavigate();
    const { whatsappSocket } = useWebSockets();
    const [showBuilder, setShowBuilder] = useState(isWizardOnly);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [refreshSignal, setRefreshSignal] = useState(0);

    const load = useCallback(async () => {
        try {
            const data = await listCampaigns({ search: search || undefined, status: statusFilter || undefined });
            setCampaigns(data.campaigns || []);
            setLoadError(null);
        } catch (e) {
            setLoadError(apiErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!campaigns.some((c) => ACTIVE_CAMPAIGN.has(c.status))) return undefined;
        const t = setInterval(load, 8000);
        return () => clearInterval(t);
    }, [campaigns, load]);
    useEffect(() => {
        if (!whatsappSocket) return undefined;
        const handler = (data) => {
            if (data?.event === "message_status_updated" && isEventForActiveNumber(data.data)) setRefreshSignal((n) => n + 1);
        };
        whatsappSocket.on("message", handler);
        return () => whatsappSocket.off("message", handler);
    }, [whatsappSocket]);

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in font-sans">
            <WhatsAppHeader activeTab="campaigns" searchQuery={search} onSearchChange={setSearch} />

            {showBuilder ? (
                <CampaignBuilder
                    onClose={() => (isWizardOnly ? navigate("/whatsapp/campaigns") : setShowBuilder(false))}
                    onCreated={(c) => { setShowBuilder(false); setSelectedId(c._id); load(); if (isWizardOnly) navigate("/whatsapp/campaigns"); }}
                />
            ) : selectedId ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
                    <CampaignDetail campaignId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} refreshSignal={refreshSignal} />
                </div>
            ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
                        <h2 className="text-sm font-bold text-slate-800 font-display">Campaigns</h2>
                        <div className="flex items-center gap-2">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded-xl px-2.5 py-2">
                                <option value="">All statuses</option>
                                {Object.entries(CAMPAIGN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <button onClick={load} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer" title="Refresh"><FiRefreshCw size={14} /></button>
                            <button onClick={() => setShowBuilder(true)} className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"><FiPlus size={13} /> New Campaign</button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="p-6 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                    ) : loadError ? (
                        <p className="p-6 text-xs text-rose-600">{loadError}</p>
                    ) : campaigns.length === 0 ? (
                        <div className="p-12 text-center space-y-2">
                            <FiSend className="mx-auto text-slate-300" size={28} />
                            <p className="text-sm font-bold text-slate-700">No campaigns yet</p>
                            <p className="text-xs text-slate-400">Create a campaign from a Meta-approved template to message your contacts.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px]">
                                    <tr>
                                        <th className="text-left px-4 py-2.5">Campaign</th><th className="text-left px-4 py-2.5">Status</th>
                                        <th className="text-right px-4 py-2.5">Eligible</th><th className="text-right px-4 py-2.5" title="Accepted by Meta">Accepted</th>
                                        <th className="text-right px-4 py-2.5">Delivered</th><th className="text-right px-4 py-2.5">Read</th>
                                        <th className="text-right px-4 py-2.5">Failed</th><th className="text-right px-4 py-2.5">Pending</th>
                                        <th className="text-left px-4 py-2.5">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {campaigns.map((c) => (
                                        <tr key={c._id} onClick={() => setSelectedId(c._id)} className="hover:bg-slate-50 cursor-pointer">
                                            <td className="px-4 py-3"><p className="font-bold text-slate-800">{c.name}</p><p className="text-[10px] text-slate-400">{c.template?.display_name} · {c.template?.language}</p></td>
                                            <td className="px-4 py-3"><Badge map={CAMPAIGN_STATUS} value={c.status} />{c.status === "scheduled" && <p className="text-[9px] text-slate-400 mt-0.5">{fmt(c.schedule?.scheduled_at)}</p>}</td>
                                            <td className="px-4 py-3 text-right">{c.counts?.eligible ?? 0}</td>
                                            <td className="px-4 py-3 text-right text-sky-700">{c.counts?.accepted ?? 0}</td>
                                            <td className="px-4 py-3 text-right text-emerald-700">{c.counts?.delivered ?? 0}</td>
                                            <td className="px-4 py-3 text-right text-emerald-800">{c.counts?.read ?? 0}</td>
                                            <td className="px-4 py-3 text-right text-rose-600">{c.counts?.failed ?? 0}</td>
                                            <td className="px-4 py-3 text-right text-amber-600">{c.counts?.pending ?? 0}</td>
                                            <td className="px-4 py-3 text-slate-500">{fmt(c.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default WhatsAppCampaigns;
