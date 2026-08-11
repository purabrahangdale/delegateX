import { useEffect, useState } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { getAutomationLogs } from "../services/whatsappApi";
import { useWebSockets } from "../../context/WebSocketContext";
import { FiSearch, FiFilter, FiClock, FiCheckCircle, FiXCircle, FiActivity, FiRefreshCw } from "react-icons/fi";

function WhatsAppLogs() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [workflowFilter, setWorkflowFilter] = useState("");
    const { whatsappSocket } = useWebSockets();

    const fetchLogs = async () => {
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (workflowFilter) params.workflow = workflowFilter;
            const data = await getAutomationLogs(params);
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error("Failed to load logs", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [statusFilter, workflowFilter]);

    useEffect(() => {
        if (!whatsappSocket) return;
        const handleEvent = (data) => {
            if (data.event === "automation_log_created") {
                setLogs(prev => [data.data, ...prev]);
                setTotal(prev => prev + 1);
            }
        };
        whatsappSocket.on("message", handleEvent);
        return () => whatsappSocket.off("message", handleEvent);
    }, [whatsappSocket]);

    const statusColors = {
        success: "text-emerald-600 bg-emerald-50 border-emerald-100",
        failed: "text-rose-600 bg-rose-50 border-rose-100",
        pending: "text-amber-600 bg-amber-50 border-amber-100",
        running: "text-blue-600 bg-blue-50 border-blue-100",
        skipped: "text-slate-500 bg-slate-50 border-slate-100",
    };

    const statusIcons = {
        success: FiCheckCircle,
        failed: FiXCircle,
        pending: FiClock,
        running: FiActivity,
        skipped: FiClock,
    };

    const uniqueWorkflows = [...new Set(logs.map(l => l.workflow_name).filter(Boolean))];

    const filteredLogs = logs.filter(log => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            log.workflow_name?.toLowerCase().includes(q) ||
            log.recipient?.toLowerCase().includes(q) ||
            log.message_preview?.toLowerCase().includes(q) ||
            log.trigger?.toLowerCase().includes(q)
        );
    });

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="h-96 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="logs" searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div className="flex-1 flex gap-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer focus:outline-none"
                    >
                        <option value="">All Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                        <option value="pending">Pending</option>
                        <option value="skipped">Skipped</option>
                    </select>
                    <select
                        value={workflowFilter}
                        onChange={(e) => setWorkflowFilter(e.target.value)}
                        className="px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer focus:outline-none"
                    >
                        <option value="">All Workflows</option>
                        {uniqueWorkflows.map(wf => <option key={wf} value={wf}>{wf}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">Total: {total}</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">Success: {logs.filter(l => l.status === "success").length}</span>
                    <button onClick={fetchLogs} className="p-2 text-slate-500 hover:text-emerald-600 rounded-xl hover:bg-emerald-50 transition cursor-pointer">
                        <FiRefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Logs Audit Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_8px_rgba(15,23,42,0.01)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workflow</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trigger</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recipient</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Message Preview</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length > 0 ? filteredLogs.map((log, idx) => {
                                const StatusIcon = statusIcons[log.status] || FiClock;
                                const colorClass = statusColors[log.status] || statusColors.pending;
                                return (
                                    <tr key={log._id || idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${colorClass}`}>
                                                <StatusIcon size={10} /> {log.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-semibold text-slate-700">{log.workflow_name}</td>
                                        <td className="px-4 py-3 text-[10px] text-slate-500">{log.trigger}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-slate-700 font-medium">{log.recipient}</span>
                                            {log.recipient_phone && <span className="text-[9px] text-slate-400 block font-mono">{log.recipient_phone}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-[10px] text-slate-400 max-w-xs truncate hidden lg:table-cell">{log.message_preview?.substring(0, 60)}</td>
                                        <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">{log.execution_duration_ms}ms</td>
                                        <td className="px-4 py-3 text-[10px] text-slate-400">{log.execution_time ? new Date(log.execution_time).toLocaleString() : "—"}</td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <FiActivity size={28} className="mx-auto text-slate-200 mb-2" />
                                        <p className="text-xs text-slate-400">No automation logs found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default WhatsAppLogs;
