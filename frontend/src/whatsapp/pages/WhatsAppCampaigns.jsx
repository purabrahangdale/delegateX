import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { getWhatsAppTemplates, triggerAutomation } from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import { useWebSockets } from "../../context/WebSocketContext";
import {
    FiSend, FiUsers, FiFileText, FiClock, FiCheckCircle, FiPlay, FiPause,
    FiXCircle, FiRefreshCw, FiChevronRight, FiChevronLeft, FiFilter, FiCheck,
    FiAlertCircle, FiTrendingUp, FiZap, FiBarChart2, FiCalendar, FiGlobe,
    FiEye, FiEdit2, FiTrash2, FiCopy, FiSlash, FiCheckSquare, FiAlertTriangle
} from "react-icons/fi";

const INITIAL_CAMPAIGNS = [
    {
        id: "cmp-101",
        name: "Q3 VIP Client Onboarding",
        template: "Welcome Message",
        audience: 1000,
        totalContacts: 1000,
        scheduledDate: "2026-07-24",
        scheduledTime: "10:00",
        scheduledFormatted: "2026-07-24 10:00 AM",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        sendMode: "scheduled",
        repeat: "None",
        delivered: 984,
        sent: 1000,
        read: 840,
        replies: 412,
        failed: 16,
        progress: 100,
        status: "Completed",
        createdBy: "Sarah Jenkins",
        startedAt: "2026-07-24 10:00:00 AM",
        completedAt: "2026-07-24 10:16:40 AM",
        duration: "16m 40s",
        targetAudience: "all_leads"
    },
    {
        id: "cmp-102",
        name: "Q4 Product Launch & Demo Broadcast",
        template: "Follow-up Reminder",
        audience: 1200,
        totalContacts: 1200,
        scheduledDate: new Date(Date.now() + (2 * 86400 + 5 * 3600 + 18 * 60 + 42) * 1000).toISOString().split("T")[0],
        scheduledTime: "14:30",
        targetTimeMs: Date.now() + (2 * 86400 + 5 * 3600 + 18 * 60 + 42) * 1000,
        scheduledFormatted: new Date(Date.now() + (2 * 86400 + 5 * 3600 + 18 * 60 + 42) * 1000).toLocaleString(),
        timeZone: "Asia/Kolkata (GMT+05:30)",
        sendMode: "scheduled",
        repeat: "Weekly",
        delivered: 0,
        sent: 0,
        read: 0,
        replies: 0,
        failed: 0,
        progress: 0,
        status: "Scheduled",
        createdBy: "Admin User",
        targetAudience: "converted"
    },
    {
        id: "cmp-103",
        name: "Weekend Consultation Reminder Blast",
        template: "Meeting Reminder",
        audience: 500,
        totalContacts: 500,
        scheduledDate: "2026-07-25",
        scheduledTime: "09:00",
        scheduledFormatted: "2026-07-25 09:00 AM",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        sendMode: "scheduled",
        repeat: "Daily",
        delivered: 0,
        sent: 0,
        read: 0,
        replies: 0,
        failed: 0,
        progress: 0,
        status: "Queued",
        createdBy: "David Miller",
        targetAudience: "pending"
    },
    {
        id: "cmp-104",
        name: "July Lead Re-engagement Campaign",
        template: "Welcome Message",
        audience: 850,
        totalContacts: 850,
        scheduledDate: "2026-07-23",
        scheduledTime: "11:00",
        scheduledFormatted: "2026-07-23 11:00 AM",
        timeZone: "Asia/Kolkata (GMT+05:30)",
        sendMode: "immediate",
        repeat: "None",
        delivered: 420,
        sent: 450,
        read: 380,
        replies: 120,
        failed: 30,
        progress: 52,
        status: "Paused",
        createdBy: "Sarah Jenkins",
        targetAudience: "all_leads"
    }
];

