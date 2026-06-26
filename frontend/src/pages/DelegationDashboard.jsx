import { useState } from "react";
import {
    FiRefreshCw, FiBookOpen, FiCheckCircle, FiActivity,
    FiClock, FiAlertTriangle, FiLayers, FiTrendingUp,
    FiTarget, FiCalendar, FiGrid, FiMoreHorizontal
} from "react-icons/fi";

/* ─── Primary KPI data (status cards) ─────────────────────────────── */
const PRIMARY_KPI = [
    {
        label: "Active",
        value: "6",
        bgColor: "bg-[#EEF1F6]",
        iconColor: "text-slate-600 bg-white/60",
        watermarkColor: "text-slate-400/10",
        icon: FiActivity,
    },
    {
        label: "Pending",
        value: "3",
        bgColor: "bg-[#FCF8EC]",
        iconColor: "text-amber-600 bg-white/60",
        watermarkColor: "text-amber-500/10",
        icon: FiClock,
    },
    {
        label: "In Progress",
        value: "3",
        bgColor: "bg-[#EEF5F2]",
        iconColor: "text-emerald-700 bg-white/60",
        watermarkColor: "text-emerald-600/10",
        icon: FiLayers,
    },
    {
        label: "In Review",
        value: "0",
        bgColor: "bg-[#FCF2EB]",
        iconColor: "text-orange-600 bg-white/60",
        watermarkColor: "text-orange-500/10",
        icon: FiTarget,
    },
    {
        label: "Overdue",
        value: "4",
        bgColor: "bg-[#FDF0EE]",
        iconColor: "text-rose-600 bg-white/60",
        watermarkColor: "text-rose-500/10",
        icon: FiAlertTriangle,
    },
    {
        label: "Completed",
        value: "2",
        bgColor: "bg-[#EEF6EF]",
        iconColor: "text-green-700 bg-white/60",
        watermarkColor: "text-green-600/10",
        icon: FiCheckCircle,
    },
];

/* ─── Secondary KPI data (metric cards) ───────────────────────────── */
const SECONDARY_KPI = [
    {
        label: "Completion Rate",
        value: "18%",
        icon: FiTrendingUp,
        iconColor: "text-slate-600 bg-slate-100",
    },
    {
        label: "Avg Cycle Time",
        value: "0 days",
        icon: FiRefreshCw,
        iconColor: "text-slate-600 bg-slate-100",
    },
    {
        label: "On-Time Delivery",
        value: "50%",
        icon: FiTarget,
        iconColor: "text-slate-600 bg-slate-100",
    },
    {
        label: "Due in 3 Days",
        value: "1",
        icon: FiCalendar,
        iconColor: "text-slate-600 bg-slate-100",
    },
];

