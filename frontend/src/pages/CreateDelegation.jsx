import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getEmployees } from "../services/employeeApi";
import { addTask } from "../services/taskApi";
import { useToast } from "../context/ToastContext";
import {
    FiArrowLeft, FiFileText, FiUser, FiCalendar, FiCheckSquare, FiPaperclip,
    FiPlus, FiTrash2, FiSend, FiAlertCircle, FiSearch, FiCheck,
    FiZap, FiClock, FiChevronDown, FiX, FiUpload
} from "react-icons/fi";

/* ─── Priority Config ─────────────────────────────────────────────────── */
const PRIORITY_CONFIG = {
    Low: {
        active: "bg-emerald-50 border-emerald-300 text-emerald-700 ring-4 ring-emerald-100 shadow-sm scale-[1.01]",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
    },
    Medium: {
        active: "bg-blue-50 border-blue-300 text-blue-700 ring-4 ring-blue-100 shadow-sm scale-[1.01]",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
    },
    High: {
        active: "bg-amber-50 border-amber-300 text-amber-700 ring-4 ring-amber-100 shadow-sm scale-[1.01]",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
    },
    Urgent: {
        active: "bg-red-50 border-red-300 text-red-700 ring-4 ring-red-100 shadow-sm scale-[1.01]",
        badge: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-600",
    },
};

const PRIORITY_TIME_SUGGESTIONS = {
    Low: {
        text: "Recommended completion time: 30 days",
        style: "bg-emerald-50 text-emerald-700 border-emerald-100",
        icon: "text-emerald-500",
    },
    Medium: {
        text: "Recommended completion time: 20 days",
        style: "bg-amber-50 text-amber-700 border-amber-100",
        icon: "text-amber-500",
    },
    High: {
        text: "Recommended completion time: 10 days",
        style: "bg-rose-50 text-rose-700 border-rose-100",
        icon: "text-rose-500",
    },
    Urgent: {
        text: "Recommended completion time: 5 days",
        style: "bg-red-50 text-red-700 border-red-100",
        icon: "text-red-500",
    },
};

const PRIORITY_DEADLINE_LIMITS = {
    Low: 30,
    Medium: 20,
    High: 10,
    Urgent: 5,
};

const getTodayDateValue = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const normalizeDateValue = (value) => {
    if (!value) return "";
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const dateParts = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dateParts) {
        const [, day, month, year] = dateParts;
        return `${year}-${month}-${day}`;
    }

    return "";
};

const isPastDate = (value, todayValue) => {
    const normalizedValue = normalizeDateValue(value);
    return Boolean(normalizedValue) && normalizedValue < todayValue;
};

const addDaysToDateValue = (dateValue, days) => {
    const normalizedValue = normalizeDateValue(dateValue);
    if (!normalizedValue) return "";

    const [year, month, day] = normalizedValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);

    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
    const nextDay = String(date.getDate()).padStart(2, "0");
    return `${nextYear}-${nextMonth}-${nextDay}`;
};

const getPriorityDeadlineMessage = (priority) => {
    const limit = PRIORITY_DEADLINE_LIMITS[priority] || PRIORITY_DEADLINE_LIMITS.Medium;
    return `${priority} priority allows maximum ${limit} days deadline.`;
};

/* ─── Demo employees shown when API returns nothing ──────────────────── */
const DEMO_EMPLOYEES = [
    { id: "emp-001", name: "Nisha Patel",  role: "Frontend Engineer",  avatar: "NP" },
    { id: "emp-002", name: "Aman Verma",   role: "Backend Developer",   avatar: "AV" },
    { id: "emp-003", name: "Rohan Sharma", role: "UI/UX Designer",       avatar: "RS" },
    { id: "emp-004", name: "Rajesh Mehta", role: "Project Manager",      avatar: "RM" },
    { id: "emp-005", name: "Adarsh Singh", role: "QA Engineer",          avatar: "AS" },
    { id: "emp-006", name: "Priya Nair",   role: "HR Executive",         avatar: "PN" },
    { id: "emp-007", name: "Kunal Shah",   role: "DevOps Engineer",      avatar: "KS" },
    { id: "emp-008", name: "Sneha Iyer",   role: "Product Analyst",      avatar: "SI" },
];

