import { useCallback, useEffect, useRef, useState } from "react";
import {
    apiErrorMessage, getWhatsAppDiagnostics, subscribeAppToWaba, getSendableTemplates, sendTestTemplateMessage, getSendJob,
} from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import TemplateSelector from "./TemplateSelector";
import VariableMappingEditor from "./VariableMappingEditor";
import { unmappedSlots } from "./variableMapping";
import { FiCheckCircle, FiXCircle, FiRefreshCw, FiCopy, FiActivity, FiSend, FiLink } from "react-icons/fi";

const fmt = (iso) => (iso ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString() : "never");

function TestSend() {
    const { showToast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [template, setTemplate] = useState(null);
    const [phone, setPhone] = useState("");
    const [mapping, setMapping] = useState({});
    const [job, setJob] = useState(null);
    const [sending, setSending] = useState(false);
    const poll = useRef(null);

    useEffect(() => {
        getSendableTemplates().then(setTemplates).catch(() => setTemplates([])).finally(() => setLoading(false));
        return () => clearInterval(poll.current);
    }, []);

    const send = async () => {
        setSending(true);
        try {
            const res = await sendTestTemplateMessage({ phone, template_id: template._id, variable_mapping: mapping, client_request_id: `${Date.now()}` });
            setJob(res.job);
            clearInterval(poll.current);
            poll.current = setInterval(async () => {
                try {
                    const j = await getSendJob(res.job._id);
                    setJob(j);
                    if (["read", "failed", "unknown", "invalid", "skipped"].includes(j.state)) clearInterval(poll.current);
                } catch { clearInterval(poll.current); }
            }, 3000);
        } catch (e) {
            showToast(apiErrorMessage(e), "error");
        } finally {
            setSending(false);
        }
    };

    const missing = template ? unmappedSlots(template.slots, mapping) : [];

    return (
        <div className="space-y-3">
            <TemplateSelector templates={templates} loading={loading} selectedId={template?._id} onSelect={(t) => { setTemplate(t); setMapping({}); setJob(null); }} />
            {template && (
                <>
                    <VariableMappingEditor slots={template.slots} mapping={mapping} onChange={setMapping}
                        fieldOptions={[{ value: "name", label: "Recipient name" }, { value: "phone", label: "Phone" }]} />
                    <div className="flex gap-2">
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Test number with country code, e.g. +91 98765 43210" className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono" />
                        <button onClick={send} disabled={sending || !phone.trim() || missing.length > 0} className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-40 cursor-pointer">
                            <FiSend size={12} /> {sending ? "Queuing..." : "Send test"}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400">Only send to a number that has opted in. The message goes through the real queue and Meta API.</p>
                </>
            )}
            {job && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] space-y-1">
                    <p>State: <strong>{job.state}</strong> {job.state === "accepted" && <span className="text-slate-500">— accepted by Meta, waiting for a delivery webhook…</span>}</p>
                    {job.wamid && <p>wamid: <span className="font-mono">{job.wamid}</span></p>}
                    {(job.error || job.reason) && <p className="text-rose-600">{job.error?.code ? `[${job.error.code}] ` : ""}{job.error?.message || job.reason}{job.error?.details ? ` — ${job.error.details}` : ""}</p>}
                    {(job.status_history || []).map((h, i) => <p key={i} className="text-slate-500">{fmt(h.at)} — {h.state} ({h.source})</p>)}
                </div>
            )}
        </div>
    );
}

function WhatsAppDiagnostics() {
    const { showToast } = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [subscribing, setSubscribing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getWhatsAppDiagnostics());
            setError(null);
        } catch (e) {
            setError(apiErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const subscribe = async () => {
        setSubscribing(true);
        try {
            await subscribeAppToWaba();
            showToast("App subscribed to the WhatsApp Business Account.", "success");
            await load();
        } catch (e) {
            showToast(apiErrorMessage(e), "error");
        } finally {
            setSubscribing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2"><FiActivity className="text-emerald-500" /> Meta Integration Diagnostics</h3>
                    <button type="button" onClick={load} className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
                        <FiRefreshCw size={11} className={loading ? "animate-spin" : ""} /> Re-check
                    </button>
                </div>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                {data && (
                    <>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><FiLink size={10} /> Webhook callback URL (paste into Meta App Dashboard → WhatsApp → Configuration)</p>
                            <div className="flex items-center gap-2 mt-1">
                                <code className="text-xs font-mono text-slate-800 break-all">{data.callback_url}</code>
                                <button type="button" onClick={() => { navigator.clipboard?.writeText(data.callback_url); showToast("Copied", "success"); }} className="text-slate-400 hover:text-slate-700 cursor-pointer"><FiCopy size={12} /></button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Subscribe these webhook fields: {data.required_webhook_fields.join(", ")} · Graph API {data.graph_api_version}</p>
                        </div>
                        <div className="space-y-2">
                            {data.checks.map((c) => (
                                <div key={c.key} className={`flex items-start gap-3 p-3 rounded-xl border ${c.ok ? "border-emerald-100 bg-emerald-50/30" : "border-rose-100 bg-rose-50/30"}`}>
                                    {c.ok ? <FiCheckCircle className="text-emerald-600 mt-0.5 shrink-0" /> : <FiXCircle className="text-rose-600 mt-0.5 shrink-0" />}
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800">{c.label}</p>
                                        <p className="text-[11px] text-slate-600 break-words">{c.detail}</p>
                                        {c.action && <p className="text-[10px] text-amber-700 mt-0.5">→ {c.action}</p>}
                                        {c.key === "subscription" && !c.ok && (
                                            <button type="button" onClick={subscribe} disabled={subscribing} className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-50 cursor-pointer">
                                                {subscribing ? "Subscribing..." : "Subscribe app to WABA"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                            <p><span className="text-slate-400">Last status webhook:</span> {fmt(data.webhook.last_status_event_at)}</p>
                            <p><span className="text-slate-400">Last inbound message:</span> {fmt(data.webhook.last_inbound_message_at)}</p>
                            <p><span className="text-slate-400">Pending events:</span> {data.webhook.pending_events}</p>
                            <p><span className="text-slate-400">Rejected signatures (since restart):</span> {data.webhook.rejected_signatures}</p>
                            <p><span className="text-slate-400">Send worker:</span> {data.worker.running ? "running" : "STOPPED"} · {data.worker.queued_jobs} queued</p>
                            <p><span className="text-slate-400">Rate limit:</span> {data.worker.rate_per_second}/s, {data.worker.concurrency} parallel</p>
                            <p><span className="text-slate-400">Last template sync:</span> {fmt(data.last_template_sync?.synced_at)}</p>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2"><FiSend className="text-emerald-500" /> Send a test template message</h3>
                <TestSend />
            </div>
        </div>
    );
}

export default WhatsAppDiagnostics;
