import { useState } from "react";
import { useParams } from "react-router-dom";
import {
    FiUser, FiMail, FiPhone, FiLayers, FiCheckCircle, FiXCircle,
    FiCalendar, FiDollarSign, FiSearch, FiSliders, FiPlus, FiAlertCircle,
    FiX, FiCheck, FiZap, FiChevronDown, FiGift, FiFileText,
    FiList, FiVideo, FiMapPin, FiClock, FiInfo, FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import { useToast } from "../context/ToastContext";

/* ─── Local UI Helpers to match Delegation styling ─── */
function SectionCard({ icon: Icon, title, subtitle, children, accentColor = "indigo" }) {
    const colorMap = {
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
        sky: "text-sky-600 bg-sky-50 border-sky-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
        rose: "text-rose-600 bg-rose-50 border-rose-100",
    };
    const accent = colorMap[accentColor] || colorMap.indigo;
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm w-full">
            <div className="flex items-start gap-3.5 px-6 py-5 border-b border-slate-100">
                <div className={`p-2 rounded-xl border ${accent} flex-shrink-0`}>
                    <Icon size={15} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-slate-800 font-display">{title}</h3>
                    {subtitle && (
                        <p className="text-xs text-slate-400 mt-0.5 font-sans leading-relaxed">{subtitle}</p>
                    )}
                </div>
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

function InputLabel({ children, required }) {
    return (
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 font-sans">
            {children}
            {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
    );
}

export default function CRMView() {
    const { view } = useParams();
    const { showToast } = useToast();

    // In-memory mock leads state to allow basic interactive search & creation
    const [leads, setLeads] = useState([
        { id: 1, name: "Acme Corp", contact: "Alice Vance", email: "alice@acme.com", value: 12000, status: "Meeting Scheduled", date: "2026-06-25" },
        { id: 2, name: "Globex Corporation", contact: "Bob Vance", email: "bob@globex.com", value: 45000, status: "Converted", date: "2026-06-20" },
        { id: 3, name: "Initech", contact: "Peter Gibbons", email: "peter@initech.com", value: 8500, status: "Contacted", date: "2026-06-24" },
        { id: 4, name: "Umbrella Corp", contact: "Albert Wesker", email: "wesker@umbrella.com", value: 95000, status: "Lost", date: "2026-06-15" },
        { id: 5, name: "Hooli", contact: "Gavin Belson", email: "gavin@hooli.xyz", value: 150000, status: "Converted", date: "2026-06-18" },
        { id: 6, name: "Veer Industries", contact: "Rajesh Veer", email: "rajesh@veer.in", value: 30000, status: "Meeting Scheduled", date: "2026-06-26" },
        { id: 7, name: "Soylent Corp", contact: "Robert Thorn", email: "thorn@soylent.org", value: 15000, status: "Lost", date: "2026-06-10" }
    ]);

    // REDESIGNED Meetings mock database and control states
    const [meetings, setMeetings] = useState([
        {
            id: "mtg-1",
            leadId: 1,
            clientName: "Acme Corp",
            category: "Product Demo",
            location: "Zoom Video",
            date: "2026-06-25",
            time: "10:30 AM",
            duration: "45 mins",
            phone: "+91 98765 43210",
            notes: "Initial consultation to discuss custom ecommerce integration, Stripe payment gateway configurations, and inventory sync options.",
            attendees: ["Alice Vance", "purab rahangdale"],
            status: "Completed"
        },
        {
            id: "mtg-2",
            leadId: 6,
            clientName: "Veer Industries",
            category: "Consultation",
            location: "On-Site Office",
            date: "2026-06-26",
            time: "02:00 PM",
            duration: "60 mins",
            phone: "+91 87654 32109",
            notes: "Detailed architecture design review of CRM features and dashboard customization needs for team workflows.",
            attendees: ["Rajesh Veer", "Divya Teja"],
            status: "Scheduled"
        },
        {
            id: "mtg-3",
            leadId: 3,
            clientName: "Initech",
            category: "Follow-up",
            location: "Phone Call",
            date: "2026-06-28",
            time: "11:00 AM",
            duration: "30 mins",
            phone: "+91 76543 21098",
            notes: "Quick check-in to align on timeline estimates and coordinate developer allocations.",
            attendees: ["Peter Gibbons", "Aman Verma"],
            status: "Scheduled"
        }
    ]);

    const [selectedDate, setSelectedDate] = useState("2026-06-26");
    const [layoutMode, setLayoutMode] = useState("calendar"); // "calendar" | "list"
    const [filterPendingOnly, setFilterPendingOnly] = useState(false);
    const [selectedMeetingForMom, setSelectedMeetingForMom] = useState(null);
    const [selectedLeadForDetails, setSelectedLeadForDetails] = useState(null);
    const [isMomModalOpen, setIsMomModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [momText, setMomText] = useState("");

    const [meetingForm, setMeetingForm] = useState({
        leadId: "",
        category: "Product Demo",
        location: "Zoom Video",
        date: "2026-06-26",
        time: "10:00 AM",
        duration: "30 mins",
        notes: "",
        attendees: ""
    });

    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const getDaysInMonth = (month, year) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month, year) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const getFilteredMeetings = () => {
        let list = meetings;
        if (filterPendingOnly) {
            list = list.filter((m) => m.status === "Scheduled" || m.status === "Rescheduled");
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((m) =>
                m.clientName.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q) ||
                (m.notes && m.notes.toLowerCase().includes(q))
            );
        }
        return list;
    };

    const getMeetingsForSelectedDate = () => {
        const filtered = getFilteredMeetings();
        if (selectedDate) {
            return filtered.filter((m) => m.date === selectedDate);
        }
        return filtered;
    };

    const handleScheduleMeeting = (e) => {
        if (e) e.preventDefault();

        if (!meetingForm.leadId) {
            showToast("Please select a pipeline lead.", "error");
            return;
        }

        const selectedLead = leads.find((l) => String(l.id) === meetingForm.leadId);
        if (!selectedLead) {
            showToast("Selected lead could not be found.", "error");
            return;
        }

        const newMtg = {
            id: `mtg-${Date.now()}`,
            leadId: selectedLead.id,
            clientName: selectedLead.name,
            category: meetingForm.category,
            location: meetingForm.location,
            date: meetingForm.date,
            time: meetingForm.time,
            duration: meetingForm.duration || "30 mins",
            phone: selectedLead.phone || "+91 99999 99999",
            notes: meetingForm.notes,
            attendees: meetingForm.attendees
                ? meetingForm.attendees.split(",").map(s => s.trim()).filter(Boolean)
                : [selectedLead.contact || selectedLead.name, "purab rahangdale"],
            status: "Scheduled"
        };

        setMeetings([newMtg, ...meetings]);

        if (selectedLead.status !== "Meeting Scheduled") {
            const updatedLeads = leads.map((l) =>
                l.id === selectedLead.id ? { ...l, status: "Meeting Scheduled" } : l
            );
            setLeads(updatedLeads);
        }

        showToast(`Meeting with '${selectedLead.name}' scheduled successfully!`, "success");
        setIsScheduleModalOpen(false);
        setMeetingForm({
            leadId: "",
            category: "Product Demo",
            location: "Zoom Video",
            date: "2026-06-26",
            time: "10:00 AM",
            duration: "30 mins",
            notes: "",
            attendees: ""
        });
    };

    const handleSaveMom = (e) => {
        if (e) e.preventDefault();
        if (!selectedMeetingForMom) return;

        const updated = meetings.map((m) =>
            m.id === selectedMeetingForMom.id ? { ...m, notes: momText, status: "Completed" } : m
        );
        setMeetings(updated);
        showToast(`MOM updated and meeting marked as 'Completed'`, "success");
        setIsMomModalOpen(false);
        setSelectedMeetingForMom(null);
        setMomText("");
    };


    const [leadForm, setLeadForm] = useState({
        name: "",
        phone: "",
        email: "",
        spouseName: "",
        spouseMobile: "",
        leadSource: "Walk-In",
        referredBy: "",
        referrerPhone: "",
        referralEmail: "",
        projectType: "Residential",
        value: "",
        status: "Contacted",
        requirements: ""
    });

    const [searchQuery, setSearchQuery] = useState("");

    const handleCreateLead = (e) => {
        if (e) e.preventDefault();
        if (!leadForm.name || !leadForm.phone || !leadForm.email) {
            showToast("Please fill in all required fields.", "error");
            return;
        }
        const newLead = {
            id: Date.now(),
            name: leadForm.name,
            contact: leadForm.name,
            email: leadForm.email,
            phone: leadForm.phone,
            value: parseFloat(leadForm.value) || 0,
            status: leadForm.status,
            date: new Date().toISOString().split("T")[0]
        };
        setLeads([newLead, ...leads]);
        showToast(`Enquiry for '${leadForm.name}' registered successfully!`, "success");
        handleReset();
    };

    const handleReset = () => {
        setLeadForm({
            name: "",
            phone: "",
            email: "",
            spouseName: "",
            spouseMobile: "",
            leadSource: "Walk-In",
            referredBy: "",
            referrerPhone: "",
            referralEmail: "",
            projectType: "Residential",
            value: "",
            status: "Contacted",
            requirements: ""
        });
    };

    // Filter logic based on the active view
    const getFilteredLeads = () => {
        let list = leads;

        if (view === "converted") {
            list = list.filter(l => l.status === "Converted");
        } else if (view === "lost") {
            list = list.filter(l => l.status === "Lost");
        } else if (view === "meetings") {
            list = list.filter(l => l.status === "Meeting Scheduled");
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(l =>
                l.name.toLowerCase().includes(q) ||
                (l.contact && l.contact.toLowerCase().includes(q)) ||
                l.email.toLowerCase().includes(q)
            );
        }

        return list;
    };

    const filteredLeads = getFilteredLeads();

    // Stats calculations
    const totalLeads = leads.length;
    const totalValue = leads.reduce((acc, curr) => acc + curr.value, 0);
    const convertedCount = leads.filter(l => l.status === "Converted").length;
    const lostCount = leads.filter(l => l.status === "Lost").length;
    const meetingsCount = leads.filter(l => l.status === "Meeting Scheduled").length;

    // View metadata builder
    const getViewMetadata = () => {
        switch (view) {
            case "dashboard":
                return {
                    title: "CRM Dashboard",
                    subtitle: "Real-time pipeline metrics, opportunities tracking, and team sales conversions.",
                    color: "indigo"
                };
            case "create-lead":
                return {
                    title: "Create New Enquiry",
                    subtitle: "Register a new prospective client and their initial project requirements.",
                    color: "violet"
                };
            case "meetings":
                return {
                    title: "Scheduled Meetings",
                    subtitle: "List of pipeline prospects with scheduled product demos or consultations.",
                    color: "sky"
                };
            case "converted":
                return {
                    title: "Converted Deals",
                    subtitle: "Successfully closed opportunities that have transitioned into active customers.",
                    color: "emerald"
                };
            case "lost":
                return {
                    title: "Lost Opportunities",
                    subtitle: "Leads marked as closed/lost, archived for training and analytics audits.",
                    color: "rose"
                };
            case "leads":
            default:
                return {
                    title: "All Leads",
                    subtitle: "Complete repository of active, incoming, and archived CRM opportunities.",
                    color: "indigo"
                };
        }
    };

    const MeetingCard = ({ meeting }) => {
        const statusColors = {
            Scheduled: "bg-indigo-50 text-indigo-755 border-indigo-100",
            Completed: "bg-emerald-50 text-emerald-755 border-emerald-100",
            Rescheduled: "bg-amber-50 text-amber-755 border-amber-100",
            Cancelled: "bg-rose-50 text-rose-755 border-rose-100"
        };

        const handleStatusChange = (newStatus) => {
            const updated = meetings.map((m) =>
                m.id === meeting.id ? { ...m, status: newStatus } : m
            );
            setMeetings(updated);
            showToast(`Meeting status updated to '${newStatus}'`, "success");
        };

        return (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] hover:shadow-md hover:border-slate-350 transition-all duration-200 flex flex-col relative overflow-hidden group">
                {/* Thick accent status bar on left */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${meeting.status === "Completed"
                        ? "bg-emerald-500"
                        : meeting.status === "Cancelled"
                            ? "bg-rose-500"
                            : meeting.status === "Rescheduled"
                                ? "bg-amber-500"
                                : "bg-indigo-500"
                    }`} />

                <div className="p-5 pl-6 space-y-4">
                    {/* Top Row: Client Name and Badge / Dropdown */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">
                                {meeting.clientName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide font-sans flex items-center gap-1">
                                    <FiZap size={9} />
                                    {meeting.category}
                                </span>
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide font-sans flex items-center gap-1">
                                    <FiMapPin size={9} />
                                    {meeting.location}
                                </span>
                            </div>
                        </div>

                        {/* Status Select dropdown */}
                        <div className="relative">
                            <select
                                value={meeting.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                className={`text-[10px] font-bold uppercase border px-2 py-1 rounded-lg bg-white cursor-pointer focus:outline-none transition ${statusColors[meeting.status] || "bg-slate-50 text-slate-650 border-slate-100"
                                    }`}
                            >
                                <option value="Scheduled">Scheduled</option>
                                <option value="Completed">Completed</option>
                                <option value="Rescheduled">Rescheduled</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Middle details row */}
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-slate-500 font-sans border-t border-b border-slate-100/50 py-3">
                        <div className="flex items-center gap-2">
                            <FiCalendar size={13} className="text-slate-400" />
                            <span>{meeting.date} at {meeting.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FiClock size={13} className="text-slate-400" />
                            <span>{meeting.duration}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <FiPhone size={13} className="text-slate-400" />
                            <span>{meeting.phone}</span>
                        </div>
                    </div>

                    {/* Meeting Notes */}
                    {meeting.notes && (
                        <div className="space-y-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100 font-sans">
                            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                                <FiFileText size={11} />
                                <span>Meeting Notes / Agenda</span>
                            </span>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                {meeting.notes}
                            </p>
                        </div>
                    )}

                    {/* Attendees avatars section */}
                    <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                                Attendees:
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                                {meeting.attendees.map((att, index) => (
                                    <span
                                        key={index}
                                        className="text-[10px] font-semibold bg-indigo-50/50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100/50"
                                    >
                                        {att}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedMeetingForMom(meeting);
                                    setMomText(meeting.notes || "");
                                    setIsMomModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 hover:border-transparent px-3 py-1.5 rounded-lg transition-all cursor-pointer bg-white"
                            >
                                Record MOM
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const lead = leads.find((l) => l.id === meeting.leadId);
                                    if (lead) {
                                        setSelectedLeadForDetails(lead);
                                    } else {
                                        setSelectedLeadForDetails({
                                            name: meeting.clientName,
                                            contact: meeting.clientName,
                                            email: "No email stored",
                                            phone: meeting.phone,
                                            value: 0,
                                            status: "Meeting Scheduled",
                                            date: meeting.date,
                                            requirements: meeting.notes
                                        });
                                    }
                                }}
                                className="text-[11px] font-bold text-slate-650 hover:text-white hover:bg-slate-700 border border-slate-200 hover:border-transparent px-3 py-1.5 rounded-lg transition-all cursor-pointer bg-white"
                            >
                                View Lead Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const meta = getViewMetadata();

    return (
        <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-6">

            {/* Page Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">
                        <span>CRM</span>
                        <span>/</span>
                        <span className="text-indigo-650">{meta.title}</span>
                    </div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                        {meta.title}
                    </h1>
                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-sans">
                        {meta.subtitle}
                    </p>
                </div>
                {view === "meetings" && (
                    <div className="flex items-center gap-3">
                        {/* Calendar / List Toggle Group */}
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setLayoutMode("calendar")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${layoutMode === "calendar"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-550 hover:text-slate-800"
                                    }`}
                            >
                                <FiCalendar size={13} />
                                <span>Calendar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLayoutMode("list")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${layoutMode === "list"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-550 hover:text-slate-800"
                                    }`}
                            >
                                <FiList size={13} />
                                <span>List</span>
                            </button>
                        </div>

                        {/* Schedule Meeting CTA */}
                        <button
                            type="button"
                            onClick={() => setIsScheduleModalOpen(true)}
                            className="flex items-center gap-1.5 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-lg transition-all border-0 cursor-pointer"
                        >
                            <FiPlus size={14} />
                            <span>Schedule Meeting</span>
                        </button>
                    </div>
                )}
                {view === "create-lead" && (
                    <button
                        onClick={handleReset}
                        className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100"
                    >
                        <FiX size={11} />
                        Clear Form
                    </button>
                )}
            </div>

            {/* Metrics Row (not shown in create form or meetings view to match full-width reference design) */}
            {view !== "create-lead" && view !== "meetings" && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value</span>
                        <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">
                            ${totalValue.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Converted Deals</span>
                        <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{convertedCount}</p>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Meetings</span>
                        <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{meetingsCount}</p>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Lost Ratio</span>
                        <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">
                            {totalLeads > 0 ? Math.round((lostCount / totalLeads) * 100) : 0}%
                        </p>
                    </div>
                </div>
            )}

            {/* Main Interactive Views */}
            {view === "create-lead" ? (
                /* Full-Width Form Layout matching Reference Screenshot & Delegation color theme */
                <form onSubmit={handleCreateLead} className="w-full space-y-6">

                    {/* Section 1: Personal Information */}
                    <SectionCard icon={FiUser} title="Personal Information" subtitle="Client primary identification and contact credentials." accentColor="violet">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Full Name / Client Name */}
                            <div>
                                <InputLabel required>Full Name / Client Name</InputLabel>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Ex: Rajesh Kumar"
                                        value={leadForm.name}
                                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Contact Number */}
                            <div>
                                <InputLabel required>Contact Number</InputLabel>
                                <div className="relative flex">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
                                        <FiPhone size={14} />
                                        <span className="text-xs font-semibold border-r border-slate-200 pr-2">+91</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="10-digit mobile"
                                        value={leadForm.phone}
                                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-20 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Email Address */}
                            <div>
                                <InputLabel required>Email Address</InputLabel>
                                <div className="relative">
                                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="email"
                                        placeholder="client@example.com"
                                        value={leadForm.email}
                                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Spouse Name */}
                            <div>
                                <InputLabel>Spouse Name</InputLabel>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={leadForm.spouseName}
                                        onChange={(e) => setLeadForm({ ...leadForm, spouseName: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Spouse Mobile */}
                            <div>
                                <InputLabel>Spouse Mobile</InputLabel>
                                <div className="relative flex">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
                                        <FiPhone size={14} />
                                        <span className="text-xs font-semibold border-r border-slate-200 pr-2">+91</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={leadForm.spouseMobile}
                                        onChange={(e) => setLeadForm({ ...leadForm, spouseMobile: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-20 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Section 2: Referral & Source */}
                    <SectionCard icon={FiGift} title="Referral & Source" subtitle="Campaign track channels and external lead referrers." accentColor="indigo">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Lead Source */}
                            <div>
                                <InputLabel>Lead Source</InputLabel>
                                <select
                                    value={leadForm.leadSource}
                                    onChange={(e) => setLeadForm({ ...leadForm, leadSource: e.target.value })}
                                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                >
                                    <option>Walk-In</option>
                                    <option>Referral</option>
                                    <option>Instagram</option>
                                    <option>Facebook</option>
                                    <option>Website</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            {/* Referred By */}
                            <div>
                                <InputLabel>Referred By</InputLabel>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Name / Instagram handle"
                                        value={leadForm.referredBy}
                                        onChange={(e) => setLeadForm({ ...leadForm, referredBy: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Referrer Phone */}
                            <div>
                                <InputLabel>Referrer Phone</InputLabel>
                                <div className="relative flex">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
                                        <FiPhone size={14} />
                                        <span className="text-xs font-semibold border-r border-slate-200 pr-2">+91</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={leadForm.referrerPhone}
                                        onChange={(e) => setLeadForm({ ...leadForm, referrerPhone: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-20 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Referral Email */}
                            <div>
                                <InputLabel>Referral Email</InputLabel>
                                <div className="relative">
                                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="email"
                                        placeholder="Optional"
                                        value={leadForm.referralEmail}
                                        onChange={(e) => setLeadForm({ ...leadForm, referralEmail: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Project Type */}
                            <div>
                                <InputLabel>Project Type</InputLabel>
                                <select
                                    value={leadForm.projectType}
                                    onChange={(e) => setLeadForm({ ...leadForm, projectType: e.target.value })}
                                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                >
                                    <option>Residential</option>
                                    <option>Commercial</option>
                                    <option>Renovation</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Section 3: Project Requirements */}
                    <SectionCard icon={FiFileText} title="Project Requirements" subtitle="Project budget, target details and client demands." accentColor="emerald">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Deal Value */}
                                <div>
                                    <InputLabel>Estimated Deal Value ($)</InputLabel>
                                    <div className="relative">
                                        <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                        <input
                                            type="number"
                                            placeholder="e.g. 15000"
                                            value={leadForm.value}
                                            onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })}
                                            className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                        />
                                    </div>
                                </div>

                                {/* Status */}
                                <div>
                                    <InputLabel>Pipeline Status</InputLabel>
                                    <select
                                        value={leadForm.status}
                                        onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                    >
                                        <option>Contacted</option>
                                        <option>Meeting Scheduled</option>
                                        <option>Converted</option>
                                        <option>Lost</option>
                                    </select>
                                </div>
                            </div>

                            {/* Requirements Notes */}
                            <div>
                                <InputLabel>Requirements & Notes</InputLabel>
                                <textarea
                                    rows={4}
                                    placeholder="Describe specific client requirements, site details, and project notes..."
                                    value={leadForm.requirements}
                                    onChange={(e) => setLeadForm({ ...leadForm, requirements: e.target.value })}
                                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans resize-none"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Form Actions footer */}
                    <div className="flex justify-end gap-3.5 pt-2">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="h-12 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                        >
                            Reset Form
                        </button>
                        <button
                            type="submit"
                            className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition cursor-pointer flex items-center gap-1.5 border-0"
                        >
                            <FiCheck size={14} />
                            Register Enquiry
                        </button>
                    </div>
                </form>
            ) : view === "dashboard" ? (
                /* Dashboard Analytics & Summary Lists */
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    {/* Pipeline Summary Column */}
                    <div className="xl:col-span-2 space-y-5">
                        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold text-slate-800 font-display">Sales Funnel Progress</h3>
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Live Status</span>
                            </div>

                            <div className="space-y-4 pt-1 font-sans text-xs">
                                <div>
                                    <div className="flex justify-between text-slate-600 mb-1.5 font-semibold">
                                        <span>Demos Scheduled</span>
                                        <span>{meetingsCount} Leads</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(meetingsCount / totalLeads) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-slate-600 mb-1.5 font-semibold">
                                        <span>Won / Converted Contract value</span>
                                        <span>{convertedCount} Won</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(convertedCount / totalLeads) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Leads in Dashboard */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 font-display">Active Pipeline Items</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                                            <th className="pb-3 pr-4">Company</th>
                                            <th className="pb-3 pr-4">Contact</th>
                                            <th className="pb-3 pr-4">Deal Value</th>
                                            <th className="pb-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                        {leads.slice(0, 4).map((l) => (
                                            <tr key={l.id} className="hover:bg-slate-50/50">
                                                <td className="py-3 pr-4 font-bold text-slate-900">{l.name}</td>
                                                <td className="py-3 pr-4">{l.contact}</td>
                                                <td className="py-3 pr-4">${l.value.toLocaleString()}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase ${l.status === "Converted"
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                            : l.status === "Lost"
                                                                ? "bg-rose-50 text-rose-700 border-rose-100"
                                                                : "bg-indigo-50 text-indigo-700 border-indigo-100"
                                                        }`}>
                                                        {l.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar widgets inside CRM dashboard */}
                    <div className="space-y-5">
                        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 font-display">Campaign Tips</h3>
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 font-medium leading-relaxed font-sans">
                                Keep follow-up schedules under 48 hours for leads marked as 'Meeting Scheduled' to double conversion velocities.
                            </div>
                        </div>
                    </div>
                </div>
            ) : view === "meetings" ? (
                /* REDESIGNED Meetings Workspace */
                <div className="space-y-6 animate-fade-in font-sans">
                    {/* Filter controls row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[280px]">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiSearch size={14} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search meetings by client name, category, or notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-850 placeholder-slate-450 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-10 shadow-sm"
                            />
                        </div>
                    </div>

                    {layoutMode === "calendar" ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                            {/* Left-side Panel Column */}
                            <div className="lg:col-span-1 space-y-5">
                                {/* Calendar Panel Card */}
                                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-800 font-display">
                                            {monthNames[currentMonth]} {currentYear}
                                        </h3>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={handlePrevMonth}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-555 hover:text-slate-850 transition cursor-pointer border-0 bg-transparent"
                                            >
                                                <FiChevronLeft size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleNextMonth}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-555 hover:text-slate-850 transition cursor-pointer border-0 bg-transparent"
                                            >
                                                <FiChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Days of Week Header */}
                                    <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[10px] text-slate-400 uppercase font-sans pb-1.5">
                                        <span>Su</span>
                                        <span>Mo</span>
                                        <span>Tu</span>
                                        <span>We</span>
                                        <span>Th</span>
                                        <span>Fr</span>
                                        <span>Sa</span>
                                    </div>

                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-1 font-sans text-xs">
                                        {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, idx) => (
                                            <div key={`empty-${idx}`} className="p-2" />
                                        ))}
                                        {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, idx) => {
                                            const dayNum = idx + 1;
                                            const formattedDay = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

                                            const meetingsOnDay = meetings.filter((m) => m.date === formattedDay);
                                            const hasMeetings = meetingsOnDay.length > 0;

                                            const isSelected = selectedDate === formattedDay;
                                            const isToday = new Date().toISOString().split("T")[0] === formattedDay;

                                            return (
                                                <button
                                                    key={`day-${dayNum}`}
                                                    type="button"
                                                    onClick={() => setSelectedDate(formattedDay)}
                                                    className={`relative p-2 h-9 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer group ${isSelected
                                                            ? "bg-indigo-650 text-white shadow-sm font-extrabold scale-105"
                                                            : isToday
                                                                ? "border border-indigo-200 text-indigo-600 hover:bg-indigo-50/50"
                                                                : "text-slate-600 hover:bg-slate-100"
                                                        }`}
                                                >
                                                    <span>{dayNum}</span>
                                                    {hasMeetings && (
                                                        <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-500"
                                                            }`} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-450 font-semibold flex items-center justify-between">
                                        <span>Selected Date:</span>
                                        <span className="text-slate-700 font-bold font-sans">{selectedDate || "All"}</span>
                                    </div>
                                </div>

                                {/* Pending Filter Card */}
                                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-3.5">
                                    <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                                            Meeting Filters
                                        </h3>
                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                            Live
                                        </span>
                                    </div>

                                    <label className="flex items-center gap-2.5 text-xs font-bold text-slate-650 cursor-pointer select-none py-1">
                                        <input
                                            type="checkbox"
                                            checked={filterPendingOnly}
                                            onChange={(e) => setFilterPendingOnly(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-650 border-slate-350 focus:ring-indigo-500 transition cursor-pointer"
                                        />
                                        <span>Show Pending Meetings Only</span>
                                    </label>

                                    {filterPendingOnly ? (
                                        <div className="text-[10px] text-indigo-650 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50 font-semibold leading-relaxed font-sans flex items-start gap-1.5 animate-fade-in">
                                            <FiInfo size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                                            <span>Displaying only Scheduled & Rescheduled consults. Completed and Cancelled events are hidden.</span>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-slate-450 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 font-semibold leading-relaxed font-sans">
                                            Currently showing all meeting statuses (Scheduled, Completed, Rescheduled, Cancelled).
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right-side Meeting list cards */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between pb-1">
                                    <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">
                                        Meetings {selectedDate ? `for ${selectedDate}` : "List"}
                                    </span>
                                    {getMeetingsForSelectedDate().length > 0 && (
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
                                            {getMeetingsForSelectedDate().length} Events
                                        </span>
                                    )}
                                </div>
                                {getMeetingsForSelectedDate().length > 0 ? (
                                    <div className="space-y-4">
                                        {getMeetingsForSelectedDate().map((mtg) => (
                                            <MeetingCard key={mtg.id} meeting={mtg} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
                                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-450">
                                            <FiCalendar size={22} className="opacity-70" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-slate-750">No Meetings Scheduled</h4>
                                            <p className="text-xs text-slate-400 max-w-[280px] mx-auto font-medium">
                                                There are no events registered for {selectedDate}. Schedule a new consult or view all.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDate("")}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold underline transition cursor-pointer border-0 bg-transparent"
                                        >
                                            View All Meetings
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* List View - Full width cards */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-1">
                                <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">
                                    All Scheduled Meetings ({getFilteredMeetings().length})
                                </span>
                            </div>
                            {getFilteredMeetings().length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {getFilteredMeetings().map((mtg) => (
                                        <MeetingCard key={mtg.id} meeting={mtg} />
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
                                    <FiAlertCircle size={28} className="text-slate-350 animate-pulse" />
                                    <span className="text-sm font-semibold text-slate-800">No meetings match search query</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Floating action / help button */}
                    <div className="fixed bottom-6 right-6 z-40 group">
                        <div className="absolute right-0 bottom-14 w-64 bg-slate-900 text-white text-xs p-3.5 rounded-2xl shadow-xl border border-slate-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 translate-y-2 group-hover:translate-y-0 leading-relaxed font-sans">
                            <div className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5 font-display text-[13px]">
                                <FiZap size={13} />
                                <span>Quick CRM Tips</span>
                            </div>
                            Schedule consultations and log Minutes of Meetings (MOM) immediately to capture specifications and speed up delegation workflows.
                        </div>
                        <button
                            type="button"
                            className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all border-0 cursor-pointer transform hover:scale-105"
                        >
                            <FiInfo size={20} />
                        </button>
                    </div>

                    {/* Modals integrated inside view content */}
                    {/* Schedule Meeting Modal */}
                    {isScheduleModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Schedule New Consultation</h3>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Link a pipeline lead to a designated date and agenda.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsScheduleModalOpen(false)}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>

                                <form onSubmit={handleScheduleMeeting} className="p-6 space-y-4">
                                    <div>
                                        <InputLabel required>Select Pipeline Lead / Prospect</InputLabel>
                                        <select
                                            value={meetingForm.leadId}
                                            onChange={(e) => {
                                                const lead = leads.find(l => String(l.id) === e.target.value);
                                                setMeetingForm({
                                                    ...meetingForm,
                                                    leadId: e.target.value,
                                                    attendees: lead ? `${lead.contact}, purab rahangdale` : "purab rahangdale"
                                                });
                                            }}
                                            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                            required
                                        >
                                            <option value="">-- Choose Lead --</option>
                                            {leads.map((l) => (
                                                <option key={l.id} value={l.id}>
                                                    {l.name} (${l.value.toLocaleString()})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <InputLabel>Category</InputLabel>
                                            <select
                                                value={meetingForm.category}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, category: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                            >
                                                <option>Product Demo</option>
                                                <option>Consultation</option>
                                                <option>Follow-up</option>
                                                <option>Pricing Review</option>
                                                <option>Contract Signoff</option>
                                            </select>
                                        </div>
                                        <div>
                                            <InputLabel>Location</InputLabel>
                                            <select
                                                value={meetingForm.location}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                            >
                                                <option>Zoom Video</option>
                                                <option>Google Meet</option>
                                                <option>On-Site Office</option>
                                                <option>Client Location</option>
                                                <option>Phone Call</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2">
                                            <InputLabel required>Date</InputLabel>
                                            <input
                                                type="date"
                                                value={meetingForm.date}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <InputLabel required>Time</InputLabel>
                                            <input
                                                type="text"
                                                placeholder="e.g. 10:00 AM"
                                                value={meetingForm.time}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <InputLabel>Duration</InputLabel>
                                            <input
                                                type="text"
                                                placeholder="e.g. 45 mins"
                                                value={meetingForm.duration}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, duration: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <InputLabel>Attendees (Comma separated)</InputLabel>
                                            <input
                                                type="text"
                                                placeholder="e.g. Alice Vance, purab rahangdale"
                                                value={meetingForm.attendees}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <InputLabel>Notes / Agenda Description</InputLabel>
                                        <textarea
                                            rows={3}
                                            placeholder="Detail specific client consultation objectives and discussion roadmap..."
                                            value={meetingForm.notes}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3 rounded-xl outline-none transition font-sans resize-none"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setIsScheduleModalOpen(false)}
                                            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition cursor-pointer border-0"
                                        >
                                            Schedule Event
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Record MOM Modal */}
                    {isMomModalOpen && selectedMeetingForMom && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Record Minutes of Meeting (MOM)</h3>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Update notes for the meeting with {selectedMeetingForMom.clientName}.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMomModalOpen(false);
                                            setSelectedMeetingForMom(null);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>

                                <form onSubmit={handleSaveMom} className="p-6 space-y-4">
                                    <div>
                                        <InputLabel>MOM Notes / Discussion Summary</InputLabel>
                                        <textarea
                                            rows={6}
                                            placeholder="Ex: Discussed timeline milestones. Client signed off on checkout page layouts but requested adding Stripe invoice automation."
                                            value={momText}
                                            onChange={(e) => setMomText(e.target.value)}
                                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans resize-none"
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsMomModalOpen(false);
                                                setSelectedMeetingForMom(null);
                                            }}
                                            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="submit"
                                            className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition cursor-pointer border-0"
                                        >
                                            Save Minutes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* View Lead Details Modal */}
                    {selectedLeadForDetails && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Client Pipeline Card</h3>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Enquiry record and project details.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLeadForDetails(null)}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>

                                <div className="p-6 space-y-4 font-sans text-xs">
                                    <div className="pb-3 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Company / Lead Name</span>
                                        <h4 className="text-base font-extrabold text-slate-850 font-display mt-0.5">{selectedLeadForDetails.name}</h4>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Primary Contact</span>
                                            <span className="font-semibold text-slate-700 block mt-1">{selectedLeadForDetails.contact || "N/A"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Value</span>
                                            <span className="font-bold text-indigo-600 block mt-1">${(selectedLeadForDetails.value || 0).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                                            <span className="text-slate-600 block mt-1 break-all">{selectedLeadForDetails.email}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pipeline Status</span>
                                            <span className="inline-block mt-1 font-bold text-indigo-500 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-150 uppercase text-[9px] tracking-wider">
                                                {selectedLeadForDetails.status}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedLeadForDetails.requirements && (
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lead Specifications</span>
                                            <p className="text-slate-600 leading-relaxed text-[11px] font-medium">
                                                {selectedLeadForDetails.requirements}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLeadForDetails(null)}
                                        className="h-9 px-5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer border-0"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* General Leads Table View (for converted, lost, meetings, all leads) */
                <div className="space-y-4">
                    {/* Filter controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Search field */}
                        <div className="relative flex-1 min-w-[280px]">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiSearch size={14} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search leads by company, contact, or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-10 shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {filteredLeads.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-550 font-bold uppercase tracking-wider">
                                            <th className="px-6 py-4">Company</th>
                                            <th className="px-6 py-4">Contact</th>
                                            <th className="px-6 py-4">Email</th>
                                            <th className="px-6 py-4">Created Date</th>
                                            <th className="px-6 py-4">Deal Value</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium font-sans">
                                        {filteredLeads.map((l) => (
                                            <tr key={l.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                <td className="px-6 py-4 font-bold text-slate-900">{l.name}</td>
                                                <td className="px-6 py-4">{l.contact}</td>
                                                <td className="px-6 py-4 text-slate-500">{l.email}</td>
                                                <td className="px-6 py-4 text-slate-450">{l.date}</td>
                                                <td className="px-6 py-4 text-slate-800 font-semibold">${l.value.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border uppercase tracking-wide ${l.status === "Converted"
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                            : l.status === "Lost"
                                                                ? "bg-rose-50 text-rose-700 border-rose-100"
                                                                : "bg-indigo-50 text-indigo-700 border-indigo-100"
                                                        }`}>
                                                        {l.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-12 text-center flex flex-col items-center justify-center gap-2.5 font-sans">
                                <FiAlertCircle size={28} className="text-slate-350 animate-pulse" />
                                <span className="text-sm font-semibold text-slate-800">No CRM leads found</span>
                                <span className="text-xs text-slate-400">There are no leads in this category matching your search.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