/* ─── SectionCard subcomponent ─────────────────────────────────────────── */
function SectionCard({ icon: Icon, title, subtitle, children, accentColor = "indigo" }) {
    const colorMap = {
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
        sky: "text-sky-600 bg-sky-50 border-sky-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
    };
    const accent = colorMap[accentColor] || colorMap.indigo;
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
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

/* ─── Main Component ───────────────────────────────────────────────────── */
function CreateDelegation() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        title: "",
        description: "",
        priority: "Medium",
        project: "",
        deadline: "",
        startDate: "",
        status: "Pending",
    });
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [checklist, setChecklist] = useState([]);
    const [newCheckItem, setNewCheckItem] = useState("");
    const [notes, setNotes] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [dateValidationMessage, setDateValidationMessage] = useState("");
    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const employeeDropdownRef = useRef(null);

    useEffect(() => {
        const fetchEmployees = async () => {
            setLoadingEmployees(true);
            try {
                const data = await getEmployees();
                const list = Array.isArray(data) ? data : [];
                // Fall back to demo employees if API returns nothing
                setEmployees(list.length > 0 ? list : DEMO_EMPLOYEES);
            } catch (err) {
                console.error("Failed to fetch employees", err);
                setEmployees(DEMO_EMPLOYEES);
            } finally {
                setLoadingEmployees(false);
            }
        };
        fetchEmployees();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target)) {
                setShowEmployeeDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Derive active employees match list
    const filteredEmployees = employees.filter((emp) => {
        const q = employeeSearch.toLowerCase();
        const name = (emp.name || emp.employee_name || "").toLowerCase();
        const role = (emp.role || emp.position || emp.department || "").toLowerCase();
        return name.includes(q) || role.includes(q);
    });

    const completedChecklist = checklist.filter((c) => c.done).length;
    const checklistProgress = checklist.length > 0
        ? Math.round((completedChecklist / checklist.length) * 100)
        : 0;

    const todayDateValue = getTodayDateValue();
    const deadlineLimitDays = PRIORITY_DEADLINE_LIMITS[form.priority] || PRIORITY_DEADLINE_LIMITS.Medium;
    const deadlineMinDateValue = form.startDate || todayDateValue;
    const deadlineMaxDateValue = addDaysToDateValue(deadlineMinDateValue, deadlineLimitDays);
    const hasPastDate = isPastDate(form.startDate, todayDateValue) || isPastDate(form.deadline, todayDateValue);
    const isDeadlineBeyondPriorityLimit = Boolean(form.deadline) && form.deadline > deadlineMaxDateValue;
    const isDeadlineBeforeAllowedStart = Boolean(form.deadline) && form.deadline < deadlineMinDateValue;

    const validationErrors = [];
    if (!form.title.trim()) validationErrors.push("Delegation title is required");
    if (selectedEmployees.length === 0) validationErrors.push("Assignee must be selected");
    if (!form.deadline) validationErrors.push("Deadline is required");
    if (hasPastDate) validationErrors.push("Past dates are not allowed.");
    if (isDeadlineBeforeAllowedStart) validationErrors.push("Deadline cannot be before start date.");
    if (isDeadlineBeyondPriorityLimit) validationErrors.push(getPriorityDeadlineMessage(form.priority));
    const isValid = validationErrors.length === 0;

    const handleFieldChange = (field, value) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const handleDateChange = (field, value) => {
        const normalizedValue = normalizeDateValue(value);

        if (isPastDate(normalizedValue, todayDateValue)) {
            setDateValidationMessage("Past dates are not allowed.");
            setForm((prev) => ({ ...prev, [field]: todayDateValue }));
            return;
        }

        if (field === "deadline" && normalizedValue) {
            if (normalizedValue < deadlineMinDateValue) {
                setDateValidationMessage("");
                setForm((prev) => ({ ...prev, deadline: deadlineMinDateValue }));
                return;
            }

            if (normalizedValue > deadlineMaxDateValue) {
                setDateValidationMessage(getPriorityDeadlineMessage(form.priority));
                setForm((prev) => ({ ...prev, deadline: deadlineMaxDateValue }));
                return;
            }
        }

        setDateValidationMessage("");
        handleFieldChange(field, normalizedValue || value);
    };

    const handleDatePaste = (field, e) => {
        const pastedValue = e.clipboardData.getData("text").trim();
        const normalizedValue = normalizeDateValue(pastedValue);

        if (isPastDate(normalizedValue, todayDateValue)) {
            e.preventDefault();
            setDateValidationMessage("Past dates are not allowed.");
            setForm((prev) => ({ ...prev, [field]: todayDateValue }));
            return;
        }

        if (field === "deadline" && normalizedValue) {
            if (normalizedValue < deadlineMinDateValue) {
                e.preventDefault();
                setDateValidationMessage("");
                setForm((prev) => ({ ...prev, deadline: deadlineMinDateValue }));
                return;
            }

            if (normalizedValue > deadlineMaxDateValue) {
                e.preventDefault();
                setDateValidationMessage(getPriorityDeadlineMessage(form.priority));
                setForm((prev) => ({ ...prev, deadline: deadlineMaxDateValue }));
            }
        }
    };

    useEffect(() => {
        if (!form.deadline) return;

        if (isPastDate(form.deadline, todayDateValue)) {
            setDateValidationMessage("Past dates are not allowed.");
            setForm((prev) => ({ ...prev, deadline: todayDateValue }));
            return;
        }

        if (form.deadline < deadlineMinDateValue) {
            setDateValidationMessage("");
            setForm((prev) => ({ ...prev, deadline: deadlineMinDateValue }));
            return;
        }

        if (form.deadline > deadlineMaxDateValue) {
            setDateValidationMessage(getPriorityDeadlineMessage(form.priority));
            setForm((prev) => ({ ...prev, deadline: deadlineMaxDateValue }));
        }
    }, [form.priority, form.startDate, form.deadline, todayDateValue, deadlineMinDateValue, deadlineMaxDateValue]);

    const toggleEmployee = (emp) => {
        const empId = emp._id || emp.id;
        const exists = selectedEmployees.some((e) => (e._id || e.id) === empId);
        if (exists) {
            setSelectedEmployees(prev => prev.filter((e) => (e._id || e.id) !== empId));
        } else {
            setSelectedEmployees(prev => [...prev, emp]);
        }
    };

    const clearEmployee = (empId) => {
        setSelectedEmployees(prev => prev.filter((e) => (e._id || e.id) !== empId));
    };

    const addCheckItem = () => {
        if (!newCheckItem.trim()) return;
        setChecklist((prev) => [...prev, { id: Date.now(), text: newCheckItem.trim(), done: false }]);
        setNewCheckItem("");
    };

    const removeCheckItem = (id) =>
        setChecklist((prev) => prev.filter((item) => item.id !== id));

    const toggleCheckItem = (id) =>
        setChecklist((prev) =>
            prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
        );

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        setAttachments((prev) => [
            ...prev,
            ...files.map((f) => ({ name: f.name, size: f.size })),
        ]);
    };

    const removeAttachment = (idx) =>
        setAttachments((prev) => prev.filter((_, i) => i !== idx));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (hasPastDate) setDateValidationMessage("Past dates are not allowed.");
        if (isDeadlineBeyondPriorityLimit) setDateValidationMessage(getPriorityDeadlineMessage(form.priority));
        if (!isValid) { showToast(validationErrors[0], "error"); return; }
        setSubmitting(true);
        try {
            const joinedNames = selectedEmployees.map(e => e.name || e.employee_name).join(", ");
            const joinedIds = selectedEmployees.map(e => e._id || e.id).join(",");
            const payload = {
                title: form.title.trim(),
                description: [form.description, notes].filter(Boolean).join("\n\n"),
                priority: form.priority,
                employee: joinedNames,
                employee_id: joinedIds,
                employee_name: joinedNames,
                project: form.project,
                deadline: form.deadline,
                status: "Pending",
            };
            await addTask(payload);
            showToast("Delegation created successfully!", "success");
            navigate("/tasks");
        } catch (err) {
            console.error(err);
            showToast("Failed to create delegation.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setForm({ title: "", description: "", priority: "Medium", project: "", deadline: "",
            startDate: "", status: "Pending" });
        setSelectedEmployees([]);
        setChecklist([]);
        setNotes("");
        setAttachments([]);
        setDateValidationMessage("");
        setEmployeeSearch("");
        showToast("Form cleared.");
    };

    const getInitials = (name) => {
        if (!name) return "?";
        return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            return new Date(dateStr).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
            });
        } catch { return dateStr; }
    };

    const priorityCfg = PRIORITY_CONFIG[form.priority] || PRIORITY_CONFIG.Medium;
    const priorityTimeSuggestion = PRIORITY_TIME_SUGGESTIONS[form.priority] || PRIORITY_TIME_SUGGESTIONS.Medium;

    return (
        <div className="w-full">

            {/* Page Header */}
            <div className="mb-7">
                <button
                    onClick={() => navigate("/tasks")}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors mb-4 group"
                >
                    <FiArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Delegation List
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FiZap size={13} className="text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 font-display tracking-tight">Create Delegation</h1>
                        </div>
                        <p className="text-sm text-slate-500 font-sans ml-9">Define, assign, and track a new work delegation across your team.</p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100"
                    >
                        <FiX size={11} />
                        Clear Form
                    </button>
                </div>
            </div>

            {/* Two-Column Layout */}
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

                    {/* ── LEFT COLUMN: FORM ── */}
                    <div className="space-y-5">

                        {/* Section 1: Basic Information */}
                        <SectionCard icon={FiFileText} title="Basic Information" subtitle="Provide a clear title and description for this delegation." accentColor="indigo">
                            <div className="space-y-5">
                                <div>
                                    <InputLabel required>Delegation Title</InputLabel>
                                    <input
                                        type="text"
                                        id="delegation-title"
                                        placeholder="e.g. Implement User Authentication Module"
                                        value={form.title}
                                        onChange={(e) => handleFieldChange("title", e.target.value)}
                                        className="w-full h-12 px-4 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition font-sans"
                                        maxLength={120}
                                    />
                                    <div className="flex justify-end mt-1">
                                        <span className="text-[10px] text-slate-300 font-sans">{form.title.length}/120</span>
                                    </div>
                                </div>
                                <div>
                                    <InputLabel>Description</InputLabel>
                                    <textarea
                                        id="delegation-description"
                                        placeholder="Describe the scope, objectives, and expected deliverables..."
                                        value={form.description}
                                        onChange={(e) => handleFieldChange("description", e.target.value)}
                                        rows={4}
                                        className="w-full px-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition resize-none font-sans leading-relaxed"
                                    />
                                </div>
                                <div>
                                    <InputLabel required>Priority Level</InputLabel>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {["Low", "Medium", "High", "Urgent"].map((p) => {
                                            const cfg = PRIORITY_CONFIG[p];
                                            const isActive = form.priority === p;
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => handleFieldChange("priority", p)}
                                                    className={`h-12 rounded-xl border text-sm font-semibold transition-all duration-200 flex items-center justify-center ${
                                                        isActive
                                                            ? cfg.active
                                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div
                                        key={form.priority}
                                        className={`mt-3 w-full rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 transition-all duration-300 animate-in fade-in slide-in-from-top-1 ${priorityTimeSuggestion.style}`}
                                    >
                                        <FiClock size={13} className={`${priorityTimeSuggestion.icon} flex-shrink-0`} />
                                        <span className="text-xs font-semibold font-sans leading-relaxed">
                                            {priorityTimeSuggestion.text}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                                            {/* Section 2: Assignment */}
                        <SectionCard icon={FiUser} title="Assignment" subtitle="Select the team member(s) to delegate this task to." accentColor="violet">
                            <div className="space-y-5">
                                <div>
                                    <InputLabel required>Assign To</InputLabel>
                                    <div className="relative">
                                        {/* Dropdown open trigger button */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEmployeeSearch("");
                                                setShowEmployeeDropdown(true);
                                            }}
                                            className="w-full h-12 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all font-sans px-4 text-xs font-semibold text-slate-550 flex items-center justify-between cursor-pointer focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50"
                                        >
                                            <span>
                                                {selectedEmployees.length > 0 
                                                    ? `${selectedEmployees.length} team member(s) selected...` 
                                                    : "Select team member(s)..."}
                                            </span>
                                            <FiChevronDown className="text-slate-400" size={14} />
                                        </button>
 
                                        {/* Popup selection card modal */}
                                        {showEmployeeDropdown && (
                                            <div className="fixed inset-0 z-50 overflow-y-auto">
                                                {/* Backdrop */}
                                                <div 
                                                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                                                    onClick={() => setShowEmployeeDropdown(false)}
                                                ></div>
 
                                                {/* Modal Box Wrapper */}
                                                <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
                                                    {/* Modal Container */}
                                                    <div className="relative bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-5 sm:p-6 z-10 flex flex-col gap-4 animate-in fade-in zoom-in duration-200 overflow-hidden">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowEmployeeDropdown(false)}
                                                            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                                        >
                                                            <FiX size={16} />
                                                        </button>
 
                                                        <div className="mb-1">
                                                            <h3 className="text-base font-bold text-slate-900 font-display">Select Assignee</h3>
                                                            <p className="text-xs text-slate-500 mt-1 font-sans">Choose the employee(s) to delegate this task to.</p>
                                                        </div>
 
                                                        {/* Search bar inside popup */}
                                                        <div className="relative w-full">
                                                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                                                    <FiSearch size={13} />
                                                            </span>
                                                            <input
                                                                type="text"
                                                                placeholder="Search by name or role..."
                                                                value={employeeSearch}
                                                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                                                className="w-full h-9 pl-9 pr-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition font-sans"
                                                            />
                                                        </div>
 
                                                        {/* Employee list */}
                                                        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                                            {loadingEmployees ? (
                                                                <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs font-sans">
                                                                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                                    Loading employees...
                                                                </div>
                                                            ) : filteredEmployees.length === 0 ? (
                                                                <div className="py-8 text-center font-sans">
                                                                    <FiUser size={20} className="text-slate-200 mx-auto mb-2" />
                                                                    <p className="text-xs text-slate-400">No employees found</p>
                                                                </div>
                                                            ) : (
                                                                <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-100">
                                                                    {filteredEmployees.map((emp) => {
                                                                        const name = emp.name || emp.employee_name || "Unknown";
                                                                        const role = emp.role || emp.position || emp.department || "";
                                                                        const isSelected = selectedEmployees.some((e) => (e._id || e.id) === (emp._id || emp.id));
                                                                        return (
                                                                            <button
                                                                                key={emp._id || emp.id}
                                                                                type="button"
                                                                                onClick={() => toggleEmployee(emp)}
                                                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-all duration-155 cursor-pointer ${
                                                                                    isSelected ? "bg-indigo-50/40" : ""
                                                                                }`}
                                                                            >
                                                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0 font-display ${
                                                                                    isSelected
                                                                                        ? "bg-indigo-600 text-white shadow-sm"
                                                                                        : "bg-indigo-100 text-indigo-755"
                                                                                }`}>
                                                                                    {emp.avatar || getInitials(name)}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-xs font-semibold text-slate-800 truncate font-sans">{name}</p>
                                                                                    {role && <p className="text-[10px] text-slate-500 truncate font-sans">{role}</p>}
                                                                                </div>
                                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                                                    isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
                                                                                }`}>
                                                                                    {isSelected && <FiCheck size={10} className="text-white" />}
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
 
                                                        {/* Confirm button */}
                                                        <div className="flex justify-end pt-2 border-t border-slate-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowEmployeeDropdown(false)}
                                                                className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition cursor-pointer border-0"
                                                            >
                                                                Confirm Selection
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
 
                                    {/* Selected employee chips */}
                                    {selectedEmployees.length > 0 && (
                                        <div className="mt-3 flex flex-col gap-2.5">
                                            {selectedEmployees.map((emp) => {
                                                const empId = emp._id || emp.id;
                                                const name = emp.name || emp.employee_name || "";
                                                const role = emp.role || emp.position || emp.department || "Assigned Delegate";
                                                return (
                                                    <div key={empId} className="flex items-center gap-3 p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 animate-fade-in">
                                                        <div className="h-8 w-8 rounded-lg bg-indigo-650 text-white font-bold text-xs flex items-center justify-center font-display shadow-sm flex-shrink-0">
                                                            {emp.avatar || getInitials(name)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-slate-800 font-sans truncate">{name}</p>
                                                            <p className="text-[10px] text-indigo-500 font-medium font-sans">
                                                                {role}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => clearEmployee(empId)}
                                                            className="p-1 text-slate-400 hover:text-rose-500 transition-all hover:bg-rose-50 rounded-lg cursor-pointer border-0 bg-transparent"
                                                            title="Remove selection"
                                                        >
                                                            <FiX size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>

                        {/* Section 3: Timeline */}
                        <SectionCard icon={FiCalendar} title="Timeline" subtitle="Set start and completion dates for this delegation." accentColor="sky">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <InputLabel>Start Date</InputLabel>
                                    <input
                                        id="start-date"
                                        type="date"
                                        min={todayDateValue}
                                        value={form.startDate}
                                        onChange={(e) => handleDateChange("startDate", e.target.value)}
                                        onInput={(e) => handleDateChange("startDate", e.target.value)}
                                        onPaste={(e) => handleDatePaste("startDate", e)}
                                        className="w-full h-12 px-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition font-sans"
                                    />
                                </div>
                                <div>
                                    <InputLabel required>Deadline</InputLabel>
                                    <input
                                        id="deadline"
                                        type="date"
                                        min={deadlineMinDateValue}
                                        max={deadlineMaxDateValue}
                                        value={form.deadline}
                                        onChange={(e) => handleDateChange("deadline", e.target.value)}
                                        onInput={(e) => handleDateChange("deadline", e.target.value)}
                                        onPaste={(e) => handleDatePaste("deadline", e)}
                                        className="w-full h-12 px-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition font-sans"
                                    />
                                </div>
                            </div>
                            {dateValidationMessage && (
                                <div className="mt-3 flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
                                    <FiAlertCircle size={13} className="text-rose-500" />
                                    <span className="text-xs text-rose-700 font-medium font-sans">
                                        {dateValidationMessage}
                                    </span>
                                </div>
                            )}
                            {form.startDate && form.deadline && (
                                <div className="mt-4 flex items-center gap-2 p-3 bg-sky-50 rounded-xl border border-sky-100">
                                    <FiClock size={13} className="text-sky-500" />
                                    <span className="text-xs text-sky-700 font-medium font-sans">
                                        {(() => {
                                            const diff = (new Date(form.deadline) - new Date(form.startDate)) / (1000 * 60 * 60 * 24);
                                            if (diff < 0) return "⚠️ Deadline is before start date";
                                            return `${Math.round(diff)} day${diff !== 1 ? "s" : ""} duration`;
                                        })()}
                                    </span>
                                </div>
                            )}
                        </SectionCard>

                        {/* Section 4: Checklist */}
                        <SectionCard icon={FiCheckSquare} title="Checklist" subtitle="Break down this delegation into trackable sub-tasks." accentColor="emerald">
                            <div className="flex gap-2 mb-4">
                                <input
                                    id="checklist-input"
                                    type="text"
                                    placeholder="Add a checklist item..."
                                    value={newCheckItem}
                                    onChange={(e) => setNewCheckItem(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheckItem(); } }}
                                    className="flex-1 h-11 px-4 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition font-sans"
                                />
                                <button
                                    type="button"
                                    onClick={addCheckItem}
                                    disabled={!newCheckItem.trim()}
                                    className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
                                >
                                    <FiPlus size={14} />
                                    Add
                                </button>
                            </div>
                            {checklist.length === 0 ? (
                                <div className="py-6 text-center">
                                    <FiCheckSquare size={24} className="text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-sans">No checklist items yet. Add one above.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {checklist.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-slate-200 transition">
                                            <button
                                                type="button"
                                                onClick={() => toggleCheckItem(item.id)}
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                    item.done ? "bg-emerald-500 border-emerald-500" : "border-slate-300 hover:border-emerald-400"
                                                }`}
                                            >
                                                {item.done && <FiCheck size={10} className="text-white" />}
                                            </button>
                                            <span className={`flex-1 text-sm font-sans transition-all ${ item.done ? "line-through text-slate-400" : "text-slate-700" }`}>
                                                {item.text}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeCheckItem(item.id)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="pt-2">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[11px] font-semibold text-slate-500 font-sans">Progress</span>
                                            <span className="text-[11px] font-bold text-emerald-600 font-sans">{completedChecklist}/{checklist.length} complete</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </SectionCard>

                        {/* Section 5: Notes & Attachments */}
                        <SectionCard icon={FiPaperclip} title="Notes & Attachments" subtitle="Add supplementary notes or reference documents." accentColor="amber">
                            <div className="space-y-5">
                                <div>
                                    <InputLabel>Additional Notes</InputLabel>
                                    <textarea
                                        id="notes"
                                        placeholder="Any additional context, instructions, or notes for the assignee..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition resize-none font-sans leading-relaxed"
                                    />
                                </div>
                                <div>
                                    <InputLabel>Attachments</InputLabel>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-slate-200 rounded-xl py-6 px-4 flex flex-col items-center gap-2 hover:border-amber-300 hover:bg-amber-50/50 transition group"
                                    >
                                        <FiUpload size={20} className="text-slate-300 group-hover:text-amber-500 transition" />
                                        <p className="text-xs text-slate-400 font-sans">
                                            <span className="text-amber-600 font-semibold">Click to upload</span>{" "}or drag and drop
                                        </p>
                                        <p className="text-[10px] text-slate-300 font-sans">PDF, DOCX, PNG, XLSX up to 20MB</p>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileChange}
                                        accept=".pdf,.doc,.docx,.png,.jpg,.xlsx,.csv"
                                    />
                                    {attachments.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {attachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                                                        <FiFileText size={13} className="text-amber-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-slate-700 truncate font-sans">{att.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-sans">{att.size ? `${(att.size / 1024).toFixed(0)} KB` : ""}</p>
                                                    </div>
                                                    <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-300 hover:text-rose-500 transition">
                                                        <FiX size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>

                        {/* Mobile Submit */}
                        <div className="block lg:hidden">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
                                ) : (
                                    <><FiSend size={14} />Create Delegation</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN: LIVE PREVIEW ── */}
                    <div className="sticky top-6 space-y-4">

                        {/* Preview Card */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden">
                            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-5 py-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Live Preview</span>
                                    <span className="text-[10px] font-semibold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">Pending</span>
                                </div>
                                <h4 className="text-sm font-bold text-white leading-snug font-display min-h-[2.5rem]">
                                    {form.title.trim() || <span className="text-indigo-300/60 italic font-normal">Delegation title will appear here...</span>}
                                </h4>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityCfg.badge}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                                        {form.priority}
                                    </span>
                                    {form.project && (
                                        <span className="text-[10px] text-indigo-200 bg-white/10 px-2 py-0.5 rounded-full font-medium truncate max-w-[120px]">
                                            {form.project}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="px-5 py-4 space-y-4">
                                {/* Assignee */}
                                <div className="flex items-center gap-3">
                                    {form.employee_name ? (
                                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow font-display">
                                            {getInitials(form.employee_name)}
                                        </div>
                                    ) : (
                                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <FiUser size={14} className="text-slate-300" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800 font-sans">
                                            {form.employee_name || <span className="text-slate-300 italic font-normal">No assignee selected</span>}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-sans">Delegate</p>
                                    </div>
                                </div>
                                {/* Timeline */}
                                <div className="flex gap-3">
                                    <div className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-sans mb-0.5">Start Date</p>
                                        <p className="text-xs font-semibold text-slate-700 font-sans">{form.startDate ? formatDate(form.startDate) : "—"}</p>
                                    </div>
                                    <div className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-sans mb-0.5">Deadline</p>
                                        <p className={`text-xs font-semibold font-sans ${form.deadline ? "text-rose-600" : "text-slate-400"}`}>
                                            {form.deadline ? formatDate(form.deadline) : "—"}
                                        </p>
                                    </div>
                                </div>
                                {/* Checklist preview */}
                                {checklist.length > 0 && (
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide font-sans">Checklist</p>
                                            <span className="text-[10px] text-emerald-600 font-bold font-sans">{completedChecklist}/{checklist.length}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {checklist.slice(0, 3).map((item) => (
                                                <div key={item.id} className="flex items-center gap-2">
                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${ item.done ? "bg-emerald-500 border-emerald-500" : "border-slate-300" }`}>
                                                        {item.done && <FiCheck size={8} className="text-white" />}
                                                    </div>
                                                    <span className={`text-[11px] font-sans truncate ${item.done ? "line-through text-slate-300" : "text-slate-600"}`}>
                                                        {item.text}
                                                    </span>
                                                </div>
                                            ))}
                                            {checklist.length > 3 && (
                                                <p className="text-[10px] text-slate-400 font-sans pl-5">+{checklist.length - 3} more items</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* Description snippet */}
                                {form.description && (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[11px] text-slate-500 font-sans leading-relaxed line-clamp-3">{form.description}</p>
                                    </div>
                                )}
                                {/* Attachments count */}
                                {attachments.length > 0 && (
                                    <div className="flex items-center gap-2 text-[11px] text-amber-600 font-semibold font-sans">
                                        <FiPaperclip size={11} />
                                        {attachments.length} attachment{attachments.length !== 1 ? "s" : ""} attached
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Validation Summary */}
                        <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${ isValid ? "border-emerald-200 bg-emerald-50" : "border-rose-100 bg-rose-50" }`}>
                            <div className={`px-4 py-3 flex items-center gap-2 border-b ${ isValid ? "border-emerald-100" : "border-rose-100" }`}>
                                {isValid ? (
                                    <FiCheck size={13} className="text-emerald-600" />
                                ) : (
                                    <FiAlertCircle size={13} className="text-rose-500" />
                                )}
                                <span className={`text-xs font-bold font-sans ${isValid ? "text-emerald-700" : "text-rose-700"}`}>
                                    {isValid ? "Ready to Submit" : `${validationErrors.length} issue${validationErrors.length > 1 ? "s" : ""} to resolve`}
                                </span>
                            </div>
                            <div className="px-4 py-3">
                                {isValid ? (
                                    <p className="text-[11px] text-emerald-600 font-sans">All required fields are filled. You can create this delegation.</p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {validationErrors.map((err, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[11px] text-rose-600 font-sans">
                                                <span className="mt-0.5 w-1 h-1 rounded-full bg-rose-500 flex-shrink-0" />
                                                {err}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Desktop Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`hidden lg:flex w-full py-3.5 items-center justify-center gap-2.5 rounded-2xl font-bold text-sm shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
                                isValid
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                            }`}
                        >
                            {submitting ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating Delegation...</>
                            ) : (
                                <><FiSend size={14} />Create Delegation</>
                            )}
                        </button>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: "Checklist", value: checklist.length || "—", sub: "items", color: "text-emerald-600" },
                                { label: "Files", value: attachments.length || "—", sub: "attached", color: "text-amber-600" },
                                { label: "Days", value: form.startDate && form.deadline
                                    ? Math.max(0, Math.round((new Date(form.deadline) - new Date(form.startDate)) / (1000 * 60 * 60 * 24)))
                                    : "—", sub: "duration", color: "text-sky-600" },
                            ].map((stat) => (
                                <div key={stat.label} className="bg-white rounded-xl border border-slate-200/80 p-3 text-center shadow-sm">
                                    <p className={`text-base font-bold font-display ${stat.color}`}>{stat.value}</p>
                                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide font-sans">{stat.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default CreateDelegation;