const DEFAULT_TEMPLATES = [
    {
        name: "Welcome Message",
        category: "onboarding",
        content: "👋 Hello {{client_name}}!\n\nWelcome to *DelegateX*. We're excited to have you onboard.\n\nYour enquiry for *{{project_type}}* has been received and assigned to {{assigned_to}}.\n\nWe'll be in touch shortly. Feel free to reply to this message if you have any questions!\n\n— Team DelegateX"
    },
    {
        name: "Follow-up Reminder",
        category: "reminder",
        content: "📋 Hi {{client_name}},\n\nThis is a friendly reminder about your {{project_type}} enquiry with DelegateX.\n\nYour assigned consultant *{{assigned_to}}* would like to schedule a follow-up conversation.\n\nPlease let us know a convenient time to connect!\n\n— Team DelegateX"
    },
    {
        name: "Meeting Reminder",
        category: "reminder",
        content: "📅 Hi {{client_name}},\n\nThis is a reminder for your upcoming meeting:\n\n🕐 *Date:* {{meeting_date}}\n⏰ *Time:* {{meeting_time}}\n📍 *Location:* {{meeting_location}}\n👤 *With:* {{assigned_to}}\n\nPlease confirm your availability by replying to this message.\n\n— Team DelegateX"
    },
    {
        name: "Lead Converted",
        category: "notification",
        content: "🎉 Congratulations {{client_name}}!\n\nYour project with DelegateX has been *confirmed*.\n\n📋 *Project Type:* {{project_type}}\n👤 *Your Contact:* {{assigned_to}}\n\nWe look forward to working with you. Our team will reach out with the next steps shortly.\n\n— Team DelegateX"
    },
    {
        name: "Task Assigned",
        category: "notification",
        content: "📌 Hi {{employee_name}},\n\nA new task has been assigned to you:\n\n📋 *Task:* {{task_title}}\n📁 *Project:* {{project_name}}\n⚡ *Priority:* {{priority}}\n📅 *Deadline:* {{deadline}}\n\nPlease update the status once you begin working on it.\n\n— DelegateX Automation"
    },
    {
        name: "Payment Reminder",
        category: "reminder",
        content: "💳 Hi {{client_name}},\n\nThis is a friendly reminder that invoice *#{{invoice_no}}* for {{amount}} is due on {{due_date}}.\n\nThank you for choosing DelegateX!\n\n— Team DelegateX"
    },
    {
        name: "Order Confirmation",
        category: "utility",
        content: "🛍️ Hi {{client_name}},\n\nThank you for your order! Your order *#{{order_id}}* has been confirmed and is currently being processed.\n\nEstimated delivery: {{delivery_date}}.\n\n— Team DelegateX"
    }
];

