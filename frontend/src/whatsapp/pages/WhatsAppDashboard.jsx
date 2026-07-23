import { useEffect, useState } from "react";
import { getWhatsAppDashboardStats, triggerAutomation } from "../services/whatsappApi";
import { useWebSockets } from "../../context/WebSocketContext";
import {
    FiSend, FiClock, FiCalendar, FiCheckCircle, FiXCircle, FiZap,
    FiActivity, FiArrowUpRight, FiRefreshCw, FiPlay
} from "react-icons/fi";

function WhatsAppDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(null);
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
            if (data.event === "new_message" || data.event === "automation_log_created") {
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

    const statCards = stats ? [
        { title: "Messages Sent Today", value: stats.messages_sent_today, icon: FiSend, color: "text-emerald-600 border-emerald-100 bg-emerald-50/50" },
        { title: "Pending Messages", value: stats.pending_messages, icon: FiClock, color: "text-amber-600 border-amber-100 bg-amber-50/50" },
        { title: "Scheduled Messages", value: stats.scheduled_messages, icon: FiCalendar, color: "text-blue-600 border-blue-100 bg-blue-50/50" },
        { title: "Successful Deliveries", value: stats.successful_deliveries, icon: FiCheckCircle, color: "text-indigo-600 border-indigo-100 bg-indigo-50/50" },
        { title: "Failed Messages", value: stats.failed_messages, icon: FiXCircle, color: "text-rose-600 border-rose-100 bg-rose-50/50" },
        { title: "Total Automations", value: stats.total_automations, icon: FiZap, color: "text-violet-600 border-violet-100 bg-violet-50/50" },
    ] : [];

    const workflows = [
        { id: "followup-reminder", label: "Follow-up Reminders", desc: "Send reminders to active leads" },
        { id: "meeting-reminder", label: "Meeting Reminders", desc: "Remind clients of today's meetings" },
        { id: "daily-report", label: "Daily Lead Report", desc: "Generate CRM lead summary" },
    ];

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse mt-2">
                <div className="flex flex-col gap-2">
                    <div className="h-8 w-64 bg-slate-200 rounded-xl"></div>
                    <div className="h-4 w-80 bg-slate-200 rounded-xl"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-28 bg-slate-100 border border-slate-200 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 mt-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-600 text-white text-sm shadow-lg shadow-green-500/20">W</span>
                        WhatsApp Automation
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">Real-time automation dashboard for WhatsApp messaging workflows.</p>
                </div>
                <button
                    onClick={fetchStats}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                    <FiRefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={index}
                            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-start justify-between group"
                        >
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.title}</span>
                                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{item.value}</h2>
                            </div>
                            <div className={`p-3 rounded-xl border transition-all duration-300 group-hover:scale-105 ${item.color}`}>
                                <Icon size={16} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity Timeline */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 font-display">Recent Activity</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Latest automation execution logs</p>
                        </div>
                        <span className="text-[10px] bg-green-50/50 text-green-600 font-bold px-2.5 py-1 rounded-lg border border-green-100/50 flex items-center gap-1">
                            <FiActivity size={10} />
                            Live
                        </span>
                    </div>
                    <div className="relative pl-6 space-y-5 before:absolute before:inset-y-1 before:left-2 before:w-[1px] before:bg-slate-100">
                        {stats?.recent_activity?.length > 0 ? stats.recent_activity.map((log, idx) => (
                            <div key={idx} className="relative flex justify-between items-start gap-4">
                                <span className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${log.status === "success" ? "bg-emerald-500" : log.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`}></span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-700 leading-normal font-medium truncate">{log.workflow_name} — {log.recipient || "System"}</p>
                                    <span className="text-[9px] text-slate-400 font-semibold block mt-1">{log.execution_time ? new Date(log.execution_time).toLocaleString() : "—"} · {log.execution_duration_ms}ms</span>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${log.status === "success" ? "bg-emerald-50 text-emerald-600" : log.status === "failed" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>{log.status}</span>
                            </div>
                        )) : (
                            <div className="text-center py-8">
                                <p className="text-xs text-slate-400">No automation activity yet. Trigger a workflow to get started.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Automation Health & Quick Actions */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col gap-6">
                    {/* Provider Status */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 font-display">Automation Health</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Provider</span>
                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">{stats?.provider?.name || "Simulation Mode"}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scheduler</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${stats?.scheduler?.running ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50"}`}>
                                    {stats?.scheduler?.running ? "Running" : "Stopped"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Execution</span>
                                <span className="text-[10px] font-bold text-slate-600">
                                    {stats?.last_automation_time ? new Date(stats.last_automation_time).toLocaleTimeString() : "None"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Trigger Workflows */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 font-display">Trigger Workflow</h3>
                        <div className="space-y-2">
                            {workflows.map((wf) => (
                                <button
                                    key={wf.id}
                                    onClick={() => handleTrigger(wf.id)}
                                    disabled={triggering === wf.id}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-green-500 hover:bg-green-50/10 text-xs font-bold text-slate-700 hover:text-green-600 transition-all duration-200 text-left group cursor-pointer disabled:opacity-50"
                                >
                                    <span className="flex items-center gap-2">
                                        <FiPlay className="text-slate-400 group-hover:text-green-500" size={12} />
                                        <span>
                                            <span className="block">{wf.label}</span>
                                            <span className="text-[9px] text-slate-400 font-medium">{wf.desc}</span>
                                        </span>
                                    </span>
                                    {triggering === wf.id ? (
                                        <FiRefreshCw className="text-green-500 animate-spin" size={12} />
                                    ) : (
                                        <FiArrowUpRight className="text-slate-300 group-hover:text-green-500" size={12} />
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
