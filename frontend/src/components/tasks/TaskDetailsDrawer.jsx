import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiX, FiClock, FiLayers, FiActivity, FiUser, FiUserCheck, FiCalendar,
    FiCheckSquare, FiMessageSquare, FiPaperclip, FiInfo, FiEdit,
    FiRefreshCw, FiCheckCircle, FiFileText, FiSend,
    FiTrendingUp, FiSettings, FiArrowLeft
} from "react-icons/fi";
import { updateTask } from "../../services/taskApi";
import { getEmployees } from "../../services/employeeApi";
import { useToast } from "../../context/ToastContext";

function TaskDetailsDrawer({ task, onUpdate }) {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [currentTask, setCurrentTask] = useState(task);
    const [activeTab, setActiveTab] = useState("overview");

    // Edit states
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        title: "",
        description: "",
        priority: "Medium",
        deadline: ""
    });

    // Assignee Selection States
    const [isAssigning, setIsAssigning] = useState(false);
    const [employeesList, setEmployeesList] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState("");

    // Change Status States
    const [isChangingStatus, setIsChangingStatus] = useState(false);

    // Mock interactive checklist
    const [checklist, setChecklist] = useState([
        { id: 1, text: "Review initial project brief and client requirements", done: true },
        { id: 2, text: "Draft architectural designs and database schema specifications", done: true },
        { id: 3, text: "Implement responsive UI pages matching HSL design systems", done: false },
        { id: 4, text: "Integrate backend router APIs and controller endpoints", done: false },
        { id: 5, text: "Conduct end-to-end integration and load testing validation", done: false }
    ]);

    // Mock interactive comments
    const [comments, setComments] = useState([
        { id: 1, author: "Rajesh Mehta", role: "Project Manager", text: "Please ensure you verify the DB connection timeouts before deploying the controller changes.", time: "2 hours ago" },
        { id: 2, author: "Aman Verma", role: "Frontend Engineer", text: "Frontend integration is 50% complete. Working on the custom assignee dropdown filters now.", time: "45 mins ago" }
    ]);
    const [newComment, setNewComment] = useState("");

    // Mock attachments
    const [attachments] = useState([
        { id: 1, name: "Database_Model_v3.pdf", size: "2.4 MB", type: "pdf", date: "Jun 24, 2026" },
        { id: 2, name: "API_Integration_Specs.docx", size: "1.1 MB", type: "word", date: "Jun 25, 2026" }
    ]);

    // Activity timeline updates
    const [activities, setActivities] = useState([
        { id: 1, author: "Rajesh Mehta", text: "created this task", time: "Jun 20, 2026 - 10:30 AM" },
        { id: 2, author: "Aman Verma", text: "updated checklist item 'Review initial brief'", time: "Jun 22, 2026 - 02:15 PM" },
        { id: 3, author: "Aman Verma", text: "shifted task status to In Progress", time: "Jun 23, 2026 - 09:45 AM" },
        { id: 4, author: "Rajesh Mehta", text: "added a comment: 'Please ensure you...'", time: "Jun 26, 2026 - 09:12 AM" }
    ]);

    // Sync task state with prop when task updates in parent
    useEffect(() => {
        if (task) {
            setCurrentTask(task);
            setEditForm({
                title: task.title || "",
                description: task.description || "",
                priority: task.priority || "Medium",
                deadline: task.deadline || ""
            });
        }
    }, [task]);

    // Reset search when closing assignment selection
    useEffect(() => {
        if (!isAssigning) {
            setEmployeeSearch("");
        }
    }, [isAssigning]);

    if (!task || !currentTask) return null;

    // Priority styles aligned to CreateDelegation / Dashboard
    const getPriorityStyle = (priority) => {
        switch (priority) {
            case "High":
                return "bg-amber-50 text-amber-700 border-amber-100";
            case "Medium":
                return "bg-blue-50 text-blue-700 border-blue-100";
            case "Low":
                return "bg-emerald-50 text-emerald-700 border-emerald-100";
            case "Urgent":
                return "bg-red-50 text-red-700 border-red-100";
            default:
                return "bg-slate-50 text-slate-500 border-slate-200";
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case "Completed":
                return "bg-emerald-50 text-emerald-700 border-emerald-100";
            case "In Progress":
                return "bg-indigo-50 text-indigo-700 border-indigo-100";
            case "Cancelled":
                return "bg-slate-150 text-slate-650 border-slate-200";
            default:
                return "bg-amber-50 text-amber-700 border-amber-100";
        }
    };

    // Calculate progress percentage dynamically:
    const totalChecklist = checklist.length;
    const completedChecklist = checklist.filter(item => item.done).length;
    const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

    let overallProgress = 0;
    if (currentTask.status === "Completed") overallProgress = 100;
    else if (currentTask.status === "Cancelled") overallProgress = 0;
    else if (currentTask.status === "In Progress") overallProgress = Math.max(checklistProgress, 50);
    else overallProgress = checklistProgress;

    // Helper relative time
    const getRelativeTimelineText = (deadlineDateStr) => {
        if (!deadlineDateStr) return "";
        const deadline = new Date(deadlineDateStr);
        const today = new Date();
        deadline.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            const absDays = Math.abs(diffDays);
            return `${absDays} day${absDays !== 1 ? 's' : ''} ago`;
        } else if (diffDays === 0) {
            return "today";
        } else {
            return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        }
    };

    // Operations / Button Action Handlers

    // 1. Edit Details
    const startEdit = () => {
        setEditForm({
            title: currentTask.title || "",
            description: currentTask.description || "",
            priority: currentTask.priority || "Medium",
            deadline: currentTask.deadline || ""
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                title: editForm.title,
                description: editForm.description,
                employee: currentTask.employee || "",
                project: currentTask.project || "",
                priority: editForm.priority,
                deadline: editForm.deadline,
                status: currentTask.status || "Pending",
                employee_id: currentTask.employee_id || null,
                employee_name: currentTask.employee_name || null
            };

            await updateTask(task._id || task.id, payload);

            setCurrentTask({
                ...currentTask,
                title: editForm.title,
                description: editForm.description,
                priority: editForm.priority,
                deadline: editForm.deadline
            });

            setActivities([
                {
                    id: Date.now(),
                    author: "System Admin",
                    text: `updated task information details`,
                    time: "Just now"
                },
                ...activities
            ]);

            showToast("Task details updated successfully!");
            setIsEditing(false);
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error(err);
            showToast("Failed to save task modifications.", "error");
        }
    };

    // 2. Assign Team
    const openAssigneeList = async () => {
        setIsAssigning(true);
        setLoadingEmployees(true);
        try {
            const list = await getEmployees();
            setEmployeesList(list || []);
        } catch (err) {
            console.error("Failed to load employees for assignment", err);
            showToast("Failed to load team directory list.", "error");
        } finally {
            setLoadingEmployees(false);
        }
    };

    const handleSaveAssignee = async (emp) => {
        try {
            const payload = {
                title: currentTask.title || "",
                description: currentTask.description || "",
                employee: emp.name,
                project: currentTask.project || "",
                priority: currentTask.priority || "Medium",
                deadline: currentTask.deadline || "",
                status: currentTask.status || "Pending",
                employee_id: emp._id,
                employee_name: emp.name
            };

            await updateTask(task._id || task.id, payload);

            setCurrentTask({
                ...currentTask,
                employee: emp.name,
                employee_id: emp._id,
                employee_name: emp.name
            });

            setActivities([
                {
                    id: Date.now(),
                    author: "System Admin",
                    text: `assigned task to ${emp.name} (${emp.role})`,
                    time: "Just now"
                },
                ...activities
            ]);

            showToast(`Assigned task to ${emp.name} successfully!`);
            setIsAssigning(false);
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error(err);
            showToast("Failed to re-assign task assignee.", "error");
        }
    };

    // 3. Change Status
    const handleSaveStatus = async (st) => {
        try {
            const payload = {
                title: currentTask.title || "",
                description: currentTask.description || "",
                employee: currentTask.employee || "",
                project: currentTask.project || "",
                priority: currentTask.priority || "Medium",
                deadline: currentTask.deadline || "",
                status: st,
                employee_id: currentTask.employee_id || null,
                employee_name: currentTask.employee_name || null
            };

            await updateTask(task._id || task.id, payload);

            setCurrentTask({
                ...currentTask,
                status: st
            });

            setActivities([
                {
                    id: Date.now(),
                    author: "System Admin",
                    text: `changed status path to ${st}`,
                    time: "Just now"
                },
                ...activities
            ]);

            showToast(`Status updated to ${st}!`);
            setIsChangingStatus(false);
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error(err);
            showToast("Failed to transition task status.", "error");
        }
    };

    // 4. Mark Complete
    const handleMarkComplete = async () => {
        try {
            const payload = {
                title: currentTask.title || "",
                description: currentTask.description || "",
                employee: currentTask.employee || "",
                project: currentTask.project || "",
                priority: currentTask.priority || "Medium",
                deadline: currentTask.deadline || "",
                status: "Completed",
                employee_id: currentTask.employee_id || null,
                employee_name: currentTask.employee_name || null
            };

            await updateTask(task._id || task.id, payload);

            setCurrentTask({
                ...currentTask,
                status: "Completed"
            });

            setActivities([
                {
                    id: Date.now(),
                    author: "System Admin",
                    text: `marked task execution as completed`,
                    time: "Just now"
                },
                ...activities
            ]);

            showToast("Task completed successfully!");
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error(err);
            showToast("Failed to complete task.", "error");
        }
    };

    // Interactive updates
    const toggleChecklistItem = (id) => {
        setChecklist(checklist.map(item => {
            if (item.id === id) {
                const newDone = !item.done;
                setActivities([
                    {
                        id: Date.now(),
                        author: currentTask.employee || "Assignee",
                        text: `${newDone ? "completed" : "reopened"} checklist item '${item.text.substring(0, 20)}...'`,
                        time: "Just now"
                    },
                    ...activities
                ]);
                return { ...item, done: newDone };
            }
            return item;
        }));
    };

    const handleAddComment = (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const cVal = {
            id: Date.now(),
            author: "System Admin",
            role: "Administrator",
            text: newComment,
            time: "Just now"
        };
        setComments([...comments, cVal]);
        setActivities([
            {
                id: Date.now(),
                author: "System Admin",
                text: "added a feedback comment",
                time: "Just now"
            },
            ...activities
        ]);
        setNewComment("");
    };

    // Filter employees dynamically for assignment search field
    const filteredEmployees = employeesList.filter(emp => {
        const query = employeeSearch.toLowerCase();
        const nameMatch = (emp.name || "").toLowerCase().includes(query);
        const roleMatch = (emp.role || "").toLowerCase().includes(query);
        const emailMatch = (emp.email || "").toLowerCase().includes(query) || (emp.name || "").toLowerCase().replace(/\s+/g, "").concat("@company.com").includes(query);
        return nameMatch || roleMatch || emailMatch;
    });

    const taskCode = currentTask._id
        ? `DLG-${currentTask._id.substring(18).toUpperCase()}`
        : `DLG-${currentTask.id || "001"}`;

    const tabs = [
        { id: "overview", label: "Overview", icon: FiFileText },
        { id: "checklist", label: "Checklist", count: totalChecklist, countLabel: `${completedChecklist}/${totalChecklist}`, icon: FiCheckSquare },
        { id: "comments", label: "Comments", count: comments.length, icon: FiMessageSquare },
        { id: "attachments", label: "Attachments", count: attachments.length, icon: FiPaperclip },
        { id: "activity", label: "Activity", icon: FiActivity }
    ];

    const getActivityIcon = (text) => {
        const lower = text.toLowerCase();
        if (lower.includes("checklist") || lower.includes("reopened") || lower.includes("completed")) {
            return {
                icon: FiCheckSquare,
                bg: "bg-indigo-600 text-white"
            };
        }
        if (lower.includes("comment") || lower.includes("feedback")) {
            return {
                icon: FiMessageSquare,
                bg: "bg-purple-650 text-white"
            };
        }
        if (lower.includes("file") || lower.includes("attachment") || lower.includes("attached")) {
            return {
                icon: FiPaperclip,
                bg: "bg-indigo-600 text-white"
            };
        }
        return {
            icon: FiActivity,
            bg: "bg-slate-500 text-white"
        };
    };

    return (
        <div className="w-full flex flex-col gap-5 font-sans text-slate-800 animate-fade-in">
            {/* Top link & Header Section */}
            <div className="space-y-2">

                <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* LEFT SIDE */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                {taskCode}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getStatusStyle(currentTask.status)}`}>
                                {currentTask.status || "Pending"}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getPriorityStyle(currentTask.priority)}`}>
                                {currentTask.priority || "Medium"} Priority
                            </span>
                        </div>

                        {/* Title */}
                        <h2 className="text-xl md:text-2xl font-bold font-display text-slate-900 tracking-tight leading-tight">
                            {currentTask.title}
                        </h2>

                        {/* Meta info row */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-semibold text-slate-500 pt-1">
                            <div className="flex items-center gap-1.5">
                                <div className="w-5.5 h-5.5 rounded-md bg-indigo-50 text-indigo-750 border border-indigo-100/50 flex items-center justify-center font-bold text-[9px] shrink-0 font-display">
                                    {currentTask.employee?.charAt(0) || "?"}
                                </div>
                                <span className="text-slate-700 font-bold">{currentTask.employee}</span>
                            </div>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-1.5">
                                <FiCalendar size={13} className="text-slate-400" />
                                <span>Due {currentTask.deadline} {currentTask.deadline && `(${getRelativeTimelineText(currentTask.deadline)})`}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE */}
                    <div className="flex items-center gap-4 shrink-0">
                        {/* Progress Circle Wrapper */}
                        <div className="flex items-center gap-3">
                            <div className="h-16 w-16 rounded-full flex items-center justify-center bg-white border border-slate-200 shrink-0 relative">
                                <svg width="56" height="56" viewBox="0 0 80 80" className="transform -rotate-90">
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="34"
                                        className="text-slate-100"
                                        strokeWidth="6"
                                        stroke="currentColor"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="34"
                                        className="text-indigo-650 transition-all duration-500 ease-out"
                                        strokeWidth="6"
                                        strokeDasharray="213.63"
                                        strokeDashoffset={213.63 - (overallProgress / 100) * 213.63}
                                        strokeLinecap="round"
                                        stroke="currentColor"
                                        fill="transparent"
                                    />
                                </svg>
                                <span className="text-xs font-bold text-slate-700 absolute">{overallProgress}%</span>
                            </div>
                            <div className="text-left leading-none hidden sm:block">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Overall Progress</span>
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-tight block">Track Position</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* LEFT COLUMN: Tabbed Card (Spans 2 columns on xl) */}
                <div className="xl:col-span-2 space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col min-w-0">
                        {/* Tab Navigation */}
                        <div className="flex flex-wrap gap-2 border-b border-slate-150 pb-3 flex-shrink-0">
                            {tabs.map(tab => {
                                const TabIcon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer border outline-none ${isActive
                                                ? "bg-indigo-50 border-indigo-150 text-indigo-700"
                                                : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                                            }`}
                                    >
                                        <TabIcon size={14} />
                                        <span>{tab.label}</span>
                                        {tab.count !== undefined && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                                }`}>
                                                {tab.countLabel || tab.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Tab Content Area */}
                        <div className="pt-4 min-h-[300px] flex-1">
                            {activeTab === "overview" && (
                                <div className="space-y-5 animate-fade-in">
                                    {isEditing ? (
                                        <form onSubmit={handleSaveEdit} className="space-y-4">
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Task Title</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.title}
                                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 outline-none transition font-sans"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description Summary</label>
                                                    <textarea
                                                        rows="3"
                                                        value={editForm.description}
                                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-850 focus:border-indigo-500 outline-none transition font-sans resize-none"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priority</label>
                                                        <select
                                                            value={editForm.priority}
                                                            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-705 focus:border-indigo-500 outline-none transition font-sans cursor-pointer"
                                                        >
                                                            <option>High</option>
                                                            <option>Medium</option>
                                                            <option>Low</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Due Date</label>
                                                        <input
                                                            type="date"
                                                            value={editForm.deadline}
                                                            onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-850 focus:border-indigo-500 outline-none transition font-sans"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditing(false)}
                                                    className="flex-1 h-9 text-xs rounded-xl font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 transition-all cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="flex-1 h-9 text-xs rounded-xl font-semibold bg-indigo-650 hover:bg-indigo-750 text-white transition-all cursor-pointer"
                                                >
                                                    Save Details
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</h4>
                                                    <button
                                                        onClick={startEdit}
                                                        className="text-indigo-650 hover:text-indigo-805 text-xs font-semibold flex items-center gap-1 bg-transparent border-0 outline-none cursor-pointer p-0"
                                                    >
                                                        <FiEdit size={12} />
                                                        Edit Details
                                                    </button>
                                                </div>
                                                <p className="text-slate-600 text-xs leading-relaxed font-sans whitespace-pre-wrap">
                                                    {currentTask.description || "No description provided."}
                                                </p>
                                            </div>

                                            {/* Meta cards */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                                                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 font-display">
                                                        {(currentTask.created_by || "System Admin").charAt(0)}
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">CREATED BY</span>
                                                        <span className="text-xs font-bold text-slate-700 block truncate">{currentTask.created_by || "System Admin"}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-150 text-slate-400 flex items-center justify-center shrink-0">
                                                        <FiCalendar size={14} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">CREATED ON</span>
                                                        <span className="text-xs font-bold text-slate-700 block">Jun 20, 2026</span>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-150 text-slate-400 flex items-center justify-center shrink-0">
                                                        <FiClock size={14} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">LAST SYNC</span>
                                                        <span className="text-xs font-bold text-slate-700 block">Just now</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details table */}
                                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Details</h4>
                                                <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                                                    <div className="flex justify-between items-center py-2.5 text-xs">
                                                        <span className="text-slate-500 font-semibold">Priority</span>
                                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getPriorityStyle(currentTask.priority)}`}>
                                                            {currentTask.priority || "Medium"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2.5 text-xs">
                                                        <span className="text-slate-500 font-semibold">Assigned Representative</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-5.5 h-5.5 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-[9px] shrink-0 font-display">
                                                                {currentTask.employee?.charAt(0) || "?"}
                                                            </div>
                                                            <span className="font-bold text-slate-800">{currentTask.employee}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2.5 text-xs">
                                                        <span className="text-slate-500 font-semibold">Work Status</span>
                                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getStatusStyle(currentTask.status)}`}>
                                                            {currentTask.status || "Pending"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2.5 text-xs">
                                                        <span className="text-slate-500 font-semibold">Due Date Target</span>
                                                        <span className="font-bold text-slate-800">
                                                            {currentTask.deadline} {currentTask.deadline && `(${getRelativeTimelineText(currentTask.deadline)})`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "checklist" && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Checklist Tasks</h3>
                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 border border-indigo-100 rounded-full">
                                            {completedChecklist}/{totalChecklist} Done
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {checklist.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => toggleChecklistItem(item.id)}
                                                className={`flex items-start gap-2.5 py-2.5 px-3 border rounded-xl cursor-pointer transition text-xs font-medium ${item.done
                                                        ? "bg-slate-50/50 border-slate-150 text-slate-400 line-through"
                                                        : "bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50/20"
                                                    }`}
                                            >
                                                <div className={`mt-0.5 shrink-0 h-4 w-4 border rounded flex items-center justify-center transition ${item.done ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                                                    }`}>
                                                    {item.done && <FiX size={10} className="rotate-45" />}
                                                </div>
                                                <span className="font-sans leading-tight">{item.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === "comments" && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comments Feed</h3>
                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 border border-indigo-100 rounded-full">
                                            {comments.length} Total
                                        </span>
                                    </div>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                        {comments.map((comment) => (
                                            <div key={comment.id} className="bg-slate-50/50 border border-slate-200/60 p-3 rounded-xl space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-750">{comment.author}</span>
                                                        <span className="text-[8px] bg-indigo-50 text-indigo-650 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{comment.role}</span>
                                                    </div>
                                                    <span className="text-slate-400 font-semibold">{comment.time}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-wrap">{comment.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                                        <input
                                            type="text"
                                            placeholder="Write comment updates..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            className="flex-1 bg-slate-55 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition font-sans"
                                        />
                                        <button
                                            type="submit"
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl shadow-xs transition active:scale-[0.98] cursor-pointer flex items-center justify-center shrink-0 border-0 outline-none"
                                        >
                                            <FiSend size={14} />
                                        </button>
                                    </form>
                                </div>
                            )}

                            {activeTab === "attachments" && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task Attachments</h3>
                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 border border-indigo-100 rounded-full">
                                            {attachments.length} files
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {attachments.map((file) => (
                                            <div key={file.id} className="bg-slate-50/50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-indigo-600 shrink-0">
                                                        <FiFileText size={14} />
                                                    </div>
                                                    <div className="min-w-0 leading-tight">
                                                        <span className="text-xs font-bold text-slate-800 block truncate" title={file.name}>{file.name}</span>
                                                        <span className="text-[9px] text-slate-400 font-semibold block uppercase tracking-wider mt-0.5">{file.size} • {file.date}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="text-[10px] text-indigo-650 hover:text-indigo-805 font-bold py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition shrink-0 cursor-pointer outline-none"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === "activity" && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity Feed</h3>
                                    </div>
                                    <div className="relative pl-4 border-l border-slate-150 space-y-4 py-1.5 ml-2">
                                        {activities.map((act) => (
                                            <div key={act.id} className="relative text-xs">
                                                <div className="absolute -left-[20.5px] top-1 h-2 w-2 rounded-full border border-white bg-indigo-600 ring-4 ring-white"></div>
                                                <span className="font-bold text-slate-700">{act.author}</span>{" "}
                                                <span className="text-slate-600 font-medium font-sans">{act.text}</span>
                                                <span className="block text-[8px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{act.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dedicated Cards for Checklist Preview & Recent Discussion */}
                    {activeTab === "overview" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                            {/* Card 1: Checklist Preview */}
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-display">
                                        <FiCheckSquare className="text-slate-400" size={14} /> Checklist Preview
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("checklist")}
                                        className="text-indigo-650 hover:text-indigo-855 text-xs font-bold bg-transparent border-0 outline-none cursor-pointer p-0 font-sans"
                                    >
                                        View Full
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {checklist.slice(0, 3).map((item) => (
                                        <div
                                            key={item.id}
                                            className={`flex items-start gap-2.5 py-2.5 px-3 border rounded-xl text-xs font-medium ${item.done ? "bg-slate-50/50 border-slate-150 text-slate-400 line-through" : "bg-white border-slate-200 text-slate-700"
                                                }`}
                                        >
                                            <div className={`mt-0.5 shrink-0 h-4 w-4 border rounded flex items-center justify-center ${item.done ? "bg-indigo-650 border-indigo-650 text-white" : "border-slate-300 bg-white"
                                                }`}>
                                                {item.done && <FiX size={8} className="rotate-45" />}
                                            </div>
                                            <span className="font-sans leading-tight truncate">{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Card 2: Recent Discussion */}
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-display">
                                        <FiMessageSquare className="text-slate-400" size={14} /> Recent Discussion
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("comments")}
                                        className="text-indigo-650 hover:text-indigo-855 text-xs font-bold bg-transparent border-0 outline-none cursor-pointer p-0 font-sans"
                                    >
                                        Join Discussion
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {comments.slice(0, 2).map((comment) => (
                                        <div key={comment.id} className="bg-slate-50/50 border border-slate-200/60 p-3 rounded-xl leading-relaxed">
                                            <div className="flex justify-between items-center text-[10px] mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-750">{comment.author}</span>
                                                    <span className="text-[8px] bg-indigo-50 text-indigo-650 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{comment.role}</span>
                                                </div>
                                                <span className="text-slate-400 font-semibold">{comment.time}</span>
                                            </div>
                                            <p className="text-xs text-slate-655 font-sans">{comment.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Quick Actions, Delegation Summary, Timeline Logs */}
                <div className="space-y-5">
                    {/* Quick Operations Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 font-display">
                            Quick Operations
                        </h3>
                        {currentTask.status === "Cancelled" ? (
                            <div className="text-xs text-slate-400 py-2 font-medium">
                                No actions available for this status.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={startEdit}
                                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all duration-200 cursor-pointer outline-none"
                                >
                                    Edit Details
                                </button>
                                <button
                                    type="button"
                                    onClick={openAssigneeList}
                                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all duration-200 cursor-pointer outline-none"
                                >
                                    Assign Team
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsChangingStatus(true)}
                                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all duration-200 cursor-pointer outline-none"
                                >
                                    Change Status
                                </button>
                                <button
                                    type="button"
                                    onClick={handleMarkComplete}
                                    className="h-10 px-4 rounded-xl bg-indigo-650 hover:bg-indigo-755 text-white text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer outline-none border-0"
                                >
                                    <FiCheckCircle size={14} />
                                    Mark Complete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Delegation Summary Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 font-display">
                            Delegation Summary
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-2 font-sans">
                                    <span className="flex items-center gap-1.5"><FiCheckSquare size={13} className="text-slate-400" /> Checklist Progress</span>
                                    <span className="font-bold">{completedChecklist} of {totalChecklist}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-600 h-full rounded-full transition-all duration-350" style={{ width: `${checklistProgress}%` }}></div>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 text-xs text-slate-600">
                                <div className="flex justify-between py-2.5">
                                    <span className="flex items-center gap-1.5"><FiMessageSquare size={13} className="text-slate-400" /> Comments</span>
                                    <span className="font-bold text-slate-800">{comments.length}</span>
                                </div>
                                <div className="flex justify-between py-2.5">
                                    <span className="flex items-center gap-1.5"><FiPaperclip size={13} className="text-slate-400" /> Attachments</span>
                                    <span className="font-bold text-slate-800">{attachments.length}</span>
                                </div>
                                <div className="flex justify-between py-2.5">
                                    <span className="flex items-center gap-1.5"><FiActivity size={13} className="text-slate-400" /> Total Activity</span>
                                    <span className="font-bold text-slate-800">{activities.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Logs Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 font-display">
                            Timeline <span className="text-xs text-slate-400 font-normal font-sans">(Latest Activity)</span>
                        </h3>
                        <div className="relative pl-6 border-l border-slate-150 space-y-4 py-1.5 ml-2">
                            {activities.map((act) => {
                                const { icon: ActIcon, bg: actBg } = getActivityIcon(act.text);
                                return (
                                    <div key={act.id} className="relative text-xs">
                                        <div className={`absolute -left-[35px] top-0 h-6 w-6 rounded-full flex items-center justify-center ${actBg} ring-4 ring-white shadow-sm`}>
                                            <ActIcon size={12} />
                                        </div>
                                        <div className="leading-tight">
                                            <span className="font-bold text-slate-800 block">{act.text}</span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                                                by {act.author} • {act.time}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS SECTION */}
            {/* Assign Team Modal */}
            {isAssigning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsAssigning(false)}></div>
                    <div className="relative rounded-xl border border-slate-200 bg-white shadow-lg w-full max-w-sm p-4 z-10 space-y-3.5 animate-slide-up">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Assign Team Representative</span>
                            <button onClick={() => setIsAssigning(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer border-0 bg-transparent outline-none"><FiX size={16} /></button>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                placeholder="Search by name, role or email..."
                                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition font-sans bg-slate-50"
                                autoFocus
                            />
                        </div>
                        {loadingEmployees ? (
                            <div className="py-6 text-center text-xs text-slate-400">Loading team members...</div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-150/40">No representatives found</div>
                        ) : (
                            <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                                {filteredEmployees.map(emp => {
                                    const isSelected = currentTask.employee === emp.name;
                                    return (
                                        <div
                                            key={emp._id}
                                            onClick={() => handleSaveAssignee(emp)}
                                            className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors duration-150 text-left ${isSelected
                                                ? "bg-indigo-50 text-indigo-700 font-bold"
                                                : "hover:bg-slate-55 text-slate-700"
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-display ${isSelected
                                                ? "bg-indigo-100 text-indigo-700"
                                                : "bg-indigo-50 text-indigo-650 border border-indigo-100/40"
                                                }`}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 leading-none">
                                                <span className="text-xs font-bold block mb-0.5">{emp.name}</span>
                                                <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">{emp.role}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Change Status Modal */}
            {isChangingStatus && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsChangingStatus(false)}></div>
                    <div className="relative rounded-xl border border-slate-200 bg-white shadow-lg w-full max-w-xs p-4 z-10 space-y-3 animate-slide-up">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Update Status</span>
                            <button onClick={() => setIsChangingStatus(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer border-0 bg-transparent outline-none"><FiX size={16} /></button>
                        </div>
                        <div className="space-y-1">
                            {["Pending", "In Progress", "Completed", "Cancelled"].map(st => {
                                const isSelected = currentTask.status === st;
                                return (
                                    <div
                                        key={st}
                                        onClick={() => handleSaveStatus(st)}
                                        className={`p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition text-left text-xs font-bold ${isSelected ? "text-indigo-600 bg-indigo-50/50" : "text-slate-600"
                                            }`}
                                    >
                                        {st}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TaskDetailsDrawer;
