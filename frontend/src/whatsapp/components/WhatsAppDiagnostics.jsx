import { useCallback, useEffect, useState } from "react";
import {
    apiErrorMessage, getWhatsAppDiagnostics, subscribeAppToWaba,
} from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import { FiCheckCircle, FiXCircle, FiRefreshCw, FiCopy, FiActivity, FiLink } from "react-icons/fi";

const fmt = (iso) => (iso ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString() : "never");

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
        </div>
    );
}

export default WhatsAppDiagnostics;
