import { useEffect, useState } from "react";
import { 
    FiX, FiClock, FiLayers, FiActivity, FiUser, FiUserCheck, FiCalendar, 
    FiCheckSquare, FiMessageSquare, FiPaperclip, FiInfo, FiEdit, 
    FiRefreshCw, FiCheckCircle, FiFileText, FiSend,
    FiTrendingUp, FiSettings, FiUserPlus
} from "react-icons/fi";
import { updateTask } from "../../services/taskApi";
import { getEmployees } from "../../services/employeeApi";
import { useToast } from "../../context/ToastContext";

function TaskDetailsDrawer({ task, onClose, onUpdate }) {
    const { showToast } = useToast();
    const [currentTask, setCurrentTask] = useState(task);

    // Edit modal states
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

    // Tab view state
    const [activeTab, setActiveTab] = useState("Overview");

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
    const [attachments, setAttachments] = useState([
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

    // Reset search when closing modal
    useEffect(() => {
        if (!isAssigning) {
            setEmployeeSearch("");
        }
    }, [isAssigning]);

    // Handle ESC key close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (!task || !currentTask) return null;

    // Helper colors
    const getPriorityStyle = (priority) => {
        switch (priority) {
            case "High":
                return "bg-rose-50 text-rose-700 border-rose-100";
            case "Medium":
                return "bg-amber-50 text-amber-705 border-amber-100";
            case "Low":
                return "bg-emerald-50 text-emerald-700 border-emerald-100";
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
                return "bg-slate-100 text-slate-650 border-slate-200";
            default:
                return "bg-amber-50 text-amber-700 border-amber-100";
        }
    };

    // Calculate progress percentage dynamically:
    // If completed status, it is 100%. Otherwise, base it on checklist completion percentage.
    const totalChecklist = checklist.length;
    const completedChecklist = checklist.filter(item => item.done).length;
    const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;
    
    let overallProgress = 0;
    if (currentTask.status === "Completed") overallProgress = 100;
    else if (currentTask.status === "Cancelled") overallProgress = 0;
    else if (currentTask.status === "In Progress") overallProgress = Math.max(checklistProgress, 50);
    else overallProgress = checklistProgress;

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
            
            // Update local state
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

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 md:p-5 flex items-center justify-center font-sans">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
                onClick={onClose}
            ></div>

            {/* Main Centered Compact Wrapper (920px Cap, Centered Modal) */}
            <div className="relative bg-white border border-slate-200/80 w-full max-w-[920px] mx-auto px-3 py-2 rounded-2xl shadow-lg animate-slide-up z-10 flex flex-col overflow-hidden max-h-[78vh] h-fit my-auto">
                
                {/* Hero Header Section - Compressed & Centered Baseline */}
                <div className="bg-slate-50/50 border-b border-slate-200/60 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider">
                                Task ID: #{currentTask._id ? currentTask._id.substring(18) : currentTask.id || "001"}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold border uppercase tracking-wider ${getStatusStyle(currentTask.status)}`}>
                                {currentTask.status || "Pending"}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold border uppercase tracking-wider ${getPriorityStyle(currentTask.priority)}`}>
                                {currentTask.priority || "Medium"} Priority
                            </span>
                        </div>

                        {/* Title - Compact size */}
                        <h2 className="text-sm md:text-base font-semibold font-display text-slate-800 tracking-tight leading-tight">
                            {currentTask.title}
                        </h2>

                        {/* Meta info row - Fits cleanly on desktop */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-[9px] font-medium text-slate-400 uppercase tracking-wider">
                            <div className="flex items-center gap-1 text-slate-500">
                                <FiLayers size={10} className="text-slate-350" />
                                <span>Project:</span>
                                <span className="text-slate-700 font-bold">{currentTask.project}</span>
                            </div>
                            <span className="text-slate-200">|</span>
                            <div className="flex items-center gap-1">
                                <FiUserCheck size={10} className="text-slate-355" />
                                <span>Assignee:</span>
                                <span className="text-indigo-650 font-bold">{currentTask.employee}</span>
                            </div>
                            <span className="text-slate-200">|</span>
                            <div className="flex items-center gap-1">
                                <FiCalendar size={10} className="text-slate-355" />
                                <span>Due:</span>
                                <span className="text-slate-600 font-bold">{currentTask.deadline}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right side aligned elements: progress tracker + Go Back button */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                        
                        {/* Progress circle (h-12 w-12 with r=32 SVG circle) */}
                        <div className="flex items-center gap-2 bg-white border border-slate-200/80 px-2 py-1 rounded-xl shadow-sm h-14 shrink-0">
                            <div className="relative h-12 w-12 flex items-center justify-center shrink-0 overflow-hidden">
                                <svg className="absolute transform -rotate-90" width="34" height="34" viewBox="0 0 80 80">
                                    <circle 
                                        cx="40" cy="40" r="32" 
                                        className="text-slate-100" 
                                        strokeWidth="5" stroke="currentColor" fill="transparent" 
                                    />
                                    <circle 
                                        cx="40" cy="40" r="32" 
                                        className="text-indigo-600 transition-all duration-500 ease-out" 
                                        strokeWidth="5" strokeDasharray="201.06" 
                                        strokeDashoffset={201.06 - (overallProgress / 100) * 201.06} 
                                        strokeLinecap="round" stroke="currentColor" fill="transparent" 
                                    />
                                </svg>
                                <span className="text-[7px] font-bold text-slate-800 font-display relative">{overallProgress}%</span>
                            </div>
                            <div className="text-left leading-none">
                                <span className="text-[6.5px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">Overall Progress</span>
                                <span className="text-[8px] font-bold text-slate-660 uppercase tracking-tight block">Track Position</span>
                            </div>
                        </div>

                        {/* Go Back button beside progress circle */}
                        <button
                            onClick={onClose}
                            className="h-8 px-3 text-[11px] font-semibold border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-[0.98] shadow-sm"
                        >
                            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path>
                            </svg>
                            <span>Go Back</span>
                        </button>
                    </div>
                </div>

                {/* Workspace Content columns grid cols-[1.65fr_0.8fr] */}
                <div className="pt-2.5 pb-1 overflow-y-auto max-h-[60vh] scroll-smooth">
                    <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_0.8fr] gap-2.5">
                        
                        {/* LEFT COLUMN - CONTENT AND TABS (1.65fr width) */}
                        <div className="space-y-3">
                            
                            {/* Tab selector */}
                            <div className="border-b border-slate-200/85 flex gap-2 overflow-x-auto pb-px">
                                {[
                                    { id: "Overview", label: "Overview", icon: FiInfo },
                                    { id: "Checklist", label: `Checklist (${completedChecklist}/${totalChecklist})`, icon: FiCheckSquare },
                                    { id: "Comments", label: `Comments (${comments.length})`, icon: FiMessageSquare },
                                    { id: "Attachments", label: `Attachments (${attachments.length})`, icon: FiPaperclip },
                                    { id: "Activity", label: "Timeline Logs", icon: FiActivity }
                                ].map((tab) => {
                                    const TabIcon = tab.icon;
                                    const isActive = activeTab === tab.id.split(" ")[0];
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id.split(" ")[0])}
                                            className={`flex items-center gap-1.5 py-1.5 px-0.5 border-b-2 font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                                                isActive
                                                    ? "border-indigo-600 text-indigo-600"
                                                    : "border-transparent text-slate-400 hover:text-slate-700"
                                            }`}
                                        >
                                            <TabIcon size={11} />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* TAB SECTIONS */}
                            <div className="pt-0.5">
                                
                                {/* A. OVERVIEW SECTION */}
                                {activeTab === "Overview" && (
                                    <div className="space-y-3 animate-fade-in">
                                        
                                        {/* Edit Inline Form or Description rendering */}
                                        {isEditing ? (
                                            <form onSubmit={handleSaveEdit} className="space-y-2.5 animate-fade-in">
                                                <div className="bg-slate-50/50 border border-slate-200 p-2.5 rounded-lg space-y-2">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Update Task Specifications</span>
                                                    
                                                    <div className="space-y-1.5">
                                                        <div>
                                                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Task Title</label>
                                                            <input 
                                                                type="text" 
                                                                value={editForm.title} 
                                                                onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                                                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800 focus:border-indigo-500 outline-none transition font-sans"
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Description Summary</label>
                                                            <textarea 
                                                                rows="2"
                                                                value={editForm.description} 
                                                                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                                                                className="w-full bg-white border border-slate-200 rounded p-2 text-[11px] text-slate-800 focus:border-indigo-500 outline-none transition font-sans resize-none"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Priority</label>
                                                                <select 
                                                                    value={editForm.priority} 
                                                                    onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                                                                    className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 focus:border-indigo-500 outline-none transition font-sans cursor-pointer"
                                                                >
                                                                    <option>High</option>
                                                                    <option>Medium</option>
                                                                    <option>Low</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Due Date</label>
                                                                <input 
                                                                    type="date" 
                                                                    value={editForm.deadline} 
                                                                    onChange={(e) => setEditForm({...editForm, deadline: e.target.value})}
                                                                    className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:border-indigo-500 outline-none transition font-sans"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 pt-0.5">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setIsEditing(false)}
                                                            className="flex-1 py-1 text-[11px] font-semibold border border-slate-250 hover:bg-slate-50 text-slate-600 rounded transition cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            type="submit" 
                                                            className="flex-1 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition cursor-pointer"
                                                        >
                                                            Save Details
                                                        </button>
                                                    </div>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className="bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm space-y-1">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                                    <FiFileText size={11} className="text-slate-355" />
                                                    Task Description
                                                </h4>
                                                <p className="text-slate-650 text-[11px] leading-tight font-sans whitespace-pre-wrap">
                                                    {currentTask.description || "No description provided."}
                                                </p>
                                            </div>
                                        )}

                                        {/* Grid detail cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {[
                                                { label: "Created By", val: currentTask.created_by || "System Admin", icon: FiUserCheck },
                                                { label: "Created On", val: "Jun 20, 2026", icon: FiCalendar },
                                                { label: "Last Sync", val: "Just now", icon: FiRefreshCw }
                                            ].map((meta, idx) => {
                                                const MetaIcon = meta.icon;
                                                return (
                                                    <div key={idx} className="bg-slate-50 border border-slate-200/60 p-2 rounded-lg flex items-center gap-1.5">
                                                        <div className="p-1 rounded bg-white border border-slate-150 text-slate-400 shrink-0">
                                                            <MetaIcon size={10} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-[7.5px] font-semibold text-slate-450 uppercase tracking-wider block mb-0.5">{meta.label}</span>
                                                            <span className="text-[10.5px] font-bold text-slate-650 block truncate">{meta.val}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Specifications details rows */}
                                        <div className="bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm space-y-2">
                                            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Specifications Detail</h4>
                                            <div className="divide-y divide-slate-100 text-[11px]">
                                                {[
                                                    { label: "Priority Level", val: `${currentTask.priority || "Medium"} Priority`, icon: FiTrendingUp, color: "text-amber-600" },
                                                    { label: "Assigned Representative", val: currentTask.employee, icon: FiUser, color: "text-indigo-650" },
                                                    { label: "Work status", val: currentTask.status || "Pending", icon: FiActivity, color: "text-slate-700" },
                                                    { label: "Due Date Target", val: currentTask.deadline, icon: FiClock, color: "text-rose-500" }
                                                ].map((row, idx) => {
                                                    const RowIcon = row.icon;
                                                    return (
                                                        <div key={idx} className="flex justify-between items-center py-1">
                                                            <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[8.5px]">
                                                                 <RowIcon size={10} className="text-slate-300" />
                                                                 <span>{row.label}</span>
                                                            </div>
                                                            <span className={`font-bold text-[10.5px] ${row.color}`}>{row.val}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* B. CHECKLIST TAB */}
                                {activeTab === "Checklist" && (
                                    <div className="space-y-2 bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Checklist Tasks</h4>
                                            <span className="text-[8.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                {completedChecklist}/{totalChecklist} Done
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            {checklist.map((item) => (
                                                <div 
                                                    key={item.id}
                                                    onClick={() => toggleChecklistItem(item.id)}
                                                    className={`flex items-start gap-2 py-1 px-2 border rounded cursor-pointer transition text-[11px] font-medium ${
                                                        item.done 
                                                            ? "bg-slate-50/50 border-slate-150 text-slate-400 line-through" 
                                                            : "bg-white border-slate-200/80 text-slate-700 hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className={`mt-0.5 shrink-0 h-3.5 w-3.5 border rounded flex items-center justify-center transition ${
                                                        item.done ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                                                    }`}>
                                                        {item.done && <FiX size={8} className="rotate-45" />}
                                                    </div>
                                                    <span className="font-sans leading-tight">{item.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* C. COMMENTS TAB */}
                                {activeTab === "Comments" && (
                                    <div className="space-y-2.5 animate-fade-in">
                                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                            {comments.map((comment) => (
                                                <div key={comment.id} className="bg-slate-50/50 border border-slate-200/60 p-2 rounded-lg space-y-1">
                                                    <div className="flex justify-between items-center text-[9px]">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-slate-700">{comment.author}</span>
                                                            <span className="text-[7.5px] bg-slate-100 text-slate-450 font-bold px-1 rounded uppercase tracking-wider">{comment.role}</span>
                                                        </div>
                                                        <span className="text-slate-400 font-semibold">{comment.time}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 leading-tight font-sans whitespace-pre-wrap">{comment.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <form onSubmit={handleAddComment} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Write comment updates..."
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                className="flex-1 bg-slate-55 border border-slate-200 rounded px-2.5 py-1 text-[11px] text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition font-sans"
                                            />
                                            <button
                                                type="submit"
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1 rounded shadow-xs hover:scale-[1.01] transition cursor-pointer flex items-center justify-center"
                                            >
                                                <FiSend size={11} />
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {/* D. ATTACHMENTS TAB */}
                                {activeTab === "Attachments" && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 animate-fade-in">
                                        {attachments.map((file) => (
                                            <div key={file.id} className="bg-white border border-slate-200/80 p-2 rounded shadow-xs flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 rounded bg-indigo-50 border border-indigo-100/50 text-indigo-600 shrink-0">
                                                        <FiFileText size={11} />
                                                    </div>
                                                    <div className="min-w-0 leading-tight">
                                                        <span className="text-[11px] font-bold text-slate-800 block truncate max-w-[140px]">{file.name}</span>
                                                        <span className="text-[7.5px] text-slate-400 font-semibold block uppercase tracking-wider">{file.size} • {file.date}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold py-0.5 px-2 hover:bg-slate-50 rounded transition cursor-pointer"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* E. ACTIVITY TAB */}
                                {activeTab === "Activity" && (
                                    <div className="space-y-2 bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm animate-fade-in">
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Activity History logs</h4>
                                        <div className="relative pl-3 border-l border-slate-100 space-y-2">
                                            {activities.map((act) => (
                                                <div key={act.id} className="relative text-[11px]">
                                                    <div className="absolute -left-[16.5px] top-1 h-1.5 w-1.5 rounded-full border border-white bg-slate-350 ring-2 ring-white"></div>
                                                    <span className="font-bold text-slate-700">{act.author}</span>{" "}
                                                    <span className="text-slate-500 font-medium font-sans">{act.text}</span>
                                                    <span className="block text-[7.5px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">{act.time}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>

                        {/* RIGHT COLUMN - SIDEBAR DETAILS (0.8fr width) */}
                        <div className="space-y-3">
                            
                            {/* Quick Actions Card */}
                            <div className="bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm space-y-2">
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                    <FiSettings size={11} className="text-slate-350" />
                                    Quick Operations
                                </h4>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button 
                                        type="button" 
                                        onClick={startEdit}
                                        className="h-8 text-[11px] rounded-lg font-semibold px-3 flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-all cursor-pointer"
                                    >
                                        Edit Details
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={openAssigneeList}
                                        className="h-8 text-[11px] rounded-lg font-semibold px-3 flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-all cursor-pointer"
                                    >
                                        Assign Team
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsChangingStatus(true)}
                                        className="h-8 text-[11px] rounded-lg font-semibold px-3 flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-all cursor-pointer col-span-2"
                                    >
                                        Change Status
                                    </button>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleMarkComplete}
                                    className="w-full h-8 text-[11px] rounded-lg font-semibold px-3 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer gap-1 shadow-sm active:scale-[0.98]"
                                >
                                    <FiCheckCircle size={11} />
                                    Mark Complete
                                </button>
                            </div>

                            {/* Delegation Summary Card */}
                            <div className="bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm space-y-2">
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide font-display">Delegation summary</h4>
                                <div className="space-y-1.5">
                                    <div>
                                        <div className="flex justify-between items-center text-[7.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                            <span>Tasks Checklist</span>
                                            <span>{checklistProgress}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${checklistProgress}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100 text-xs">
                                        {[
                                            { label: "Checklist Items", val: totalChecklist },
                                            { label: "Comments Feed", val: comments.length },
                                            { label: "Attachments", val: attachments.length },
                                            { label: "Timeline logs", val: activities.length }
                                        ].map((stat, idx) => (
                                            <div key={idx} className="flex justify-between py-1 text-[9px]">
                                                <span className="text-slate-400 font-semibold uppercase tracking-wider">{stat.label}</span>
                                                <span className="font-extrabold text-slate-700">{stat.val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Updates Timeline Widget - Compact rows */}
                            <div className="bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm space-y-2">
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide font-display">Updates Timeline</h4>
                                <div className="relative pl-3 border-l border-slate-100 space-y-1.5">
                                    {activities.slice(0, 3).map((act) => (
                                        <div key={act.id} className="relative text-[11px] leading-tight">
                                            <div className="absolute -left-[16px] top-1 h-1.5 w-1.5 rounded-full bg-slate-300 ring-2 ring-white"></div>
                                            <span className="font-semibold text-slate-500 font-sans block leading-normal text-[10.5px]">
                                                <strong className="text-slate-700 font-bold">{act.author}</strong> {act.text}
                                            </span>
                                            <span className="text-[7.5px] text-slate-400 block font-bold uppercase tracking-wider">{act.time.split(" - ")[1] || act.time}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* MODALS SECTION */}

            {/* 1. Assign Team Modal (Searchable, Compact List, Highlight selected) */}
            {isAssigning && (
                <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs" onClick={() => setIsAssigning(false)}></div>
                    <div className="relative bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-lg p-3 z-10 space-y-2.5 animate-slide-up">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Select Representative</span>
                            <button onClick={() => setIsAssigning(false)} className="text-slate-400 hover:text-slate-650 p-1 cursor-pointer"><FiX size={13} /></button>
                        </div>
                        {/* Compact Search Bar */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by name, role or email..."
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                className="w-full h-8 text-xs px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-400 outline-none transition font-sans"
                                autoFocus
                            />
                        </div>
                        {loadingEmployees ? (
                            <div className="py-6 text-center text-xs text-slate-400">Loading team members...</div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-100">No representative found</div>
                        ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scroll-smooth">
                                {filteredEmployees.map(emp => {
                                    const isSelected = currentTask.employee === emp.name;
                                    return (
                                        <div 
                                            key={emp._id} 
                                            onClick={() => handleSaveAssignee(emp)}
                                            className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition text-left ${
                                                isSelected 
                                                    ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-50/80" 
                                                    : "hover:bg-slate-50 hover:text-slate-900 text-slate-700"
                                            }`}
                                        >
                                            <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 font-display ${
                                                isSelected 
                                                    ? "bg-indigo-100 text-indigo-700" 
                                                    : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                            }`}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 leading-none">
                                                <span className="text-[11px] font-bold block">{emp.name}</span>
                                                <span className="text-[8px] font-semibold text-slate-400 block uppercase tracking-wider mt-0.5">{emp.role}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 2. Change Status Modal */}
            {isChangingStatus && (
                <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs" onClick={() => setIsChangingStatus(false)}></div>
                    <div className="relative bg-white border border-slate-200 w-full max-w-xs rounded-xl shadow-lg p-3 z-10 space-y-2.5 animate-slide-up">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Change Status</span>
                            <button onClick={() => setIsChangingStatus(false)} className="text-slate-400 hover:text-slate-650 p-1 cursor-pointer"><FiX size={13} /></button>
                        </div>
                        <div className="space-y-0.5">
                            {["Pending", "In Progress", "Completed", "Cancelled"].map(st => (
                                <div 
                                    key={st}
                                    onClick={() => handleSaveStatus(st)}
                                    className={`p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition text-left text-[11px] font-bold ${
                                        currentTask.status === st ? "text-indigo-600 bg-indigo-50/50" : "text-slate-600"
                                    }`}
                                >
                                    {st}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TaskDetailsDrawer;