/* ─── Primary KPI Card ──────────────────────────────────────────── */
function KPICard({ label, value, bgColor, icon: Icon, iconColor, watermarkColor }) {
    return (
        <div
            className={`relative overflow-hidden min-h-[140px] rounded-2xl ${bgColor} p-5 shadow-sm
                hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                flex flex-col justify-between`}
        >
            {/* Watermark Icon */}
            <Icon 
                size={80} 
                className={`absolute -bottom-4 -right-4 ${watermarkColor} transform -rotate-12`} 
            />

            <div className="relative z-10 flex flex-col justify-between h-full">
                {/* Top Icon */}
                <div className="flex items-start">
                    <div className={`p-2 rounded-xl ${iconColor} backdrop-blur-sm shadow-sm`}>
                        <Icon size={16} />
                    </div>
                </div>
                
                {/* Bottom Content */}
                <div className="mt-6">
                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 font-sans leading-tight mb-1">
                        {label}
                    </p>
                    <p className="text-3xl font-bold leading-none font-display text-slate-900">
                        {value}
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ─── Secondary KPI Card ────────────────────────────────────────── */
function SecondaryKPICard({ label, value, icon: Icon, iconColor }) {
    return (
        <div
            className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm
                hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                flex items-center gap-4`}
        >
            <div className={`p-3 rounded-full flex-shrink-0 ${iconColor}`}>
                <Icon size={16} />
            </div>
            <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 font-sans leading-tight mb-1">
                    {label}
                </p>
                <p className="text-xl font-bold font-display text-slate-900 leading-none">
                    {value}
                </p>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
function DelegationDashboard() {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 800);
    };

    return (
        <div className="w-full min-h-screen bg-[#F5F2E9] px-4 md:px-6 py-6 space-y-6">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Title block */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#C19B52] flex items-center justify-center shadow-sm flex-shrink-0 text-white">
                        <FiGrid size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-display">
                            Delegation Dashboard
                        </h1>
                        <p className="text-sm text-slate-500 mt-1 font-sans">
                            At-a-glance overview of delegated work.
                        </p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                    {/* Dashboard Guide */}
                    <button
                        id="dashboard-guide-btn"
                        className="h-10 px-4 rounded-xl bg-white/50 text-sm font-medium text-slate-700 hover:bg-white/80 transition-all duration-200 flex items-center gap-2 shadow-sm"
                    >
                        <FiBookOpen size={14} />
                        Dashboard Guide
                    </button>

                    {/* Refresh */}
                    <button
                        id="dashboard-refresh-btn"
                        onClick={handleRefresh}
                        className="h-10 px-4 rounded-xl bg-white/50 text-sm font-medium text-slate-700 hover:bg-white/80 transition-all duration-200 flex items-center gap-2 shadow-sm"
                    >
                        <FiRefreshCw
                            size={14}
                            className={refreshing ? "animate-spin text-slate-900" : ""}
                        />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="space-y-4 mt-2">
                {/* Primary row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {PRIMARY_KPI.map((card) => (
                        <KPICard key={card.label} {...card} />
                    ))}
                </div>

                {/* Secondary row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {SECONDARY_KPI.map((card) => (
                        <SecondaryKPICard key={card.label} {...card} />
                    ))}
                </div>
            </div>

            {/* ── Charts Section Mockup ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Workload Trend */}
                <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 font-display">Workload Trend</h2>
                            <p className="text-xs font-semibold text-slate-400 mt-1 tracking-wider uppercase">Last 14 Days</p>
                        </div>
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                            <FiMoreHorizontal size={20} />
                        </button>
                    </div>
                    {/* Simulated Chart Area */}
                    <div className="flex-1 min-h-[200px] relative w-full flex items-end">
                        {/* Background grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pb-8">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="w-full h-px bg-slate-100" />
                            ))}
                        </div>
                        {/* Fake SVG Trend Line */}
                        <svg className="w-full h-full relative z-10" viewBox="0 0 100 40" preserveAspectRatio="none">
                            <path 
                                d="M0,40 L0,35 C10,30 15,38 25,25 C35,12 40,28 50,20 C60,12 65,5 75,10 C85,15 90,5 100,2 L100,40 Z" 
                                fill="#EEF5F2" 
                            />
                            <path 
                                d="M0,35 C10,30 15,38 25,25 C35,12 40,28 50,20 C60,12 65,5 75,10 C85,15 90,5 100,2" 
                                fill="none" 
                                stroke="#10B981" 
                                strokeWidth="1" 
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>
                        {/* X-Axis labels */}
                        <div className="absolute bottom-0 left-0 w-full flex justify-between text-[10px] text-slate-400 font-medium px-2">
                            <span>01 Oct</span>
                            <span>04 Oct</span>
                            <span>07 Oct</span>
                            <span>10 Oct</span>
                            <span>14 Oct</span>
                        </div>
                    </div>
                </div>

                {/* Status Mix */}
                <div className="xl:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-900 font-display">Status Mix</h2>
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                            <FiMoreHorizontal size={20} />
                        </button>
                    </div>
                    {/* Simulated Donut Chart */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-8 mt-2">
                        <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-slate-50 border-[16px] border-slate-100">
                            {/* Fake SVG Donut segments */}
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#10B981" strokeWidth="6" strokeDasharray="50 50" />
                                <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#F59E0B" strokeWidth="6" strokeDasharray="30 70" strokeDashoffset="-50" />
                                <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#3B82F6" strokeWidth="6" strokeDasharray="20 80" strokeDashoffset="-80" />
                            </svg>
                            <div className="text-center z-10 bg-white w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-sm">
                                <span className="text-2xl font-bold text-slate-900">11</span>
                                <span className="text-[10px] uppercase font-semibold text-slate-400">Total</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="w-full flex justify-between gap-2 px-2">
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                                <span className="text-xs font-semibold text-slate-600">Active</span>
                                <span className="text-xs text-slate-400">50%</span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                                <span className="text-xs font-semibold text-slate-600">Pending</span>
                                <span className="text-xs text-slate-400">30%</span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
                                <span className="text-xs font-semibold text-slate-600">Progress</span>
                                <span className="text-xs text-slate-400">20%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

export default DelegationDashboard;
