import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { getWhatsAppDashboardStats, triggerAutomation, isEventForActiveNumber } from "../services/whatsappApi";
import { useWebSockets } from "../../context/WebSocketContext";
import {
    FiSend, FiClock, FiCalendar, FiCheckCircle, FiXCircle, FiZap,
    FiActivity, FiArrowUpRight, FiRefreshCw, FiPlay, FiUsers, FiTrendingUp,
    FiMessageSquare, FiTrendingDown, FiShield, FiAlertTriangle
} from "react-icons/fi";

function WhatsAppDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { whatsappSocket } = useWebSockets();

    const fetchStats = async () => {
        try {
            const data = await getWhatsAppDashboardStats();
            setStats(data);
        } catch (err) {
            console.error("Failed to load dashboard stats", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (!whatsappSocket) return;
        const handleEvent = (data) => {
            if ((data.event === "new_message" || data.event === "automation_log_created") && isEventForActiveNumber(data.data)) {
                fetchStats();
            }
        };
        whatsappSocket.on("message", handleEvent);
        return () => whatsappSocket.off("message", handleEvent);
    }, [whatsappSocket]);

    const handleTrigger = async (workflow) => {
        setTriggering(workflow);
        try {
            await triggerAutomation(workflow);
            await fetchStats();
        } catch (err) {
            console.error("Trigger error:", err);
        } finally {
            setTriggering(null);
        }
    };

    const contactsCount = (() => {
        try { return JSON.parse(localStorage.getItem("whatsapp_contacts_list") || "[]").length; } catch { return 0; }
    })();
    const o = stats?.outcomes_30d || {};
    const rate = (v) => (v === null || v === undefined ? "—" : `${v}%`);
    const executiveCards = stats ? [
        { title: "Saved Contacts", value: contactsCount, growth: "", comparison: "WhatsApp contact list", icon: FiUsers, color: "text-indigo-600 border-indigo-100 bg-indigo-50/50", progress: null },
        { title: "Messages Today", value: stats.messages_sent_today || 0, growth: "", comparison: "Outbound, created today", icon: FiSend, color: "text-emerald-600 border-emerald-100 bg-emerald-50/50", progress: null },
        { title: "Active Campaigns", value: stats.campaigns?.active ?? 0, growth: `${stats.campaigns?.scheduled ?? 0} scheduled`, comparison: `${stats.campaigns?.completed ?? 0} finished`, icon: FiZap, color: "text-blue-600 border-blue-100 bg-blue-50/50", progress: null },
        { title: "Delivery Rate (30d)", value: rate(o.delivery_rate), growth: `${o.delivered ?? 0} delivered`, comparison: `of ${o.accepted ?? 0} accepted by Meta`, icon: FiCheckCircle, color: "text-emerald-600 border-emerald-100 bg-emerald-50/50", progress: o.delivery_rate },
        { title: "Read Rate (30d)", value: rate(o.read_rate), growth: `${o.read ?? 0} read`, comparison: "of delivered messages", icon: FiMessageSquare, color: "text-teal-600 border-teal-100 bg-teal-50/50", progress: o.read_rate },
        { title: "Customer Replies (30d)", value: o.replies ?? 0, growth: "", comparison: "Inbound messages received", icon: FiTrendingUp, color: "text-indigo-600 border-indigo-100 bg-indigo-50/50", progress: null },
        { title: "Awaiting Status", value: Math.max(0, (o.accepted ?? 0) - (o.delivered ?? 0) - (o.failed ?? 0)), growth: "", comparison: "Accepted, no delivery webhook yet", icon: FiClock, color: "text-amber-600 border-amber-100 bg-amber-50/50", progress: null },
        { title: "Failed (30d)", value: o.failed ?? 0, growth: rate(o.failure_rate), comparison: "of accepted messages", icon: FiXCircle, color: "text-rose-600 border-rose-100 bg-rose-50/50", progress: o.failure_rate },
    ] : [];

    const workflows = [
        { id: "followup_reminder", label: "Follow-up Reminders", desc: "Runs the bound template automation (Automation page)" },
        { id: "meeting_reminder", label: "Meeting Reminders", desc: "Today's meetings, once per meeting" },
        { id: "daily_lead_report", label: "Daily Lead Report", desc: "CRM summary to the configured admin phone" },
    ];

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="h-32 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 mt-2 pb-12 animate-fade-in">
            {/* Global Executive Header */}
            <WhatsAppHeader activeTab="dashboard" searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            {/* 8 Executive Glass Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {executiveCards.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={index}
                            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                        >
                            {/* Accent top line */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-[#25D366] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
                                        {item.title}
                                    </span>
                                    <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">
                                        {item.value}
                                    </h2>
                                </div>
                                <div className={`p-3 rounded-2xl border transition-all duration-300 group-hover:scale-110 shadow-xs ${item.color}`}>
                                    <Icon size={18} />
                                </div>
                            </div>

                            {/* Trend & Micro Progress Bar */}
                            <div className="mt-4 pt-3 border-t border-slate-100/80 space-y-2">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                                        {item.growth}
                                    </span>
                                    <span className="text-slate-400 font-medium">{item.comparison}</span>
                                </div>
                                {item.progress !== null && item.progress !== undefined && (
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                            style={{ width: `${item.progress}%` }}
                                        ></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Middle Section: Real-time Timeline & Workflow Triggers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Real-time Activity Timeline (70%) */}
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 font-display">Live Execution Timeline</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Real-time WebSocket event stream for messaging automations</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={fetchStats} className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-emerald-50 transition cursor-pointer">
                                    <FiRefreshCw size={14} />
                                </button>
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-extrabold px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                    Live Stream
                                </span>
                            </div>
                        </div>

                        <div className="relative pl-6 space-y-5 before:absolute before:inset-y-1 before:left-2 before:w-[1px] before:bg-slate-100">
                            {stats?.recent_activity?.length > 0 ? stats.recent_activity.map((log, idx) => (
                                <div key={idx} className="relative flex justify-between items-start gap-4 group">
                                    <span className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white transition-all group-hover:scale-125 ${log.status === "success" ? "bg-emerald-500" : log.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`}></span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-700 font-semibold truncate leading-normal">
                                            {log.workflow_name} — <span className="text-slate-900 font-bold">{log.recipient || "System Dispatch"}</span>
                                        </p>
                                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                                            {log.execution_time ? new Date(log.execution_time).toLocaleString() : "—"} · Latency: {log.execution_duration_ms}ms
                                        </span>
                                    </div>
                                    <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${log.status === "success" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : log.status === "failed" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                                        {log.status}
                                    </span>
                                </div>
                            )) : (
                                <div className="text-center py-12">
                                    <FiActivity size={32} className="mx-auto text-slate-200 mb-2" />
                                    <p className="text-xs text-slate-400">No automation activity logs recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                        <button onClick={() => navigate("/whatsapp/logs")} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer">
                            View Full Audit Logs <FiArrowUpRight size={13} />
                        </button>
                    </div>
                </div>

                {/* Automation Health & Manual Controls (30%) */}
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col justify-between space-y-6">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-4 font-display">Provider Infrastructure</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Provider</span>
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                    {stats?.provider?.name || "Meta WhatsApp Cloud API"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduler Service</span>
                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md border ${stats?.scheduler?.running ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-amber-600 bg-amber-50 border-amber-100"}`}>
                                    {stats?.scheduler?.running ? "Running" : "Stopped"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Integration Health</span>
                                <button onClick={() => navigate("/whatsapp/settings")} className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer">Open diagnostics →</button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 font-display">Instant Manual Trigger</h3>
                        <div className="space-y-2.5">
                            {workflows.map((wf) => (
                                <button
                                    key={wf.id}
                                    onClick={() => handleTrigger(wf.id)}
                                    disabled={triggering === wf.id}
                                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/20 text-xs font-bold text-slate-700 hover:text-emerald-600 transition-all duration-200 text-left group cursor-pointer disabled:opacity-50 shadow-xs"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <FiPlay className="text-slate-400 group-hover:text-emerald-500 transition" size={13} />
                                        <span>
                                            <span className="block">{wf.label}</span>
                                            <span className="text-[9px] text-slate-400 font-normal">{wf.desc}</span>
                                        </span>
                                    </span>
                                    {triggering === wf.id ? (
                                        <FiRefreshCw className="text-emerald-500 animate-spin" size={14} />
                                    ) : (
                                        <FiArrowUpRight className="text-slate-300 group-hover:text-emerald-500 transition" size={14} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WhatsAppDashboard;
