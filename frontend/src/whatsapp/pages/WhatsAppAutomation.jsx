import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { triggerAutomation } from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import { useWebSockets } from "../../context/WebSocketContext";
import {
    FiZap, FiPlay, FiPause, FiCheckCircle, FiClock, FiSettings, FiRefreshCw,
    FiToggleLeft, FiToggleRight, FiActivity, FiCalendar, FiEye, FiEdit2,
    FiCheck, FiX, FiInfo, FiChevronRight, FiGlobe, FiAlertCircle
} from "react-icons/fi";

const INITIAL_SCHEDULER_DATA = [
    {
        id: "welcome-message",
        name: "Welcome Message",
        trigger: "New CRM Lead Created",
        triggerType: "Event Trigger",
        status: "Scheduled",
        lastRun: "2026-07-24 10:00 AM",
        nextRunDate: "2026-07-24",
        nextRunTime: "16:30",
        nextRunFormatted: "24 Jul 2026 04:30 PM",
        targetTimeMs: Date.now() + (1 * 3600 + 22 * 60 + 18) * 1000,
        schedule: "Instant / Continuous",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        repeat: "Daily",
        description: "Sent automatically when a new CRM lead is created.",
        createdBy: "Sarah Jenkins",
        createdOn: "2026-06-01",
        lastModified: "2026-07-20",
        totalExecutions: 1420,
        successfulRuns: 1410,
        failedRuns: 10,
        avgTime: "120ms",
        successRate: "99.2%",
        enabled: true,
    },
    {
        id: "followup-reminder",
        name: "Follow-up Reminder",
        trigger: "Scheduled (Daily 10:00 AM)",
        triggerType: "Recurring Cron",
        status: "Scheduled",
        lastRun: "2026-07-24 10:00 AM",
        nextRunDate: "2026-07-25",
        nextRunTime: "10:00",
        nextRunFormatted: "25 Jul 2026 10:00 AM",
        targetTimeMs: Date.now() + (19 * 3600 + 32 * 60 + 40) * 1000,
        schedule: "Daily at 10:00 AM",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        repeat: "Daily",
        description: "Sends automated follow-up messages to active CRM leads.",
        createdBy: "Admin User",
        createdOn: "2026-05-15",
        lastModified: "2026-07-22",
        totalExecutions: 850,
        successfulRuns: 836,
        failedRuns: 14,
        avgTime: "340ms",
        successRate: "98.4%",
        enabled: true,
    },
    {
        id: "meeting-reminder",
        name: "Meeting Reminder",
        trigger: "Scheduled (Daily 09:00 AM)",
        triggerType: "Recurring Cron",
        status: "Scheduled",
        lastRun: "2026-07-24 09:00 AM",
        nextRunDate: "2026-07-25",
        nextRunTime: "09:00",
        nextRunFormatted: "25 Jul 2026 09:00 AM",
        targetTimeMs: Date.now() + (18 * 3600 + 32 * 60 + 40) * 1000,
        schedule: "Daily at 09:00 AM",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        repeat: "Daily",
        description: "Reminds clients 1 hour before scheduled consultation meetings.",
        createdBy: "David Miller",
        createdOn: "2026-06-10",
        lastModified: "2026-07-21",
        totalExecutions: 520,
        successfulRuns: 519,
        failedRuns: 1,
        avgTime: "210ms",
        successRate: "99.8%",
        enabled: true,
    },
    {
        id: "task-assigned",
        name: "Task Assignment Notification",
        trigger: "Delegation Task Created",
        triggerType: "Event Hook",
        status: "Scheduled",
        lastRun: "2026-07-23 04:15 PM",
        nextRunDate: "2026-07-24",
        nextRunTime: "18:00",
        nextRunFormatted: "24 Jul 2026 06:00 PM",
        targetTimeMs: Date.now() + (3 * 3600 + 2 * 60 + 10) * 1000,
        schedule: "Event Triggered",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        repeat: "Once",
        description: "Notifies employees via WhatsApp when a new delegation task is assigned.",
        createdBy: "Sarah Jenkins",
        createdOn: "2026-06-12",
        lastModified: "2026-07-18",
        totalExecutions: 310,
        successfulRuns: 310,
        failedRuns: 0,
        avgTime: "150ms",
        successRate: "100%",
        enabled: true,
    },
    {
        id: "daily-report",
        name: "Daily Executive Lead Report",
        trigger: "Scheduled (Daily 08:00 PM)",
        triggerType: "Cron Schedule",
        status: "Scheduled",
        lastRun: "2026-07-23 08:00 PM",
        nextRunDate: "2026-07-24",
        nextRunTime: "20:00",
        nextRunFormatted: "24 Jul 2026 08:00 PM",
        targetTimeMs: Date.now() + (5 * 3600 + 2 * 60 + 10) * 1000,
        schedule: "Daily at 08:00 PM",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        repeat: "Daily",
        description: "Generates CRM daily summary report and dispatches to executive admin.",
        createdBy: "Admin User",
        createdOn: "2026-05-01",
        lastModified: "2026-07-19",
        totalExecutions: 450,
        successfulRuns: 439,
        failedRuns: 11,
        avgTime: "620ms",
        successRate: "97.5%",
        enabled: true,
    }
];

