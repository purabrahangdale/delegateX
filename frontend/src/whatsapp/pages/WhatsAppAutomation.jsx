import { useCallback, useEffect, useMemo, useState } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import TemplateSelector from "../components/TemplateSelector";
import TemplateStatusBadge from "../components/TemplateStatusBadge";
import VariableMappingEditor from "../components/VariableMappingEditor";
import { suggestMapping, unmappedSlots } from "../components/variableMapping";
import {
    apiErrorMessage, getAutomationWorkflows, saveAutomationBinding, getAutomationRuns, getSendableTemplates, triggerAutomation,
} from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import { FiZap, FiPlay, FiSettings, FiRefreshCw, FiX, FiAlertTriangle, FiCheckCircle, FiInfo } from "react-icons/fi";

const RUNNABLE = new Set(["followup_reminder", "meeting_reminder", "daily_lead_report", "daily_reply_report"]);

const RUN_STATUS = {
    queued: "text-amber-700 bg-amber-50 border-amber-200",
    skipped: "text-slate-600 bg-slate-50 border-slate-200",
    failed: "text-rose-700 bg-rose-50 border-rose-200",
    pending: "text-slate-600 bg-slate-50 border-slate-200",
};
const MESSAGE_STATE = {
    accepted: "text-sky-700", sent: "text-teal-700", delivered: "text-emerald-700", read: "text-emerald-800",
    failed: "text-rose-600", queued: "text-amber-600", unknown: "text-purple-700", skipped: "text-slate-500", invalid: "text-rose-600",
};

const fmt = (iso) => (iso ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString() : "—");

