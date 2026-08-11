import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import {
    getWhatsAppTemplateInsights,
    toggleWhatsAppTemplateFavorite,
    incrementWhatsAppTemplateView,
} from "../services/whatsappApi";
import {
    FiBarChart2, FiTrendingUp, FiEye, FiZap, FiCheckCircle, FiHeart,
    FiAward, FiStar, FiClock, FiSearch, FiFilter, FiArrowLeft, FiX,
    FiSend, FiUsers, FiLayers, FiFileText, FiRefreshCw, FiChevronRight,
    FiCheck
} from "react-icons/fi";

const BADGE_CONFIG = {
    top_performer: { label: "Top Performer", icon: "👑", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    most_used: { label: "Most Used", icon: "⭐", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    most_viewed: { label: "Most Viewed", icon: "👁", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    favorite: { label: "Favorite", icon: "❤️", bg: "bg-rose-50 text-rose-700 border-rose-200" },
    trending: { label: "Trending", icon: "🔥", bg: "bg-orange-50 text-orange-700 border-orange-200" },
    new: { label: "New", icon: "🆕", bg: "bg-blue-50 text-blue-700 border-blue-200" },
};

function WhatsAppTemplateInsights() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [insightsData, setInsightsData] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null); // Drawer details
    const [searchQuery, setSearchQuery] = useState("");

    // Sort & Filter state
    const [sortBy, setSortBy] = useState("score"); // 'score' | 'used' | 'views' | 'delivery' | 'read' | 'newest' | 'oldest' | 'alpha' | 'last_used'
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterContentType, setFilterContentType] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");

    const fetchInsights = async () => {
        try {
            const data = await getWhatsAppTemplateInsights();
            if (data) {
                setInsightsData(data);
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error("Failed to load template insights", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    const handleToggleFavorite = async (e, tmplId) => {
        e.stopPropagation();
        try {
            await toggleWhatsAppTemplateFavorite(tmplId);
            setTemplates((prev) =>
                prev.map((t) => (t._id === tmplId ? { ...t, is_favorite: !t.is_favorite } : t))
            );
            if (selectedTemplate && selectedTemplate._id === tmplId) {
                setSelectedTemplate((prev) => ({ ...prev, is_favorite: !prev.is_favorite }));
            }
        } catch (err) {
            console.error("Toggle favorite error", err);
        }
    };

    const handleRowClick = async (tmpl) => {
        setSelectedTemplate(tmpl);
        try {
            await incrementWhatsAppTemplateView(tmpl._id);
        } catch (err) {
            console.error("View increment error", err);
        }
    };

    // Filtered & Sorted Templates
    const processedTemplates = useMemo(() => {
        let result = [...templates];

        // 1. Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (t) =>
                    t.name.toLowerCase().includes(q) ||
                    t.category.toLowerCase().includes(q) ||
                    (t.content_type && t.content_type.toLowerCase().includes(q))
            );
        }

        // 2. Category Filter
        if (filterCategory !== "all") {
            result = result.filter((t) => t.category.toLowerCase() === filterCategory.toLowerCase());
        }

        // 3. Content Type Filter
        if (filterContentType !== "all") {
            result = result.filter((t) => (t.content_type || "text").toLowerCase() === filterContentType.toLowerCase());
        }

        // 4. Status Filter
        if (filterStatus !== "all") {
            const isAct = filterStatus === "active";
            result = result.filter((t) => (t.is_active ?? true) === isAct);
        }

        // 5. Sorting
        result.sort((a, b) => {
            if (sortBy === "score") return b.performance_score - a.performance_score;
            if (sortBy === "used") return (b.times_used || 0) - (a.times_used || 0);
            if (sortBy === "views") return (b.views || 0) - (a.views || 0);
            if (sortBy === "delivery") return b.delivery_rate - a.delivery_rate;
            if (sortBy === "read") return b.read_rate - a.read_rate;
            if (sortBy === "alpha") return a.name.localeCompare(b.name);
            if (sortBy === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            if (sortBy === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            if (sortBy === "last_used") return new Date(b.last_used_at || 0) - new Date(a.last_used_at || 0);
            return b.performance_score - a.performance_score;
        });

        return result;
    }, [templates, searchQuery, filterCategory, filterContentType, filterStatus, sortBy]);

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="h-24 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
                    ))}
                </div>
                <div className="h-72 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
            </div>
        );
    }

    const kpis = insightsData?.kpis || {};
    const charts = insightsData?.charts || {};

    return (
        <div className="space-y-6 mt-2 pb-16 animate-fade-in font-sans">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Link to="/whatsapp/dashboard" className="hover:text-slate-600 transition">
                    WhatsApp Automation
                </Link>
                <FiChevronRight size={12} className="text-slate-300" />
                <span className="text-slate-700 font-semibold">Template Insights</span>
            </nav>

            {/* Header Navigation */}
            <WhatsAppHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            {/* Title & Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/whatsapp/templates")}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-sm"
                        title="Back to Templates"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                                Template Insights & Analytics
                                <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Live Performance
                                </span>
                            </h1>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">
                            Real-time metrics, conversion analytics, automated performance ranking, and usage reports.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchInsights}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                        <FiRefreshCw size={13} /> Refresh Metrics
                    </button>
                    <button
                        onClick={() => navigate("/whatsapp/templates")}
                        className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                        <FiFileText size={13} /> View Templates
                    </button>
                </div>
            </div>

            {/* 8 TOP KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                    { label: "Total Templates", val: kpis.total_templates || 0, icon: FiFileText, color: "text-indigo-600", bg: "bg-indigo-50" },
                    { label: "Active Templates", val: kpis.active_templates || 0, icon: FiCheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Most Used", val: kpis.most_used_template || "N/A", icon: FiStar, color: "text-amber-600", bg: "bg-amber-50", isText: true },
                    { label: "Most Viewed", val: kpis.most_viewed_template || "N/A", icon: FiEye, color: "text-blue-600", bg: "bg-blue-50", isText: true },
                    { label: "Delivery Rate", val: kpis.highest_delivery_rate || "0%", icon: FiSend, color: "text-teal-600", bg: "bg-teal-50" },
                    { label: "Read Rate", val: kpis.highest_read_rate || "0%", icon: FiZap, color: "text-purple-600", bg: "bg-purple-50" },
                    { label: "Favorite Template", val: kpis.favorite_template || "N/A", icon: FiHeart, color: "text-rose-600", bg: "bg-rose-50", isText: true },
                    { label: "Top Score", val: `${kpis.top_performer_score || 0}`, icon: FiAward, color: "text-emerald-600", bg: "bg-emerald-100/70" },
                ].map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                    {card.label}
                                </span>
                                <span className={`p-1 rounded-lg ${card.bg} ${card.color}`}>
                                    <Icon size={12} />
                                </span>
                            </div>
                            <p className={`font-bold text-slate-900 font-display mt-2 ${card.isText ? "text-xs truncate" : "text-lg"}`} title={card.val}>
                                {card.val}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* CHART 1: Monthly Usage Trend */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                                <FiBarChart2 size={15} />
                            </span>
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 font-display">Monthly Template Usage</h3>
                                <p className="text-[10px] text-slate-400">Total template dispatches over the last 6 months</p>
                            </div>
                        </div>
                    </div>

                    {/* SVG Bar Chart */}
                    <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-100">
                        {charts.monthly_usage?.map((item, idx) => {
                            const maxU = 1200;
                            const heightPct = Math.min(100, Math.max(15, (item.usage / maxU) * 100));
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer">
                                    <span className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition">
                                        {item.usage}
                                    </span>
                                    <div
                                        style={{ height: `${heightPct}%` }}
                                        className="w-full max-w-[36px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg group-hover:from-emerald-500 group-hover:to-teal-400 transition-all duration-300 shadow-2xs"
                                    ></div>
                                    <span className="text-[10px] font-semibold text-slate-600 font-mono mt-1">
                                        {item.month}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CHART 2: Performance Trend (Weekly Delivery vs Read Rate) */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                                <FiTrendingUp size={15} />
                            </span>
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 font-display">Weekly Conversion & Read Rates</h3>
                                <p className="text-[10px] text-slate-400">Delivery % vs Read % across all active templates</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-emerald-600">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Delivery
                            </span>
                            <span className="flex items-center gap-1 text-indigo-600">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span> Read
                            </span>
                        </div>
                    </div>

                    {/* SVG Dual Bar Comparison Chart */}
                    <div className="h-44 flex items-end justify-between gap-2 pt-4 px-2 border-b border-slate-100">
                        {charts.performance_trend?.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                                <div className="flex items-end gap-1 w-full justify-center h-full">
                                    {/* Delivery Bar */}
                                    <div
                                        style={{ height: `${item.delivery_rate - 20}%` }}
                                        className="w-3 bg-emerald-500 rounded-t-sm transition-all duration-300"
                                        title={`Delivery: ${item.delivery_rate}%`}
                                    ></div>
                                    {/* Read Bar */}
                                    <div
                                        style={{ height: `${item.read_rate - 20}%` }}
                                        className="w-3 bg-indigo-500 rounded-t-sm transition-all duration-300"
                                        title={`Read: ${item.read_rate}%`}
                                    ></div>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 font-mono mt-1">
                                    {item.day}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* SORT & FILTER TOOLBAR */}
            <div className="bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FiFilter size={12} /> Sort By:
                    </span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-semibold cursor-pointer"
                    >
                        <option value="score">🏆 Performance Score</option>
                        <option value="used">⭐ Most Used</option>
                        <option value="views">👁 Most Viewed</option>
                        <option value="delivery">⚡ Highest Delivery Rate</option>
                        <option value="read">📖 Highest Read Rate</option>
                        <option value="newest">🆕 Newest Created</option>
                        <option value="oldest">⏳ Oldest Created</option>
                        <option value="alpha">🔤 Alphabetical (A-Z)</option>
                        <option value="last_used">🕒 Last Used</option>
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-medium cursor-pointer"
                    >
                        <option value="all">All Template Types</option>
                        <option value="notification">Notification</option>
                        <option value="reminder">Reminder</option>
                        <option value="onboarding">Onboarding</option>
                        <option value="utility">Utility</option>
                        <option value="marketing">Marketing</option>
                    </select>

                    {/* Content Type Filter */}
                    <select
                        value={filterContentType}
                        onChange={(e) => setFilterContentType(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-medium cursor-pointer"
                    >
                        <option value="all">All Content Types</option>
                        <option value="text">Text</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="document">Document</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-medium cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                    </select>
                </div>
            </div>

            {/* TEMPLATE PERFORMANCE TABLE */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 font-display">Template Performance Rankings</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Click any template row to view complete analytics, message history & details.</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-mono">
                        Showing {processedTemplates.length} templates
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Rank</th>
                                <th className="py-3 px-4">Template Name</th>
                                <th className="py-3 px-4">Type</th>
                                <th className="py-3 px-4 text-center">Views</th>
                                <th className="py-3 px-4 text-center">Times Used</th>
                                <th className="py-3 px-4 text-center">Sent</th>
                                <th className="py-3 px-4 text-center">Delivered</th>
                                <th className="py-3 px-4 text-center">Read</th>
                                <th className="py-3 px-4 text-center">Delivery %</th>
                                <th className="py-3 px-4 text-center">Read %</th>
                                <th className="py-3 px-4 text-center">Score</th>
                                <th className="py-3 px-4 text-center">Fav</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {processedTemplates.length > 0 ? (
                                processedTemplates.map((tmpl, idx) => {
                                    const rankNum = idx + 1;
                                    return (
                                        <tr
                                            key={tmpl._id}
                                            onClick={() => handleRowClick(tmpl)}
                                            className="hover:bg-emerald-50/40 transition cursor-pointer group"
                                        >
                                            {/* Rank */}
                                            <td className="py-3.5 px-4 font-bold font-mono">
                                                {rankNum === 1 ? (
                                                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-extrabold text-[11px] border border-amber-200">
                                                        👑 1
                                                    </span>
                                                ) : rankNum === 2 ? (
                                                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-extrabold text-[11px]">
                                                        2
                                                    </span>
                                                ) : rankNum === 3 ? (
                                                    <span className="w-6 h-6 rounded-full bg-amber-700/10 text-amber-800 flex items-center justify-center font-extrabold text-[11px]">
                                                        3
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 pl-1">#{rankNum}</span>
                                                )}
                                            </td>

                                            {/* Name & Badges */}
                                            <td className="py-3.5 px-4 font-medium text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold font-display group-hover:text-emerald-600 transition">
                                                        {tmpl.name}
                                                    </span>
                                                    {tmpl.badges?.map((badge, bIdx) => (
                                                        <span
                                                            key={bIdx}
                                                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.bg || "bg-slate-100 border-slate-200 text-slate-600"}`}
                                                            title={badge.label}
                                                        >
                                                            {badge.icon} {badge.label}
                                                        </span>
                                                    ))}
                                                </div>
                                                {tmpl.description && (
                                                    <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">{tmpl.description}</p>
                                                )}
                                            </td>

                                            {/* Category / Type */}
                                            <td className="py-3.5 px-4">
                                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 uppercase">
                                                    {tmpl.category}
                                                </span>
                                            </td>

                                            {/* Views */}
                                            <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-600">
                                                {tmpl.views || 0}
                                            </td>

                                            {/* Times Used */}
                                            <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-600">
                                                {tmpl.times_used || 0}
                                            </td>

                                            {/* Sent */}
                                            <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                                                {tmpl.messages_sent || 0}
                                            </td>

                                            {/* Delivered */}
                                            <td className="py-3.5 px-4 text-center font-mono text-emerald-600 font-semibold">
                                                {tmpl.delivered_count || 0}
                                            </td>

                                            {/* Read */}
                                            <td className="py-3.5 px-4 text-center font-mono text-indigo-600 font-semibold">
                                                {tmpl.read_count || 0}
                                            </td>

                                            {/* Delivery Rate */}
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                                                    {tmpl.delivery_rate}%
                                                </span>
                                            </td>

                                            {/* Read Rate */}
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                    {tmpl.read_rate}%
                                                </span>
                                            </td>

                                            {/* Score */}
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                                                    {tmpl.performance_score}
                                                </span>
                                            </td>

                                            {/* Favorite */}
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={(e) => handleToggleFavorite(e, tmpl._id)}
                                                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                                >
                                                    <FiHeart size={14} className={tmpl.is_favorite ? "fill-rose-500 text-rose-500" : ""} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="12" className="py-12 text-center text-slate-400 text-xs">
                                        No template performance records match your current filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TEMPLATE DETAILS DRAWER */}
            {selectedTemplate && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in" onClick={() => setSelectedTemplate(null)}></div>

                    <div className="relative bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 p-6 overflow-y-auto space-y-6 animate-slide-left font-sans">
                        {/* Drawer Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold font-display text-slate-900">{selectedTemplate.name}</h2>
                                    <button
                                        onClick={(e) => handleToggleFavorite(e, selectedTemplate._id)}
                                        className="text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                    >
                                        <FiHeart size={16} className={selectedTemplate.is_favorite ? "fill-rose-500 text-rose-500" : ""} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 uppercase">
                                        {selectedTemplate.category}
                                    </span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 font-mono">
                                        Score: {selectedTemplate.performance_score}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* KPI Cards Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Times Used</span>
                                <span className="text-base font-bold text-slate-800 font-mono">{selectedTemplate.times_used || 0}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Views</span>
                                <span className="text-base font-bold text-slate-800 font-mono">{selectedTemplate.views || 0}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Campaigns</span>
                                <span className="text-base font-bold text-slate-800 font-mono">{selectedTemplate.campaigns_count || 0}</span>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                                <span className="text-[9px] font-bold text-emerald-600 uppercase block">Delivery Rate</span>
                                <span className="text-base font-bold text-emerald-800 font-mono">{selectedTemplate.delivery_rate}%</span>
                            </div>
                            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center">
                                <span className="text-[9px] font-bold text-indigo-600 uppercase block">Read Rate</span>
                                <span className="text-base font-bold text-indigo-800 font-mono">{selectedTemplate.read_rate}%</span>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
                                <span className="text-[9px] font-bold text-purple-600 uppercase block">Reply Rate</span>
                                <span className="text-base font-bold text-purple-800 font-mono">{selectedTemplate.reply_rate}%</span>
                            </div>
                        </div>

                        {/* Live WhatsApp Bubble Preview */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Template Preview</h4>
                            <div className="bg-[#DCF8C6] text-slate-900 rounded-2xl rounded-tr-none p-4 shadow-xs border border-emerald-200/80">
                                <p className="text-xs leading-relaxed whitespace-pre-wrap font-mono">{selectedTemplate.content}</p>
                                <div className="flex items-center justify-end gap-1 mt-2 text-[8px] text-slate-400">
                                    <span>10:42 AM</span>
                                    <span className="flex -space-x-1 text-blue-500"><FiCheck size={10} /><FiCheck size={10} /></span>
                                </div>
                            </div>
                        </div>

                        {/* Variables */}
                        {selectedTemplate.variables?.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Associated Variables</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedTemplate.variables.map((v, i) => (
                                        <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-mono font-bold border border-indigo-100">
                                            {`{{${v}}}`}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Detailed Metrics List */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Message Metrics</h4>
                            <div className="space-y-1.5 text-xs text-slate-600">
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span>Total Messages Sent:</span>
                                    <span className="font-mono font-bold text-slate-800">{selectedTemplate.messages_sent || 0}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span>Delivered Messages:</span>
                                    <span className="font-mono font-bold text-emerald-600">{selectedTemplate.delivered_count || 0}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span>Read Messages:</span>
                                    <span className="font-mono font-bold text-indigo-600">{selectedTemplate.read_count || 0}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span>Failed Messages:</span>
                                    <span className="font-mono font-bold text-rose-500">{selectedTemplate.failed_count || 0}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span>Last Used Timestamp:</span>
                                    <span className="font-mono text-slate-500">{selectedTemplate.last_used_at || "Recently"}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedTemplate(null)}
                            className="w-full py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                        >
                            Close Analytics Drawer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppTemplateInsights;
