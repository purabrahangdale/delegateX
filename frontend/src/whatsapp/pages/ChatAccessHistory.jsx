import { useEffect, useState } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { getChatAccessLogs, getChatAccessStats, exportChatAccessLogsExcel } from "../services/whatsappApi";
import {
    FiEye, FiUsers, FiCheckCircle, FiXCircle, FiPercent,
    FiFilter, FiDownload, FiSearch, FiRefreshCw, FiCalendar,
    FiUserCheck, FiCornerDownLeft, FiChevronLeft, FiChevronRight,
    FiClock, FiMessageSquare
} from "react-icons/fi";

function ChatAccessHistory() {
    // Data & UI states
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({
        total_openings: 0,
        replied_count: 0,
        unreplied_count: 0,
        unique_managers: 0,
        unique_customers: 0,
        reply_rate: 0,
    });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [managerFilter, setManagerFilter] = useState("all");
    const [repliedFilter, setRepliedFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const limit = 20;

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const params = {
                skip: (page - 1) * limit,
                limit: limit,
            };
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (managerFilter !== "all") params.manager = managerFilter;
            if (repliedFilter !== "all") params.replied = repliedFilter;
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;

            const res = await getChatAccessLogs(params);
            setLogs(res.access_logs || []);
            setTotal(res.total || 0);

            const statRes = await getChatAccessStats();
            if (statRes) setStats(statRes);
        } catch (err) {
            console.error("Failed to load chat access history", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuditLogs();
    }, [page, managerFilter, repliedFilter, fromDate, toDate]);

    // Handle Search with debounce / submit
    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setPage(1);
        fetchAuditLogs();
    };

    const handleResetFilters = () => {
        setSearchQuery("");
        setManagerFilter("all");
        setRepliedFilter("all");
        setFromDate("");
        setToDate("");
        setPage(1);
    };

    const handleExportExcel = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            const params = {};
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (managerFilter !== "all") params.manager = managerFilter;
            if (repliedFilter !== "all") params.replied = repliedFilter;
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;

            await exportChatAccessLogsExcel(params);
        } catch (err) {
            console.error("Failed to export chat access history", err);
        } finally {
            setExporting(false);
        }
    };

    const formatDateStr = (isoStr) => {
        if (!isoStr) return "—";
        try {
            const dt = new Date(isoStr);
            if (isNaN(dt.getTime())) return isoStr;
            return dt.toLocaleString("en-US", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            });
        } catch {
            return isoStr;
        }
    };

    const totalPages = Math.ceil(total / limit) || 1;

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in font-sans">
            {/* Main Header */}
            <WhatsAppHeader
                activeTab="access-history"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
                {/* Total Openings */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition hover:border-slate-300">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Openings</span>
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <FiEye size={15} />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                            {stats.total_openings.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Distinct chat access events</p>
                    </div>
                </div>

                {/* Unique Managers */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition hover:border-slate-300">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unique Managers</span>
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                            <FiUsers size={15} />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                            {stats.unique_managers.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Active auditing managers</p>
                    </div>
                </div>

                {/* Replied Count */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition hover:border-slate-300">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Replied</span>
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <FiCheckCircle size={15} />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold font-display text-emerald-600 tracking-tight">
                            {stats.replied_count.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Manager sent reply</p>
                    </div>
                </div>

                {/* Unreplied Count */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition hover:border-slate-300">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Not Replied</span>
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                            <FiXCircle size={15} />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold font-display text-amber-600 tracking-tight">
                            {stats.unreplied_count.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Opened without reply</p>
                    </div>
                </div>

                {/* Reply Rate */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition hover:border-slate-300 col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reply Conversion</span>
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                            <FiPercent size={15} />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                            {stats.reply_rate}%
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Audit response rate</p>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar & Audit Controls */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_12px_rgba(15,23,42,0.02)] space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                            <FiFilter size={14} />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold font-display text-slate-900">Chat Access Audit Logs</h3>
                            <p className="text-[10px] text-slate-500 font-medium">Filter and inspect manager conversation access history</p>
                        </div>
                    </div>

                    {/* Actions: Refresh & Excel Export */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchAuditLogs}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer text-xs font-medium flex items-center gap-1.5"
                            title="Refresh Audit Logs"
                        >
                            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>

                        <button
                            onClick={handleExportExcel}
                            disabled={exporting}
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
                        >
                            <FiDownload size={13} className={exporting ? "animate-bounce" : ""} />
                            <span>{exporting ? "Generating Excel..." : "Export Excel (.xlsx)"}</span>
                        </button>
                    </div>
                </div>

                {/* Filter Controls Inputs Grid */}
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
                    {/* Search Field */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-3 text-slate-400" size={13} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Manager, customer or phone..."
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 font-sans"
                        />
                    </div>

                    {/* Replied Filter */}
                    <div>
                        <select
                            value={repliedFilter}
                            onChange={(e) => { setRepliedFilter(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 font-sans font-medium text-slate-700 cursor-pointer"
                        >
                            <option value="all">All Reply Statuses</option>
                            <option value="yes">Replied (YES)</option>
                            <option value="no">Not Replied (NO)</option>
                        </select>
                    </div>

                    {/* From Date */}
                    <div className="relative">
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 font-sans font-medium text-slate-700 cursor-pointer"
                        />
                    </div>

                    {/* To Date */}
                    <div className="relative">
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 font-sans font-medium text-slate-700 cursor-pointer"
                        />
                    </div>

                    {/* Reset Button */}
                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                            Apply Search
                        </button>
                        {(searchQuery || managerFilter !== "all" || repliedFilter !== "all" || fromDate || toDate) && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer"
                                title="Reset all filters"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Audit Logs Data Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_12px_rgba(15,23,42,0.02)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="py-3.5 px-4 text-center w-12">#</th>
                                <th className="py-3.5 px-4">Manager</th>
                                <th className="py-3.5 px-4">Customer</th>
                                <th className="py-3.5 px-4">Phone Number</th>
                                <th className="py-3.5 px-4 text-center">Chat Opened At</th>
                                <th className="py-3.5 px-4 text-center">Replied?</th>
                                <th className="py-3.5 px-4 text-center">Reply Time</th>
                                <th className="py-3.5 px-4">Campaign / Template</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-sans">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, idx) => (
                                    <tr key={idx} className="animate-pulse">
                                        <td className="py-4 px-4 text-center"><div className="h-3 w-4 bg-slate-100 rounded mx-auto"></div></td>
                                        <td className="py-4 px-4"><div className="h-3 w-28 bg-slate-100 rounded"></div></td>
                                        <td className="py-4 px-4"><div className="h-3 w-24 bg-slate-100 rounded"></div></td>
                                        <td className="py-4 px-4"><div className="h-3 w-24 bg-slate-100 rounded"></div></td>
                                        <td className="py-4 px-4 text-center"><div className="h-3 w-32 bg-slate-100 rounded mx-auto"></div></td>
                                        <td className="py-4 px-4 text-center"><div className="h-3 w-12 bg-slate-100 rounded mx-auto"></div></td>
                                        <td className="py-4 px-4 text-center"><div className="h-3 w-28 bg-slate-100 rounded mx-auto"></div></td>
                                        <td className="py-4 px-4"><div className="h-3 w-24 bg-slate-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <FiEye size={32} className="text-slate-300" />
                                            <p className="text-xs font-medium text-slate-500">No chat access audit records found.</p>
                                            <p className="text-[10px] text-slate-400">Opening customer conversations in the Inbox will automatically record access events here.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, index) => {
                                    const rowNum = (page - 1) * limit + index + 1;
                                    const isReplied = log.replied_to_customer;
                                    return (
                                        <tr key={log._id || index} className="hover:bg-slate-50/60 transition-colors">
                                            {/* Row Index */}
                                            <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-400 font-semibold">
                                                {rowNum}
                                            </td>

                                            {/* Manager */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                                                        {(log.manager_name || "A")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 leading-tight">{log.manager_name || "Admin User"}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">{log.manager_email || "admin@delegatex.com"}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Customer */}
                                            <td className="py-3.5 px-4">
                                                <p className="font-semibold text-slate-800">{log.contact_name || "Customer"}</p>
                                            </td>

                                            {/* Phone Number */}
                                            <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                                                {log.contact_phone || "—"}
                                            </td>

                                            {/* Opened At */}
                                            <td className="py-3.5 px-4 text-center text-slate-600 font-mono text-[11px]">
                                                <div className="inline-flex items-center gap-1 bg-slate-100/70 text-slate-700 px-2 py-0.5 rounded border border-slate-200/50">
                                                    <FiClock size={11} className="text-slate-400" />
                                                    <span>{formatDateStr(log.chat_opened_at)}</span>
                                                </div>
                                            </td>

                                            {/* Replied? */}
                                            <td className="py-3.5 px-4 text-center">
                                                {isReplied ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200/70">
                                                        <FiCheckCircle size={11} className="text-emerald-600" />
                                                        <span>YES</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                                                        <FiXCircle size={11} className="text-slate-400" />
                                                        <span>NO</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Reply Time */}
                                            <td className="py-3.5 px-4 text-center text-slate-600 font-mono text-[11px]">
                                                {isReplied ? (
                                                    <span className="text-emerald-700 font-semibold">{formatDateStr(log.reply_time)}</span>
                                                ) : (
                                                    <span className="text-slate-300 font-sans">—</span>
                                                )}
                                            </td>

                                            {/* Campaign / Template */}
                                            <td className="py-3.5 px-4">
                                                {log.campaign_name || log.template_name ? (
                                                    <div className="space-y-0.5">
                                                        {log.campaign_name && (
                                                            <p className="text-[10px] font-bold text-indigo-600">{log.campaign_name}</p>
                                                        )}
                                                        {log.template_name && (
                                                            <p className="text-[9px] text-slate-500">{log.template_name}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-[10px]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {total > 0 && (
                    <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                        <div>
                            Showing <span className="font-semibold text-slate-800">{(page - 1) * limit + 1}</span> to{" "}
                            <span className="font-semibold text-slate-800">{Math.min(page * limit, total)}</span> of{" "}
                            <span className="font-semibold text-slate-800">{total}</span> access records
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium cursor-pointer flex items-center gap-1"
                            >
                                <FiChevronLeft size={13} />
                                <span>Previous</span>
                            </button>

                            <span className="px-3 py-1 font-bold text-slate-700 bg-slate-200/50 rounded-lg">
                                {page} / {totalPages}
                            </span>

                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium cursor-pointer flex items-center gap-1"
                            >
                                <span>Next</span>
                                <FiChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatAccessHistory;
