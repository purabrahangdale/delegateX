import { useState } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import {
    FiBarChart2, FiTrendingUp, FiDownload, FiCheckCircle, FiEye,
    FiMessageSquare, FiAlertCircle, FiPieChart
} from "react-icons/fi";

function WhatsAppReports() {
    const [timeframe, setTimeframe] = useState("weekly");

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="reports" />

            {/* Timeframe Selector & Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 font-display">Executive Campaign Performance Reports</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Comprehensive delivery rates, read engagements, and messaging ROI metrics.</p>
                </div>
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
                    { title: "Customer Replies", value: "3,410", trend: "+8.9%", isUp: true, color: "text-indigo-600" },
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
    );
}

export default WhatsAppReports;