function BindingEditor({ workflow, onClose, onSaved }) {
    const { showToast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [template, setTemplate] = useState(null);
    const [mapping, setMapping] = useState(workflow.binding?.variable_mapping || {});
    const [enabled, setEnabled] = useState(!!workflow.binding?.enabled);
    const [recipientPhone, setRecipientPhone] = useState(workflow.binding?.recipient_phone || "");
    const [saving, setSaving] = useState(false);
    const fieldOptions = useMemo(() => workflow.fields.map((f) => ({ value: f, label: f.replace(/_/g, " ") })), [workflow]);

    useEffect(() => {
        getSendableTemplates()
            .then((list) => {
                setTemplates(list);
                const current = list.find((t) => t._id === workflow.binding?.template_id);
                if (current) setTemplate(current);
            })
            .catch((e) => setLoadError(apiErrorMessage(e)))
            .finally(() => setLoading(false));
    }, [workflow]);

    const missing = template ? unmappedSlots(template.slots, mapping) : [];

    const save = async () => {
        setSaving(true);
        try {
            await saveAutomationBinding(workflow.key, {
                enabled, template_id: template?._id || null, variable_mapping: mapping, recipient_phone: recipientPhone || null,
            });
            showToast(`"${workflow.label}" saved${enabled ? " and enabled" : ""}.`, "success");
            onSaved();
        } catch (e) {
            showToast(apiErrorMessage(e), "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 font-display">{workflow.label}</h3>
                        <p className="text-[10px] text-slate-400">{workflow.trigger}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
                </div>
                <div className="p-5 space-y-5">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">1. Approved template</p>
                        {loadError ? <p className="text-xs text-rose-600">{loadError}</p> : (
                            <TemplateSelector templates={templates} loading={loading} selectedId={template?._id}
                                onSelect={(t) => { setTemplate(t); setMapping(suggestMapping(t.slots, fieldOptions, {})); }} />
                        )}
                    </div>
                    {template && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">2. Fill template variables from the trigger data</p>
                            <VariableMappingEditor slots={template.slots} mapping={mapping} onChange={setMapping} fieldOptions={fieldOptions} />
                        </div>
                    )}
                    {workflow.fixed_recipient && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">3. Send report to</p>
                            <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl font-mono" />
                            <p className="text-[10px] text-slate-400 mt-1">Must be a number that has opted in to receive these reports.</p>
                        </div>
                    )}
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable this automation
                    </label>
                    {enabled && missing.length > 0 && <p className="text-[11px] text-amber-700">Map all variables before enabling ({missing.length} missing).</p>}
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl cursor-pointer">Cancel</button>
                    <button onClick={save} disabled={saving || (enabled && (!template || missing.length > 0))} className="px-4 py-2 text-xs font-semibold text-white bg-[#25D366] rounded-xl disabled:opacity-40 cursor-pointer">
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function WhatsAppAutomation() {
    const { showToast } = useToast();
    const [workflows, setWorkflows] = useState([]);
    const [runs, setRuns] = useState({ runs: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);
    const [running, setRunning] = useState(null);
    const [runFilter, setRunFilter] = useState("");

    const load = useCallback(async () => {
        try {
            const [wf, r] = await Promise.all([getAutomationWorkflows(), getAutomationRuns({ workflow: runFilter || undefined, limit: 200 })]);
            setWorkflows(wf);
            setRuns(r);
            setError(null);
        } catch (e) {
            setError(apiErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [runFilter]);

    useEffect(() => { load(); }, [load]);

    const runNow = async (wf) => {
        setRunning(wf.key);
        try {
            const res = await triggerAutomation(wf.key, {});
            const result = res.result;
            const count = Array.isArray(result) ? result.length : result ? 1 : 0;
            showToast(count ? `${wf.label}: ${count} trigger(s) processed — see the execution log.` : res.message, count ? "success" : "warning");
            await load();
        } catch (e) {
            showToast(apiErrorMessage(e), "error");
        } finally {
            setRunning(null);
        }
    };

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in font-sans">
            <WhatsAppHeader activeTab="automation" />

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2"><FiZap className="text-emerald-500" /> Automation Rules</h2>
                        <p className="text-[10px] text-slate-400">Business-initiated messages must use a Meta-approved template. Each trigger sends at most once (replays are ignored).</p>
                    </div>
                    <button onClick={load} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer" title="Refresh"><FiRefreshCw size={14} /></button>
                </div>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                ) : error ? (
                    <p className="text-xs text-rose-600">{error}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {workflows.map((wf) => {
                            const enabled = wf.binding?.enabled;
                            const broken = enabled && !wf.template_sendable;
                            return (
                                <div key={wf.key} className={`p-4 rounded-xl border ${broken ? "border-rose-200 bg-rose-50/30" : enabled ? "border-emerald-200" : "border-slate-200"}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{wf.label}</p>
                                            <p className="text-[10px] text-slate-400">{wf.trigger}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${enabled ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                                            {enabled ? "Enabled" : "Off"}
                                        </span>
                                    </div>
                                    <div className="mt-3 text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                                        {wf.template ? (
                                            <>
                                                <span>Template: <strong>{wf.template.name}</strong> <span className="font-mono text-[10px]">({wf.template.language})</span></span>
                                                <TemplateStatusBadge status={wf.template.status} />
                                            </>
                                        ) : <span className="text-slate-400">No template bound — this automation sends nothing.</span>}
                                    </div>
                                    {broken && <p className="text-[10px] text-rose-700 mt-1 flex items-center gap-1"><FiAlertTriangle size={11} /> The bound template is not approved on Meta any more — runs will fail until you pick another.</p>}
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => setEditing(wf)} className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"><FiSettings size={11} /> Configure</button>
                                        {RUNNABLE.has(wf.key) && (
                                            <button onClick={() => runNow(wf)} disabled={!enabled || running === wf.key} title={enabled ? "Run the scheduled check now" : "Enable the automation first"} className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-40 cursor-pointer">
                                                <FiPlay size={11} /> {running === wf.key ? "Running..." : "Run now"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className="text-[10px] text-slate-400 mt-4 flex gap-1.5"><FiInfo size={11} className="shrink-0 mt-0.5" /> Auto-reply, AI FAQ and intent routing answer inbound customer messages with free-form text inside the 24-hour service window and need no template.</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-900 font-display">Execution Log ({runs.total})</h2>
                    <select value={runFilter} onChange={(e) => setRunFilter(e.target.value)} className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5">
                        <option value="">All automations</option>
                        {workflows.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
                    </select>
                </div>
                {runs.runs.length === 0 ? (
                    <p className="p-8 text-center text-xs text-slate-400">No automation has run yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[9px]">
                                <tr>
                                    <th className="text-left px-4 py-2">Time</th><th className="text-left px-4 py-2">Automation</th><th className="text-left px-4 py-2">Trigger</th>
                                    <th className="text-left px-4 py-2">Recipient</th><th className="text-left px-4 py-2">Run</th><th className="text-left px-4 py-2">Message</th><th className="text-left px-4 py-2">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {runs.runs.map((r) => (
                                    <tr key={r._id}>
                                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
                                        <td className="px-4 py-2 font-semibold text-slate-800">{r.workflow_label}</td>
                                        <td className="px-4 py-2 text-slate-500">{r.trigger}</td>
                                        <td className="px-4 py-2"><p>{r.recipient_name || "—"}</p><p className="font-mono text-slate-400">{r.recipient_phone || ""}</p></td>
                                        <td className="px-4 py-2"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${RUN_STATUS[r.status] || RUN_STATUS.pending}`}>{r.status}</span></td>
                                        <td className={`px-4 py-2 font-semibold ${MESSAGE_STATE[r.message_state] || "text-slate-400"}`}>
                                            {r.message_state ? <span className="flex items-center gap-1">{["delivered", "read"].includes(r.message_state) && <FiCheckCircle size={11} />}{r.message_state}</span> : "—"}
                                        </td>
                                        <td className="px-4 py-2 text-rose-600 max-w-[280px]">{r.message_error || r.reason || ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editing && <BindingEditor workflow={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
        </div>
    );
}

export default WhatsAppAutomation;