function WhatsAppAutomation() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { whatsappSocket } = useWebSockets();

    const [workflows, setWorkflows] = useState(INITIAL_SCHEDULER_DATA);
    const [triggering, setTriggering] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal / Drawer States
    const [editModal, setEditModal] = useState(null); // Automation item to edit schedule
    const [detailsDrawer, setDetailsDrawer] = useState(null); // Automation item for deep dive

    // Edit Schedule Form State
    const [newDate, setNewDate] = useState("");
    const [newTime, setNewTime] = useState("");
    const [editTimeZone, setEditTimeZone] = useState("Asia/Kolkata (GMT+05:30)");
    const [editRepeat, setEditRepeat] = useState("Daily");
    const [changeReason, setChangeReason] = useState("");
    const [savingSchedule, setSavingSchedule] = useState(false);

    // Live Countdowns State Map
    const [countdowns, setCountdowns] = useState({});

    // Real-Time 1-Second Countdowns Loop
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const newMap = {};

            setWorkflows(prev => prev.map(w => {
                if (w.status === "Paused" || !w.enabled) {
                    newMap[w.id] = "Paused";
                    return w;
                }

                const target = w.targetTimeMs || (now + 3600000);
                const diff = target - now;

                if (diff <= 0) {
                    // Auto transition: Scheduled -> Running -> Completed -> Rescheduled
                    if (w.status !== "Running") {
                        if (showToast) showToast(`Automation "${w.name}" Started Automatically!`, "info");
                        // Calculate next run date for repeat
                        const nextTarget = now + (w.repeat === "Weekly" ? 7 : w.repeat === "Monthly" ? 30 : 1) * 86400 * 1000;
                        return {
                            ...w,
                            status: "Running",
                            lastRun: "Just Now",
                            targetTimeMs: nextTarget,
                            successfulRuns: (w.successfulRuns || 0) + 1,
                            totalExecutions: (w.totalExecutions || 0) + 1
                        };
                    }
                }

                const days = Math.floor(Math.max(0, diff) / (1000 * 60 * 60 * 24));
                const hours = Math.floor((Math.max(0, diff) / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((Math.max(0, diff) / 1000 / 60) % 60);
                const seconds = Math.floor((Math.max(0, diff) / 1000) % 60);

                newMap[w.id] = `${days.toString().padStart(2, "0")}d ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
                return w;
            }));

            setCountdowns(newMap);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Instant Trigger (Run Now)
    const handleRunNow = async (wf) => {
        setTriggering(wf.id);
        if (showToast) showToast(`Automation "${wf.name}" Started`, "info");

        try {
            await triggerAutomation(wf.id, {
                workflowName: wf.name,
                template: wf.template || wf.name,
                template_name: wf.template || wf.name
            });
        } catch (e) {
            console.warn("Manual trigger simulation", e);
        }

        setWorkflows(prev => prev.map(w => {
            if (w.id === wf.id) {
                return {
                    ...w,
                    status: "Running",
                    lastRun: "Just Now",
                    totalExecutions: w.totalExecutions + 1,
                    successfulRuns: w.successfulRuns + 1
                };
            }
            return w;
        }));

        setTimeout(() => {
            setWorkflows(prev => prev.map(w => {
                if (w.id === wf.id) {
                    if (showToast) showToast(`Automation "${wf.name}" Completed Successfully`, "success");
                    return { ...w, status: "Scheduled" };
                }
                return w;
            }));
            setTriggering(null);
        }, 2000);
    };

    // Pause / Resume Controls
    const handleTogglePause = (wf) => {
        const isCurrentlyPaused = wf.status === "Paused";
        const newStatus = isCurrentlyPaused ? "Scheduled" : "Paused";

        setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, status: newStatus, enabled: isCurrentlyPaused } : w));
        
        if (showToast) {
            showToast(`Automation "${wf.name}" ${isCurrentlyPaused ? "Resumed" : "Paused"}`, isCurrentlyPaused ? "success" : "warning");
        }
    };

    // Open Edit Schedule Modal
    const handleOpenEditModal = (wf) => {
        setEditModal(wf);
        setNewDate(wf.nextRunDate || new Date().toISOString().split("T")[0]);
        setNewTime(wf.nextRunTime || "12:00");
        setEditTimeZone(wf.timeZone || "Asia/Kolkata (GMT+05:30)");
        setEditRepeat(wf.repeat || "Daily");
        setChangeReason("");
    };

    // Save Edit Schedule Changes
    const handleSaveSchedule = (e) => {
        e?.preventDefault();

        // Validation
        if (!newDate || !newTime) {
            if (showToast) showToast("Please select a valid date and time.", "error");
            return;
        }

        const selectedMs = new Date(`${newDate}T${newTime}`).getTime();
        if (selectedMs < Date.now()) {
            if (showToast) showToast("Cannot schedule automations in the past. Please pick a future date & time.", "error");
            return;
        }

        setSavingSchedule(true);

        setTimeout(() => {
            const formatted = `${newDate} ${newTime} (${editTimeZone.split(" ")[0]})`;

            setWorkflows(prev => prev.map(w => {
                if (w.id === editModal.id) {
                    return {
                        ...w,
                        nextRunDate: newDate,
                        nextRunTime: newTime,
                        nextRunFormatted: formatted,
                        targetTimeMs: selectedMs,
                        timeZone: editTimeZone,
                        repeat: editRepeat,
                        schedule: `${editRepeat} at ${newTime}`,
                        status: "Scheduled",
                        enabled: true,
                        lastModified: new Date().toISOString().split("T")[0]
                    };
                }
                return w;
            }));

            if (showToast) showToast(`Schedule Updated Successfully for "${editModal.name}"`, "success");
            setSavingSchedule(false);
            setEditModal(null);
        }, 400);
    };

    const statusBadgeColors = {
        Scheduled: "bg-blue-50 text-blue-600 border-blue-100 font-bold",
        Running: "bg-emerald-50 text-emerald-600 border-emerald-200 font-bold animate-pulse",
        Completed: "bg-emerald-50 text-emerald-600 border-emerald-100 font-bold",
        Paused: "bg-orange-50 text-orange-600 border-orange-100 font-bold",
        Failed: "bg-rose-50 text-rose-600 border-rose-100 font-bold",
    };

    const filteredWorkflows = workflows.filter(w =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Dashboard Counters
    const totalActive = workflows.length;
    const runningCount = workflows.filter(w => w.status === "Running").length;
    const pausedCount = workflows.filter(w => w.status === "Paused").length;
    const nextScheduledWf = workflows.find(w => w.status === "Scheduled");

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="automation" searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            {/* AUTOMATION SCHEDULER DASHBOARD CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Total Automations</span>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-2xl font-extrabold text-slate-800 font-display">{totalActive}</span>
                        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <FiZap size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Running Automations</span>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-2xl font-extrabold text-emerald-600 font-display">{runningCount}</span>
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <FiActivity size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Paused Automations</span>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-2xl font-extrabold text-orange-600 font-display">{pausedCount}</span>
                        <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                            <FiPause size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Next Scheduled Run</span>
                    <div className="flex items-center justify-between mt-2">
                        <div>
                            <span className="text-xs font-bold text-slate-800 truncate block max-w-[130px]">{nextScheduledWf?.name || "None"}</span>
                            <span className="text-[9px] text-emerald-600 font-mono font-bold block mt-0.5">{countdowns[nextScheduledWf?.id] || "00:00:00"}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <FiClock size={18} />
                        </div>
                    </div>
                </div>
            </div>

            {/* PROFESSIONAL SCHEDULER TABLE */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 font-display">Automation Workflow Scheduler & Live Countdowns</h3>
                        <p className="text-xs text-slate-400 mt-0.5 font-sans">Configure triggers, cron schedules, next run dates, and real-time execution countdowns.</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Automation Name</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trigger Type</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Status</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Run</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next Scheduled Run</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Countdown</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Schedule</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredWorkflows.map((wf) => (
                                <tr key={wf.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                <FiZap size={14} />
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-slate-800 block">{wf.name}</span>
                                                <span className="text-[9px] text-slate-400 block mt-0.5">{wf.trigger}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600 font-medium">{wf.triggerType || "Event"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-md border uppercase ${statusBadgeColors[wf.status] || statusBadgeColors.Scheduled}`}>
                                            {wf.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">{wf.lastRun}</td>
                                    <td className="px-4 py-3 text-[10px] text-slate-700 font-mono font-semibold">{wf.nextRunFormatted || wf.schedule}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                            {countdowns[wf.id] || "00:00:00"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] text-slate-600 font-medium">{wf.repeat || "Daily"}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleRunNow(wf)}
                                                disabled={triggering === wf.id}
                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                                                title="Run Now"
                                            >
                                                {triggering === wf.id ? <FiRefreshCw className="animate-spin" size={13} /> : <FiPlay size={13} />}
                                            </button>

                                            <button
                                                onClick={() => handleTogglePause(wf)}
                                                className={`p-1.5 rounded-lg transition cursor-pointer ${wf.status === "Paused" ? "text-emerald-600 hover:bg-emerald-50" : "text-orange-500 hover:bg-orange-50"}`}
                                                title={wf.status === "Paused" ? "Resume Automation" : "Pause Automation"}
                                            >
                                                {wf.status === "Paused" ? <FiPlay size={13} /> : <FiPause size={13} />}
                                            </button>

                                            <button
                                                onClick={() => handleOpenEditModal(wf)}
                                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer flex items-center gap-1"
                                                title="Edit Schedule"
                                            >
                                                <FiCalendar size={13} />
                                            </button>

                                            <button
                                                onClick={() => setDetailsDrawer(wf)}
                                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                                title="View Details"
                                            >
                                                <FiEye size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* EDIT AUTOMATION SCHEDULE MODAL */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setEditModal(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200/90 animate-slide-up space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                                    <FiCalendar size={15} />
                                </span>
                                <h3 className="text-sm font-bold text-slate-900 font-display">Edit Automation Schedule</h3>
                            </div>
                            <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                        </div>

                        <form onSubmit={handleSaveSchedule} className="space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Automation Name</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={editModal.name}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Current Schedule</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={editModal.schedule || editModal.nextRunFormatted}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono cursor-not-allowed"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        New Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        min={new Date().toISOString().split("T")[0]}
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        New Time <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={newTime}
                                        onChange={(e) => setNewTime(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Time Zone</label>
                                    <select
                                        value={editTimeZone}
                                        onChange={(e) => setEditTimeZone(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium"
                                    >
                                        <option value="Asia/Kolkata (GMT+05:30)">Asia/Kolkata (GMT+05:30)</option>
                                        <option value="UTC (GMT+00:00)">UTC (GMT+00:00)</option>
                                        <option value="America/New_York (GMT-05:00)">America/New_York (GMT-05:00)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Repeat Frequency</label>
                                    <select
                                        value={editRepeat}
                                        onChange={(e) => setEditRepeat(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium"
                                    >
                                        <option value="Once">Once</option>
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reason for Change (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Adjusting time per executive review..."
                                    value={changeReason}
                                    onChange={(e) => setChangeReason(e.target.value)}
                                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditModal(null)} className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={savingSchedule} className="flex-1 py-2.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                                    {savingSchedule ? <FiRefreshCw className="animate-spin" size={13} /> : <FiCheck size={13} />}
                                    <span>{savingSchedule ? "Saving..." : "Save Changes"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AUTOMATION DETAILS DRAWER / MODAL */}
            {detailsDrawer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setDetailsDrawer(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 space-y-4 animate-slide-up">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 font-display">{detailsDrawer.name}</h3>
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border uppercase mt-1 inline-block ${statusBadgeColors[detailsDrawer.status]}`}>
                                    {detailsDrawer.status}
                                </span>
                            </div>
                            <button onClick={() => setDetailsDrawer(null)} className="text-slate-400 hover:text-slate-600"><FiX size={18} /></button>
                        </div>

                        <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                            {detailsDrawer.description}
                        </p>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">Executions</span>
                                <span className="font-extrabold text-slate-800">{detailsDrawer.totalExecutions}</span>
                            </div>
                            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                                <span className="text-[9px] text-emerald-600 font-bold uppercase block">Success</span>
                                <span className="font-extrabold text-emerald-700">{detailsDrawer.successfulRuns}</span>
                            </div>
                            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100">
                                <span className="text-[9px] text-rose-600 font-bold uppercase block">Failed</span>
                                <span className="font-extrabold text-rose-700">{detailsDrawer.failedRuns}</span>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                            <p className="flex justify-between"><span>Trigger:</span> <strong className="text-slate-800">{detailsDrawer.trigger}</strong></p>
                            <p className="flex justify-between"><span>Schedule:</span> <strong className="text-slate-800">{detailsDrawer.schedule}</strong></p>
                            <p className="flex justify-between"><span>Next Scheduled Run:</span> <strong className="text-emerald-600 font-mono">{detailsDrawer.nextRunFormatted}</strong></p>
                            <p className="flex justify-between"><span>Live Countdown:</span> <strong className="text-emerald-600 font-mono">{countdowns[detailsDrawer.id] || "00:00:00"}</strong></p>
                            <p className="flex justify-between"><span>Created By:</span> <strong className="text-slate-800">{detailsDrawer.createdBy} ({detailsDrawer.createdOn})</strong></p>
                            <p className="flex justify-between"><span>Average Execution Speed:</span> <strong className="text-slate-800 font-mono">{detailsDrawer.avgTime}</strong></p>
                        </div>

                        <button onClick={() => setDetailsDrawer(null)} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer">
                            Close Details
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppAutomation;