function WhatsAppCampaigns({ isWizardOnly = false }) {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { whatsappSocket } = useWebSockets();

    const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
    const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS);
    const [wizardStep, setWizardStep] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [showWizard, setShowWizard] = useState(isWizardOnly);
    const [launching, setLaunching] = useState(false);
    const [detailModal, setDetailModal] = useState(null);
    const [editModal, setEditModal] = useState(null);

    // Wizard Form State (Enhanced Scheduling Options)
    const [campaignName, setCampaignName] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("Welcome Message");
    const [targetAudience, setTargetAudience] = useState("all_leads");
    const [messagesPerMin, setMessagesPerMin] = useState(60);
    const [sendOption, setSendOption] = useState("immediate"); // "immediate" | "scheduled"
    const [campaignDate, setCampaignDate] = useState(new Date().toISOString().split("T")[0]);
    const [campaignTime, setCampaignTime] = useState("12:00");
    const [timeZone, setTimeZone] = useState("Asia/Kolkata (GMT+05:30)");
    const [repeatOption, setRepeatOption] = useState("None");

    // Countdown State for "Next Scheduled Campaign"
    const [countdownText, setCountdownText] = useState({ days: "00", hours: "00", minutes: "00", seconds: "00" });

    // Live Execution Simulation State
    const activeExecutionRef = useRef(null);

    // Find next scheduled campaign
    const nextScheduled = campaigns.find(c => (c.status === "Scheduled" || c.status === "Queued") && c.targetTimeMs);

    // Real-Time 1-Second Countdown Timer & Auto Execution Trigger
    useEffect(() => {
        const timer = setInterval(() => {
            if (!nextScheduled || !nextScheduled.targetTimeMs) {
                setCountdownText({ days: "00", hours: "00", minutes: "00", seconds: "00" });
                return;
            }

            const diff = nextScheduled.targetTimeMs - Date.now();

            if (diff <= 0) {
                // Countdown reached zero -> Auto transition to Running & Start execution
                if (nextScheduled.status !== "Running" && nextScheduled.status !== "Completed") {
                    startCampaignExecution(nextScheduled.id);
                }
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((diff / 1000 / 60) % 60);
                const seconds = Math.floor((diff / 1000) % 60);

                setCountdownText({
                    days: days.toString().padStart(2, "0"),
                    hours: hours.toString().padStart(2, "0"),
                    minutes: minutes.toString().padStart(2, "0"),
                    seconds: seconds.toString().padStart(2, "0")
                });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [nextScheduled, campaigns]);

    // Simulating Real-Time Campaign Message Progress
    const startCampaignExecution = (campaignId) => {
        // Notification
        if (showToast) showToast(`Campaign "${campaignId}" Started Automatically`, "info");

        const targetCmp = campaigns.find(c => c.id === campaignId);
        if (targetCmp) {
            triggerAutomation("campaign", {
                campaignName: targetCmp.name,
                template: targetCmp.template,
                template_name: targetCmp.template,
                targetAudience: targetCmp.targetAudience || "all_leads"
            }).catch(err => console.warn("Backend campaign dispatch error", err));
        }

        setCampaigns(prev => prev.map(c => {
            if (c.id === campaignId) {
                return {
                    ...c,
                    status: "Running",
                    startedAt: new Date().toLocaleTimeString(),
                    delivered: c.delivered || 0,
                    sent: c.sent || 0,
                };
            }
            return c;
        }));

        // Simulated interval tick
        if (activeExecutionRef.current) clearInterval(activeExecutionRef.current);

        activeExecutionRef.current = setInterval(() => {
            setCampaigns(prev => prev.map(c => {
                if (c.id === campaignId && c.status === "Running") {
                    const total = c.totalContacts || 1000;
                    const newSent = Math.min(total, (c.sent || 0) + 25);
                    const newDelivered = Math.min(newSent, Math.floor(newSent * 0.98));
                    const newRead = Math.floor(newDelivered * 0.85);
                    const newFailed = newSent - newDelivered;
                    const newProgress = Math.floor((newSent / total) * 100);

                    if (newSent >= total) {
                        clearInterval(activeExecutionRef.current);
                        if (showToast) showToast(`Campaign "${c.name}" Completed Successfully!`, "success");
                        return {
                            ...c,
                            sent: total,
                            delivered: Math.floor(total * 0.98),
                            read: Math.floor(total * 0.85),
                            failed: Math.floor(total * 0.02),
                            progress: 100,
                            status: "Completed",
                            completedAt: new Date().toLocaleTimeString(),
                            duration: "2m 15s"
                        };
                    }

                    return {
                        ...c,
                        sent: newSent,
                        delivered: newDelivered,
                        read: newRead,
                        failed: newFailed,
                        progress: newProgress
                    };
                }
                return c;
            }));
        }, 1000);
    };

    useEffect(() => {
        getWhatsAppTemplates().then(data => {
            if (data && data.length > 0) {
                setTemplates(data);
                setSelectedTemplate(prev => {
                    if (prev && data.some(t => t.name === prev)) return prev;
                    return data[0].name;
                });
            }
        });
    }, []);

    // Form Submission & Campaign Creation / Launch / Scheduling
    const handleLaunchCampaign = async () => {
        // Validation for scheduled date in past
        if (sendOption === "scheduled") {
            const selectedMs = new Date(`${campaignDate}T${campaignTime}`).getTime();
            if (selectedMs < Date.now()) {
                if (showToast) showToast("Cannot schedule campaigns in the past. Please pick a future date/time.", "error");
                return;
            }
        }

        setLaunching(true);
        const name = campaignName.trim() || `Broadcast Campaign #${Date.now().toString().slice(-4)}`;
        const totalAudience = targetAudience === "converted" ? 420 : targetAudience === "pending" ? 380 : 1000;

        try {
            await triggerAutomation("campaign", {
                campaignName: name,
                template: selectedTemplate || "Welcome Message",
                template_name: selectedTemplate || "Welcome Message",
                targetAudience: targetAudience
            });
        } catch (e) {
            console.warn("Automation trigger simulation", e);
        }

        if (sendOption === "immediate") {
            const newCmp = {
                id: `cmp-${Date.now().toString().slice(-4)}`,
                name: name,
                template: selectedTemplate || "Welcome Message",
                audience: totalAudience,
                totalContacts: totalAudience,
                scheduledDate: "Today",
                scheduledTime: "Now",
                scheduledFormatted: "Immediate Dispatch",
                timeZone: timeZone,
                sendMode: "immediate",
                repeat: "None",
                delivered: 0,
                sent: 0,
                read: 0,
                replies: 0,
                failed: 0,
                progress: 0,
                status: "Running",
                createdBy: "Admin User",
                startedAt: new Date().toLocaleTimeString(),
                targetAudience: targetAudience
            };

            setCampaigns(prev => [newCmp, ...prev]);
            if (showToast) showToast("Campaign Started Immediately", "success");
            startCampaignExecution(newCmp.id);
        } else {
            // Scheduled for later
            const targetMs = new Date(`${campaignDate}T${campaignTime}`).getTime();
            const newCmp = {
                id: `cmp-${Date.now().toString().slice(-4)}`,
                name: name,
                template: selectedTemplate || "Welcome Message",
                audience: totalAudience,
                totalContacts: totalAudience,
                scheduledDate: campaignDate,
                scheduledTime: campaignTime,
                targetTimeMs: targetMs,
                scheduledFormatted: `${campaignDate} ${campaignTime} (${timeZone.split(" ")[0]})`,
                timeZone: timeZone,
                sendMode: "scheduled",
                repeat: repeatOption,
                delivered: 0,
                sent: 0,
                read: 0,
                replies: 0,
                failed: 0,
                progress: 0,
                status: "Scheduled",
                createdBy: "Admin User",
                targetAudience: targetAudience
            };

            setCampaigns(prev => [newCmp, ...prev]);
            if (showToast) showToast("Campaign Scheduled Successfully", "success");
        }

        setShowWizard(false);
        setWizardStep(1);
        setCampaignName("");
        setLaunching(false);
    };

    // Table Actions
    const handlePause = (id) => {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: "Paused" } : c));
        if (showToast) showToast("Campaign Paused", "info");
    };

    const handleResume = (id) => {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: "Running" } : c));
        if (showToast) showToast("Campaign Resumed", "success");
        startCampaignExecution(id);
    };

    const handleCancel = (id) => {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: "Cancelled" } : c));
        if (showToast) showToast("Campaign Cancelled", "warning");
    };

    const handleDuplicate = (cmp) => {
        const copy = {
            ...cmp,
            id: `cmp-copy-${Date.now().toString().slice(-3)}`,
            name: `${cmp.name} (Copy)`,
            status: "Scheduled",
            progress: 0,
            sent: 0,
            delivered: 0,
            read: 0,
            targetTimeMs: Date.now() + 3600000
        };
        setCampaigns(prev => [copy, ...prev]);
        if (showToast) showToast("Campaign Duplicated", "info");
    };

    const handleDelete = (id) => {
        if (window.confirm("Are you sure you want to delete this campaign?")) {
            setCampaigns(prev => prev.filter(c => c.id !== id));
            if (showToast) showToast("Campaign Deleted", "info");
        }
    };

    const handleEdit = (cmp) => {
        setEditModal({
            id: cmp.id,
            name: cmp.name || "",
            template: cmp.template || (templates[0]?.name || "Welcome Message"),
            targetAudience: cmp.targetAudience || "all_leads",
            sendMode: cmp.sendMode || "scheduled",
            scheduledDate: cmp.scheduledDate || new Date().toISOString().split("T")[0],
            scheduledTime: cmp.scheduledTime || "12:00",
            scheduledFormatted: cmp.scheduledFormatted || "",
            timeZone: cmp.timeZone || "Asia/Kolkata (GMT+05:30)",
            repeat: cmp.repeat || "None",
            status: cmp.status
        });
    };

    const handleSaveEdit = () => {
        if (!editModal) return;
        const name = editModal.name.trim() || "Untitled Campaign";
        const totalAudience = editModal.targetAudience === "converted" ? 420 : editModal.targetAudience === "pending" ? 380 : 1000;

        let targetMs = undefined;
        let scheduledFormatted = editModal.scheduledFormatted;

        if (editModal.sendMode === "scheduled") {
            if (editModal.scheduledDate && editModal.scheduledTime) {
                const dateStr = editModal.scheduledDate;
                const timeStr = editModal.scheduledTime;
                targetMs = new Date(`${dateStr}T${timeStr}`).getTime();
                scheduledFormatted = `${dateStr} ${timeStr}`;
            }
        } else {
            scheduledFormatted = "Immediate Dispatch";
        }

        setCampaigns(prev => prev.map(c => {
            if (c.id === editModal.id) {
                return {
                    ...c,
                    name: name,
                    template: editModal.template,
                    targetAudience: editModal.targetAudience,
                    audience: totalAudience,
                    totalContacts: totalAudience,
                    sendMode: editModal.sendMode,
                    scheduledDate: editModal.scheduledDate,
                    scheduledTime: editModal.scheduledTime,
                    scheduledFormatted: scheduledFormatted,
                    ...(targetMs !== undefined ? { targetTimeMs: targetMs } : {}),
                    timeZone: editModal.timeZone,
                    repeat: editModal.repeat,
                };
            }
            return c;
        }));

        if (showToast) showToast(`Campaign "${name}" updated successfully`, "success");
        setEditModal(null);
    };

    const statusBadgeColors = {
        Completed: "bg-emerald-50 text-emerald-600 border-emerald-100 font-bold",
        Running: "bg-[#25D366]/10 text-emerald-700 border border-emerald-300 font-bold animate-pulse",
        Scheduled: "bg-blue-50 text-blue-600 border-blue-100 font-bold",
        Queued: "bg-amber-50 text-amber-600 border-amber-100 font-bold",
        Paused: "bg-orange-50 text-orange-600 border-orange-100 font-bold",
        Cancelled: "bg-rose-50 text-rose-600 border-rose-100 font-bold",
        Failed: "bg-rose-50 text-rose-600 border-rose-100 font-bold",
    };

    const filteredCampaigns = campaigns.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.template.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Active Running Campaign for Live Progress Bar
    const runningCampaign = campaigns.find(c => c.status === "Running");

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            {!isWizardOnly && (
                <WhatsAppHeader activeTab="campaigns" searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            )}

            {/* NEXT BULK CAMPAIGN COUNTDOWN CARD */}
            {!isWizardOnly && nextScheduled && (
                <div className="bg-gradient-to-tr from-slate-900 via-slate-850 to-slate-950 text-white border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-[#25D366]/10 rounded-full blur-3xl group-hover:bg-[#25D366]/20 transition-all"></div>
                    
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                        {/* Campaign Meta */}
                        <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30">
                                    <FiClock size={16} />
                                </span>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-display">
                                    Next Scheduled Bulk Campaign
                                </h3>
                                <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-md uppercase border ${statusBadgeColors[nextScheduled.status]}`}>
                                    {nextScheduled.status}
                                </span>
                            </div>

                            <div>
                                <h2 className="text-xl sm:text-2xl font-extrabold text-white font-display tracking-tight">
                                    {nextScheduled.name}
                                </h2>
                                <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                                    <span>Template: <strong className="text-slate-200">{nextScheduled.template}</strong></span>
                                    <span>•</span>
                                    <span>Audience: <strong className="text-slate-200">{nextScheduled.audience} Contacts</strong></span>
                                    <span>•</span>
                                    <span>Timezone: <strong className="text-slate-200">{nextScheduled.timeZone}</strong></span>
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                                <span>Created By: <strong className="text-slate-300">{nextScheduled.createdBy || "Admin"}</strong></span>
                                <span>Scheduled: <strong className="text-slate-300">{nextScheduled.scheduledFormatted}</strong></span>
                                <span>Estimated Speed: <strong className="text-emerald-400 font-mono">60 msg/min</strong></span>
                            </div>
                        </div>

                        {/* Live Countdown Timer */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col items-center justify-center min-w-[280px]">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2 font-display">
                                STARTS IN
                            </span>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                                    <span className="text-xl font-extrabold font-mono text-[#25D366] block">{countdownText.days}</span>
                                    <span className="text-[8px] uppercase text-slate-500 font-bold">Days</span>
                                </div>
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                                    <span className="text-xl font-extrabold font-mono text-[#25D366] block">{countdownText.hours}</span>
                                    <span className="text-[8px] uppercase text-slate-500 font-bold">Hours</span>
                                </div>
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                                    <span className="text-xl font-extrabold font-mono text-[#25D366] block">{countdownText.minutes}</span>
                                    <span className="text-[8px] uppercase text-slate-500 font-bold">Mins</span>
                                </div>
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                                    <span className="text-xl font-extrabold font-mono text-[#25D366] block animate-pulse">{countdownText.seconds}</span>
                                    <span className="text-[8px] uppercase text-slate-500 font-bold">Secs</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LIVE RUNNING CAMPAIGN PROGRESS CARD */}
            {runningCampaign && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 shadow-md space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[#25D366] animate-ping"></span>
                            <h3 className="text-sm font-bold text-slate-900 font-display">
                                LIVE CAMPAIGN EXECUTION — <span className="text-emerald-700">{runningCampaign.name}</span>
                            </h3>
                        </div>
                        <span className="text-xs font-bold font-mono text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200">
                            Messages Sent: {runningCampaign.sent || 0} / {runningCampaign.totalContacts || 1000} ({runningCampaign.progress || 0}%)
                        </span>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="space-y-1.5">
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden p-0.5">
                            <div
                                className="bg-[#25D366] h-2 rounded-full transition-all duration-300 relative overflow-hidden"
                                style={{ width: `${runningCampaign.progress || 0}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">Sent</span>
                            <span className="font-extrabold text-slate-800">{runningCampaign.sent || 0}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">Delivered</span>
                            <span className="font-extrabold text-emerald-600">{runningCampaign.delivered || 0}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">Read</span>
                            <span className="font-extrabold text-blue-600">{runningCampaign.read || 0}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">Failed</span>
                            <span className="font-extrabold text-rose-600">{runningCampaign.failed || 0}</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">Sending Speed</span>
                            <span className="font-extrabold text-emerald-600 font-mono">60 msg/min</span>
                        </div>
                    </div>
                </div>
            )}

            {/* HERO BULK MESSAGING WIZARD MODAL / PANEL */}
            {(showWizard || isWizardOnly) && (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xl mb-8 relative overflow-hidden animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                        <div>
                            <h2 className="text-lg font-bold font-display text-slate-900 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/20">W</span>
                                Enterprise Bulk Messaging & Scheduling Wizard
                            </h2>
                            <p className="text-slate-500 text-xs mt-0.5">Configure target audience, message templates, sending option, and dispatch schedule.</p>
                        </div>
                        {!isWizardOnly && (
                            <button onClick={() => setShowWizard(false)} className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer">
                                Close Wizard
                            </button>
                        )}
                    </div>

                    {/* Stepper Progress Bar */}
                    <div className="grid grid-cols-5 gap-2 mb-8">
                        {[
                            { num: 1, label: "Audience" },
                            { num: 2, label: "Template" },
                            { num: 3, label: "Schedule" },
                            { num: 4, label: "Review" },
                            { num: 5, label: "Launch" },
                        ].map((s) => (
                            <div
                                key={s.num}
                                onClick={() => setWizardStep(s.num)}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border transition cursor-pointer ${wizardStep === s.num
                                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-700 font-bold"
                                    : wizardStep > s.num
                                        ? "bg-slate-50 border-slate-200 text-slate-700 font-medium"
                                        : "bg-slate-50/30 border-slate-100 text-slate-400"
                                    }`}
                            >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${wizardStep >= s.num ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                                    {wizardStep > s.num ? <FiCheck size={12} /> : s.num}
                                </span>
                                <span className="text-xs truncate hidden sm:inline">{s.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Step Contents Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT WIZARD CONTROLS (70%) */}
                        <div className="lg:col-span-7 space-y-5">
                            {wizardStep === 1 && (
                                <div className="space-y-4 animate-fade-in">
                                    <h3 className="text-sm font-bold text-slate-800 font-display">Step 1: Select Target Audience</h3>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Campaign Name</label>
                                        <input
                                            type="text"
                                            value={campaignName}
                                            onChange={(e) => setCampaignName(e.target.value)}
                                            placeholder="e.g. Q4 Festive Broadcast Blast"
                                            className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Audience Segment</label>
                                        <select
                                            value={targetAudience}
                                            onChange={(e) => setTargetAudience(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                        >
                                            <option value="all_leads">All Registered CRM Leads (1,000)</option>
                                            <option value="converted">Converted VIP Clients (420)</option>
                                            <option value="pending">Pending Follow-ups (380)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="space-y-4 animate-fade-in">
                                    <h3 className="text-sm font-bold text-slate-800 font-display">Step 2: Choose Template</h3>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Select WhatsApp Approved Template</label>
                                        <select
                                            value={selectedTemplate}
                                            onChange={(e) => setSelectedTemplate(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                        >
                                            {templates.map(t => <option key={t._id || t.name} value={t.name}>{t.name} ({t.category})</option>)}
                                        </select>
                                    </div>
                                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Template Content Preview</p>
                                        <p className="text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap">
                                            {templates.find(t => t.name === selectedTemplate)?.content || "👋 Hello {{client_name}}! Welcome to DelegateX. Your assigned manager is {{assigned_to}}."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: ENHANCED SCHEDULING OPTIONS */}
                            {wizardStep === 3 && (
                                <div className="space-y-4 animate-fade-in">
                                    <h3 className="text-sm font-bold text-slate-800 font-display">Step 3: Scheduling & Dispatch Timing</h3>
                                    
                                    {/* Send Option Selector */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSendOption("immediate")}
                                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${sendOption === "immediate" ? "border-[#25D366] bg-emerald-50/50 font-bold" : "border-slate-200 hover:bg-slate-50"}`}
                                        >
                                            <span className="text-xs font-bold text-slate-800 block">⚡ Send Immediately</span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">Start broadcasting right now</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSendOption("scheduled")}
                                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${sendOption === "scheduled" ? "border-[#25D366] bg-emerald-50/50 font-bold" : "border-slate-200 hover:bg-slate-50"}`}
                                        >
                                            <span className="text-xs font-bold text-slate-800 block">📅 Schedule for Later</span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">Set date, time & timezone</span>
                                        </button>
                                    </div>

                                    {/* Date & Time Pickers when Schedule for Later is selected */}
                                    {sendOption === "scheduled" && (
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 animate-fade-in">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Campaign Date</label>
                                                    <input
                                                        type="date"
                                                        value={campaignDate}
                                                        min={new Date().toISOString().split("T")[0]}
                                                        onChange={(e) => setCampaignDate(e.target.value)}
                                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Campaign Time</label>
                                                    <input
                                                        type="time"
                                                        value={campaignTime}
                                                        onChange={(e) => setCampaignTime(e.target.value)}
                                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Time Zone</label>
                                                    <select
                                                        value={timeZone}
                                                        onChange={(e) => setTimeZone(e.target.value)}
                                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium"
                                                    >
                                                        <option value="Asia/Kolkata (GMT+05:30)">Asia/Kolkata (GMT+05:30)</option>
                                                        <option value="UTC (GMT+00:00)">UTC (GMT+00:00)</option>
                                                        <option value="America/New_York (GMT-05:00)">America/New_York (GMT-05:00)</option>
                                                        <option value="Europe/London (GMT+00:00)">Europe/London (GMT+00:00)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Repeat Schedule</label>
                                                    <select
                                                        value={repeatOption}
                                                        onChange={(e) => setRepeatOption(e.target.value)}
                                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium"
                                                    >
                                                        <option value="None">None (One-time)</option>
                                                        <option value="Daily">Daily</option>
                                                        <option value="Weekly">Weekly</option>
                                                        <option value="Monthly">Monthly</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Sending Throttle Velocity</label>
                                        <select value={messagesPerMin} onChange={(e) => setMessagesPerMin(e.target.value)} className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl font-medium">
                                            <option value="60">60 Messages / Minute (Standard Safe)</option>
                                            <option value="120">120 Messages / Minute (High Speed)</option>
                                            <option value="30">30 Messages / Minute (Ultra Safe)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 4 && (
                                <div className="space-y-4 animate-fade-in">
                                    <h3 className="text-sm font-bold text-slate-800 font-display">Step 4: Campaign Audit & Compliance</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs">
                                            <span className="text-slate-700 font-medium">✓ DND Numbers Filtered</span>
                                            <span className="font-bold text-emerald-600">32 Contacts Excluded</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs">
                                            <span className="text-slate-700 font-medium">✓ Duplicate Phone Numbers Deduplicated</span>
                                            <span className="font-bold text-emerald-600">18 Duplicates Removed</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs">
                                            <span className="text-slate-700 font-medium">✓ Meta Variable Validation Passed</span>
                                            <span className="font-bold text-emerald-600">All Variables Mapped</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 5 && (
                                <div className="space-y-4 animate-fade-in text-center py-6">
                                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                                        <FiSend size={28} />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 font-display">Ready to Launch or Schedule Campaign!</h3>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                        {sendOption === "immediate"
                                            ? "Your campaign will immediately start broadcasting via WhatsApp simulation provider."
                                            : `Your campaign is scheduled for ${campaignDate} ${campaignTime} (${timeZone.split(" ")[0]}).`}
                                    </p>
                                </div>
                            )}

                            {/* Wizard Navigation Buttons */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <button
                                    disabled={wizardStep === 1}
                                    onClick={() => setWizardStep(s => s - 1)}
                                    className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                                >
                                    <FiChevronLeft size={14} /> Back
                                </button>
                                {wizardStep < 5 ? (
                                    <button
                                        onClick={() => setWizardStep(s => s + 1)}
                                        className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                                    >
                                        Next <FiChevronRight size={14} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleLaunchCampaign}
                                        disabled={launching}
                                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 cursor-pointer"
                                    >
                                        {launching ? <FiRefreshCw className="animate-spin" size={14} /> : <FiPlay size={14} />}
                                        <span>{launching ? "Processing..." : sendOption === "immediate" ? "Launch Campaign Now" : "Schedule Campaign"}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* RIGHT LIVE SUMMARY PANEL (30%) */}
                        <div className="lg:col-span-5 bg-slate-50/80 border border-slate-200/70 rounded-xl p-5 space-y-4">
                            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider font-display">Live Audience & Dispatch Summary</h4>
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                                    <span className="text-slate-500">Dispatch Mode</span>
                                    <span className="font-bold text-emerald-700 capitalize">{sendOption === "immediate" ? "Send Immediately" : "Scheduled"}</span>
                                </div>
                                {sendOption === "scheduled" && (
                                    <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                                        <span className="text-slate-500">Scheduled Time</span>
                                        <span className="font-bold text-slate-800">{campaignDate} {campaignTime}</span>
                                    </div>
                                )}
                                <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                                    <span className="text-slate-500">Target Contacts</span>
                                    <span className="font-bold text-slate-800">1,000</span>
                                </div>
                                <div className="flex justify-between py-2 bg-emerald-100/50 px-3 rounded-lg border border-emerald-200">
                                    <span className="font-bold text-emerald-800">Final Clean Audience</span>
                                    <span className="font-bold text-emerald-800 text-sm">950 Contacts</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CAMPAIGN OVERVIEW & MANAGEMENT TABLE */}
            {!isWizardOnly && (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 font-display">WhatsApp Bulk Campaigns Directory</h3>
                            <p className="text-xs text-slate-400 mt-0.5 font-sans">Manage scheduled, running, paused, and completed campaigns.</p>
                        </div>
                        <button
                            onClick={() => setShowWizard(true)}
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer self-start sm:self-auto"
                        >
                            <FiSend size={13} />
                            <span>Create Bulk Campaign</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campaign Name</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audience</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Time</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progress</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created By</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCampaigns.map((cmp) => (
                                    <tr key={cmp.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <span className="text-xs font-bold text-slate-800 block">{cmp.name}</span>
                                            <span className="text-[9px] text-slate-400 block mt-0.5">{cmp.template}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-700">{cmp.audience}</td>
                                        <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">{cmp.scheduledFormatted || cmp.scheduledDate}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-md border uppercase ${statusBadgeColors[cmp.status] || statusBadgeColors.Queued}`}>
                                                {cmp.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-24">
                                                <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                                                    <span>{cmp.progress || 0}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${cmp.progress || 0}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{cmp.createdBy || "Admin"}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => setDetailModal(cmp)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer" title="View Details">
                                                    <FiEye size={13} />
                                                </button>

                                                <button onClick={() => handleEdit(cmp)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 cursor-pointer" title="Edit Campaign">
                                                    <FiEdit2 size={13} />
                                                </button>

                                                {cmp.status === "Running" && (
                                                    <button onClick={() => handlePause(cmp.id)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg cursor-pointer" title="Pause Campaign">
                                                        <FiPause size={13} />
                                                    </button>
                                                )}

                                                {cmp.status === "Paused" && (
                                                    <button onClick={() => handleResume(cmp.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer" title="Resume Campaign">
                                                        <FiPlay size={13} />
                                                    </button>
                                                )}

                                                {(cmp.status === "Scheduled" || cmp.status === "Queued") && (
                                                    <button onClick={() => handleCancel(cmp.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer" title="Cancel Campaign">
                                                        <FiSlash size={13} />
                                                    </button>
                                                )}

                                                <button onClick={() => handleDuplicate(cmp)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer" title="Duplicate Campaign">
                                                    <FiCopy size={13} />
                                                </button>

                                                <button onClick={() => handleDelete(cmp.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer" title="Delete Campaign">
                                                    <FiTrash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DETAIL / COMPLETION REPORT MODAL */}
            {detailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setDetailModal(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 space-y-4 animate-slide-up">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 font-display">{detailModal.name}</h3>
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border uppercase mt-1 inline-block ${statusBadgeColors[detailModal.status]}`}>
                                    {detailModal.status}
                                </span>
                            </div>
                            <button onClick={() => setDetailModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><FiXCircle size={18} /></button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Contacts</span>
                                <span className="font-extrabold text-slate-800">{detailModal.totalContacts || detailModal.audience}</span>
                            </div>
                            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                                <span className="text-[9px] text-emerald-600 font-bold uppercase block">Delivered</span>
                                <span className="font-extrabold text-emerald-700">{detailModal.delivered || 0}</span>
                            </div>
                            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                                <span className="text-[9px] text-blue-600 font-bold uppercase block">Read</span>
                                <span className="font-extrabold text-blue-700">{detailModal.read || 0}</span>
                            </div>
                            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                                <span className="text-[9px] text-rose-600 font-bold uppercase block">Failed</span>
                                <span className="font-extrabold text-rose-700">{detailModal.failed || 0}</span>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                            <p className="flex justify-between"><span>Started At:</span> <strong className="text-slate-800">{detailModal.startedAt || "—"}</strong></p>
                            <p className="flex justify-between"><span>Completed At:</span> <strong className="text-slate-800">{detailModal.completedAt || "—"}</strong></p>
                            <p className="flex justify-between"><span>Duration:</span> <strong className="text-slate-800">{detailModal.duration || "—"}</strong></p>
                            <p className="flex justify-between"><span>Success Rate:</span> <strong className="text-emerald-600">98.4%</strong></p>
                        </div>

                        <button onClick={() => setDetailModal(null)} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer">
                            Close Report
                        </button>
                    </div>
                </div>
            )}

            {/* EDIT CAMPAIGN MODAL */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setEditModal(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                                <FiEdit2 className="text-emerald-500" size={16} /> Edit Campaign
                            </h3>
                            <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <FiXCircle size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Campaign Name</label>
                                <input
                                    type="text"
                                    value={editModal.name}
                                    onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">WhatsApp Template</label>
                                <select
                                    value={editModal.template}
                                    onChange={(e) => setEditModal({ ...editModal, template: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                >
                                    {templates.map(t => (
                                        <option key={t._id || t.name} value={t.name}>{t.name} ({t.category})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Audience</label>
                                <select
                                    value={editModal.targetAudience}
                                    onChange={(e) => setEditModal({ ...editModal, targetAudience: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                >
                                    <option value="all_leads">All Registered CRM Leads (1,000)</option>
                                    <option value="converted">Converted VIP Clients (420)</option>
                                    <option value="pending">Pending Follow-ups (380)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Dispatch Option</label>
                                <select
                                    value={editModal.sendMode}
                                    onChange={(e) => setEditModal({ ...editModal, sendMode: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                                >
                                    <option value="immediate">Immediate Dispatch</option>
                                    <option value="scheduled">Scheduled for Later</option>
                                </select>
                            </div>

                            {editModal.sendMode === "scheduled" && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Date</label>
                                            <input
                                                type="date"
                                                value={editModal.scheduledDate}
                                                onChange={(e) => setEditModal({ ...editModal, scheduledDate: e.target.value })}
                                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Time</label>
                                            <input
                                                type="time"
                                                value={editModal.scheduledTime}
                                                onChange={(e) => setEditModal({ ...editModal, scheduledTime: e.target.value })}
                                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Time Zone</label>
                                            <select
                                                value={editModal.timeZone}
                                                onChange={(e) => setEditModal({ ...editModal, timeZone: e.target.value })}
                                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium"
                                            >
                                                <option value="Asia/Kolkata (GMT+05:30)">Asia/Kolkata (GMT+05:30)</option>
                                                <option value="UTC (GMT+00:00)">UTC (GMT+00:00)</option>
                                                <option value="America/New_York (GMT-05:00)">America/New_York (GMT-05:00)</option>
                                                <option value="Europe/London (GMT+00:00)">Europe/London (GMT+00:00)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Repeat Schedule</label>
                                            <select
                                                value={editModal.repeat}
                                                onChange={(e) => setEditModal({ ...editModal, repeat: e.target.value })}
                                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium"
                                            >
                                                <option value="None">None (One-time)</option>
                                                <option value="Daily">Daily</option>
                                                <option value="Weekly">Weekly</option>
                                                <option value="Monthly">Monthly</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                onClick={() => setEditModal(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 cursor-pointer"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppCampaigns;
