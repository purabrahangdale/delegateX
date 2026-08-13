import { useState, useEffect } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import {
    FiBarChart2, FiTrendingUp, FiDownload, FiCheckCircle, FiEye,
    FiMessageSquare, FiAlertCircle, FiPieChart, FiFilter, FiCalendar,
    FiRefreshCw, FiSearch, FiUser, FiFileText, FiTag, FiClock, FiInbox
} from "react-icons/fi";
import {
    getCustomerReplies,
    getCustomerReplyStats,
    exportCustomerRepliesExcel,
    getWhatsAppTemplateNames
} from "../services/whatsappApi";

function WhatsAppReports() {
    const [activeTab, setActiveTab] = useState("replies"); // "overview" | "replies"
    const [timeframe, setTimeframe] = useState("weekly");

    // Reply Report States
    const [replies, setReplies] = useState([]);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({
        total_replies: 0,
        today_replies: 0,
        unread_replies: 0,
        unique_customers: 0,
        text_replies: 0,
        media_replies: 0,
    });
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [templateNames, setTemplateNames] = useState([]);

    // Filters State
    const [filters, setFilters] = useState({
        from_date: "",
        to_date: "",
        campaign: "",
        template: "",
        contact: "",
        assigned_agent: "",
        reply_type: "",
        source: "",
        mode: "",
        status: "",
        search: "",
    });

    const fetchRepliesData = async () => {
        setLoading(true);
        try {
            const cleanParams = {};
            Object.keys(filters).forEach((key) => {
                if (filters[key]) cleanParams[key] = filters[key];
            });

            const data = await getCustomerReplies(cleanParams);
            setReplies(data.replies || []);
            setTotal(data.total || 0);
            if (data.stats) setStats(data.stats);
        } catch (err) {
            console.error("Failed to fetch replies:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "replies") {
            fetchRepliesData();
        }
    }, [activeTab, filters]);

    useEffect(() => {
        const fetchInitialMeta = async () => {
            const names = await getWhatsAppTemplateNames();
            setTemplateNames(names || []);
            const replyStats = await getCustomerReplyStats();
            if (replyStats) setStats(replyStats);
        };
        fetchInitialMeta();
    }, []);

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleResetFilters = () => {
        setFilters({
            from_date: "",
            to_date: "",
            campaign: "",
            template: "",
            contact: "",
            assigned_agent: "",
            reply_type: "",
            source: "",
            mode: "",
            status: "",
            search: "",
        });
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const cleanParams = {};
            Object.keys(filters).forEach((key) => {
                if (filters[key]) cleanParams[key] = filters[key];
            });
            await exportCustomerRepliesExcel(cleanParams);
        } catch (err) {
            console.error("Export failed:", err);
        } finally {
            setExporting(false);
        }
    };

    const formatTimestamp = (raw) => {
        if (!raw) return { date: "-", time: "-" };
        try {
            const dt = new Date(raw);
            if (isNaN(dt.getTime())) return { date: raw, time: "" };
            return {
                date: dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
                time: dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
            };
        } catch {
            return { date: raw, time: "" };
        }
    };

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="reports" />

            {/* Top Report Section Selector */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 font-display">WhatsApp Reports & Analytics</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Comprehensive customer replies export, delivery rates, and messaging metrics.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab("replies")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === "replies" ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                        <FiMessageSquare size={13} />
                        <span>Customer Replies Report</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === "overview" ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                        <FiBarChart2 size={13} />
                        <span>Executive Performance</span>
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* CUSTOMER REPLIES REPORT TAB                                 */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "replies" && (
                <div className="space-y-6 animate-fade-in">
                    {/* Reply Summary KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Customer Replies</span>
                            <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-extrabold font-display text-slate-900">{stats.total_replies || 0}</span>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Live DB</span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Green vs. Red Button Clicks</span>
                            <div className="flex items-baseline justify-between mt-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-lg font-extrabold font-display text-emerald-600">🟢 {replies.filter(r => (r.metadata?.button_color === "green" || r.button_color === "green" || ["YES", "ACCEPT", "INTERESTED", "CONFIRM", "AGREE"].some(t => (r.content || "").toUpperCase().includes(t)))).length}</span>
                                    <span className="text-slate-300 text-xs">/</span>
                                    <span className="text-lg font-extrabold font-display text-rose-600">🔴 {replies.filter(r => (r.metadata?.button_color === "red" || r.button_color === "red" || ["NO", "DECLINE", "NOT INTERESTED", "CANCEL", "REJECT"].some(t => (r.content || "").toUpperCase().includes(t)))).length}</span>
                                </div>
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">Buttons</span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unique Customers</span>
                            <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-extrabold font-display text-indigo-600">{stats.unique_customers || 0}</span>
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">Contacts</span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Text vs. Media Replies</span>
                            <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-extrabold font-display text-blue-600">{stats.text_replies || 0} / {stats.media_replies || 0}</span>
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">Ratio</span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unread Replies</span>
                            <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-extrabold font-display text-amber-600">{stats.unread_replies || 0}</span>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">Pending</span>
                            </div>
                        </div>
                    </div>

                    {/* Report Filter & Export Controls Card */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <FiFilter size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 font-display">Customer Replies Filter & Export</h3>
                                    <p className="text-xs text-slate-400">Filter replies by date, campaign, template, or mode, then export directly to Excel.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleResetFilters}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                >
                                    <FiRefreshCw size={12} />
                                    <span>Reset Filters</span>
                                </button>

                                <button
                                    onClick={handleExportExcel}
                                    disabled={exporting}
                                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                                >
                                    <FiDownload size={14} className={exporting ? "animate-bounce" : ""} />
                                    <span>{exporting ? "Generating Excel..." : "Export Excel (.xlsx)"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Interactive Filters Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Date Range - From */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
                                <div className="relative flex items-center">
                                    <FiCalendar className="absolute left-3 text-slate-400" size={13} />
                                    <input
                                        type="date"
                                        value={filters.from_date}
                                        onChange={(e) => handleFilterChange("from_date", e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                    />
                                </div>
                            </div>

                            {/* Date Range - To */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
                                <div className="relative flex items-center">
                                    <FiCalendar className="absolute left-3 text-slate-400" size={13} />
                                    <input
                                        type="date"
                                        value={filters.to_date}
                                        onChange={(e) => handleFilterChange("to_date", e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                    />
                                </div>
                            </div>

                            {/* Campaign */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Campaign</label>
                                <input
                                    type="text"
                                    placeholder="Filter by Campaign Name..."
                                    value={filters.campaign}
                                    onChange={(e) => handleFilterChange("campaign", e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                />
                            </div>

                            {/* Template */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Template</label>
                                <select
                                    value={filters.template}
                                    onChange={(e) => handleFilterChange("template", e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 text-slate-700"
                                >
                                    <option value="">All Templates</option>
                                    {templateNames.map((n) => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Reply Type */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reply Type</label>
                                <select
                                    value={filters.reply_type}
                                    onChange={(e) => handleFilterChange("reply_type", e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 text-slate-700"
                                >
                                    <option value="">All Types</option>
                                    <option value="text">Text</option>
                                    <option value="image">Image</option>
                                    <option value="video">Video</option>
                                    <option value="document">Document</option>
                                    <option value="interactive">Interactive / Button</option>
                                </select>
                            </div>

                            {/* Source */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source</label>
                                <select
                                    value={filters.source}
                                    onChange={(e) => handleFilterChange("source", e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 text-slate-700"
                                >
                                    <option value="">All Sources</option>
                                    <option value="simulation">Simulation Mode</option>
                                    <option value="meta_webhook">Meta WhatsApp Webhook</option>
                                    <option value="manual">Manual Entry</option>
                                </select>
                            </div>

                            {/* Mode */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mode</label>
                                <select
                                    value={filters.mode}
                                    onChange={(e) => handleFilterChange("mode", e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 text-slate-700"
                                >
                                    <option value="">All Modes</option>
                                    <option value="simulation">Simulation Mode</option>
                                    <option value="meta_cloud">Real WhatsApp (Meta Cloud)</option>
                                </select>
                            </div>

                            {/* Search Keyword */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Keywords</label>
                                <div className="relative flex items-center">
                                    <FiSearch className="absolute left-3 text-slate-400" size={13} />
                                    <input
                                        type="text"
                                        placeholder="Search message text, customer..."
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange("search", e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Customer Replies Data Table */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Customer Reply Log Records</h3>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                    {total} {total === 1 ? "Record" : "Records"}
                                </span>
                            </div>

                            <span className="text-[11px] text-slate-400">
                                Showing latest incoming messages stored in database
                            </span>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 font-medium">
                                <FiRefreshCw className="animate-spin text-emerald-500" size={20} />
                                <span>Loading customer replies from database...</span>
                            </div>
                        ) : replies.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                                <FiInbox size={28} className="text-slate-300" />
                                <span className="font-semibold text-slate-600">No customer replies found matching filters</span>
                                <span className="text-[11px] text-slate-400">Try adjusting your date range or clearing filter parameters.</span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/70 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                            <th className="py-3 px-4">#</th>
                                            <th className="py-3 px-4">Date & Time</th>
                                            <th className="py-3 px-4">Customer</th>
                                            <th className="py-3 px-4">Campaign & Template</th>
                                            <th className="py-3 px-4">Customer Reply</th>
                                            <th className="py-3 px-4">Type</th>
                                            <th className="py-3 px-4">Source & Mode</th>
                                            <th className="py-3 px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-sans">
                                        {replies.map((r, i) => {
                                            const { date, time } = formatTimestamp(r.created_at);
                                            const meta = r.metadata || {};
                                            const campName = r.campaign_name || meta.campaign_name || r.automation_workflow || "";
                                            const tmplName = r.template_name || meta.template_name || "";
                                            const src = r.source || meta.source || "simulation";
                                            const modeVal = r.mode || meta.mode || "simulation";
                                            const replyTypeVal = (r.reply_type || r.message_type || "text").toLowerCase();

                                            const btnColor = meta.button_color || r.button_color;
                                            const contentUpper = (r.content || "").toUpperCase();
                                            const isGreenResponse = btnColor === "green" || ["YES", "ACCEPT", "INTERESTED", "CONFIRM", "AGREE", "POSITIVE"].some(term => contentUpper.includes(term));
                                            const isRedResponse = btnColor === "red" || ["NO", "DECLINE", "NOT INTERESTED", "CANCEL", "REJECT", "NEGATIVE"].some(term => contentUpper.includes(term));

                                            return (
                                                <tr key={r._id || i} className="hover:bg-slate-50/80 transition duration-150">
                                                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <div className="font-semibold text-slate-800">{date}</div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            <FiClock size={10} />
                                                            <span>{time}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                            <FiUser size={12} className="text-slate-400 shrink-0" />
                                                            <span>{r.sender || "Customer"}</span>
                                                        </div>
                                                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{r.sender_phone || "-"}</div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {campName ? (
                                                            <div className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 mb-1">
                                                                <FiTag size={10} />
                                                                <span>{campName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 italic text-[11px]">-</span>
                                                        )}
                                                        {tmplName && (
                                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                                <FiFileText size={10} className="text-slate-400" />
                                                                <span>{tmplName}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 max-w-xs">
                                                        {isGreenResponse ? (
                                                            <div className="space-y-1">
                                                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-md text-[9px] shadow-2xs">
                                                                    <FiCheckCircle size={10} className="text-emerald-600 shrink-0" />
                                                                    <span>GREEN RESPONSE OPTION</span>
                                                                </span>
                                                                <p className="text-emerald-950 font-semibold text-xs leading-relaxed">
                                                                    "{r.content}"
                                                                </p>
                                                            </div>
                                                        ) : isRedResponse ? (
                                                            <div className="space-y-1">
                                                                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 font-bold px-2 py-0.5 rounded-md text-[9px] shadow-2xs">
                                                                    <FiAlertCircle size={10} className="text-rose-600 shrink-0" />
                                                                    <span>RED RESPONSE OPTION</span>
                                                                </span>
                                                                <p className="text-rose-950 font-semibold text-xs leading-relaxed">
                                                                    "{r.content}"
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-slate-800 font-medium leading-relaxed line-clamp-2">
                                                                "{r.content}"
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        {isGreenResponse ? (
                                                            <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                Green Button
                                                            </span>
                                                        ) : isRedResponse ? (
                                                            <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border bg-rose-50 text-rose-700 border-rose-200">
                                                                Red Button
                                                            </span>
                                                        ) : (
                                                            <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                                                replyTypeVal === "text"
                                                                    ? "bg-slate-100 text-slate-700 border-slate-200"
                                                                    : "bg-blue-50 text-blue-700 border-blue-100"
                                                            }`}>
                                                                {replyTypeVal}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border w-max ${
                                                                src === "meta_webhook"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                            }`}>
                                                                {src === "meta_webhook" ? "Meta Webhook" : "Simulation"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                            <FiCheckCircle size={10} />
                                                            <span>Received</span>
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* EXECUTIVE PERFORMANCE OVERVIEW TAB                          */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "overview" && (
                <div className="space-y-6 animate-fade-in">
                    {/* Timeframe Selector */}
                    <div className="flex items-center justify-between bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                        <span className="text-xs font-bold text-slate-700">Analytics Timeframe</span>
                        <div className="flex items-center gap-2">
                            {["daily", "weekly", "monthly"].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTimeframe(t)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${timeframe === t ? "bg-emerald-500 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { title: "Total Messages", value: "14,280", trend: "+12.4%", isUp: true, color: "text-slate-800" },
                            { title: "Delivered Rate", value: "98.4%", trend: "+2.1%", isUp: true, color: "text-emerald-600" },
                            { title: "Read Engagement", value: "86.2%", trend: "+4.5%", isUp: true, color: "text-blue-600" },
                            { title: "Customer Replies", value: stats.total_replies ? stats.total_replies.toLocaleString() : "3,410", trend: "+8.9%", isUp: true, color: "text-indigo-600" },
                            { title: "Delivery Failures", value: "1.6%", trend: "-0.4%", isUp: true, color: "text-rose-600" },
                        ].map((c, i) => (
                            <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{c.title}</span>
                                <div className="flex items-baseline justify-between mt-2">
                                    <span className={`text-2xl font-extrabold font-display ${c.color}`}>{c.value}</span>
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">{c.trend}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Visual Performance Charts Placeholder Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 font-display flex items-center justify-between">
                                <span>Daily Delivery vs. Read Volume</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Interactive Bar Chart</span>
                            </h3>
                            <div className="h-64 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs font-mono">
                                [ Visual Bar Chart: 14k Sent | 13.9k Delivered | 12.1k Read ]
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 font-display flex items-center justify-between">
                                <span>Automation Workflow ROI Breakdown</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Donut Breakdown</span>
                            </h3>
                            <div className="h-64 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs font-mono">
                                [ Donut Chart: Welcome (40%) | Follow-ups (35%) | Meetings (25%) ]
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppReports;

