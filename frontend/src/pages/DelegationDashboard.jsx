import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiRefreshCw, FiBookOpen, FiMoreHorizontal, FiAlertTriangle, FiChevronRight, FiPlus, FiAlertCircle,
    FiClock, FiTrendingUp, FiAward, FiAlertOctagon, FiActivity
} from "react-icons/fi";
import { getTasks } from "../services/taskApi";
import { getEmployees } from "../services/employeeApi";
import { getOverallProductivity, calculateDaysWorked } from "../utils/productivityUtils";
import { useWebSockets } from "../context/WebSocketContext";

/* ─── Primary KPI Card ──────────────────────────────────────────── */
function KPICard({ label, value, labelColor }) {
    return (
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5 hover:shadow-md transition-all duration-200">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</span>
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{value}</p>
        </div>
    );
}

/* ─── Secondary KPI Card ────────────────────────────────────────── */
function SecondaryKPICard({ label, value, labelColor }) {
    return (
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5 hover:shadow-md transition-all duration-200">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</span>
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{value}</p>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function DelegationDashboard() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { delegationSocket } = useWebSockets();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [tasksRes, employeesRes] = await Promise.all([
                getTasks(),
                getEmployees()
            ]);
            setTasks(tasksRes.data || []);
            setEmployees(employeesRes || []);
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!delegationSocket) return;

        const handleDelegationMessage = (eventData) => {
            console.log("Delegation event received:", eventData);
            const { event, data } = eventData;
            
            if (event === "delegation_created") {
                setTasks(prev => {
                    if (prev.some(t => t._id === data._id)) return prev;
                    return [data, ...prev];
                });
            } else if (event === "task_updated") {
                setTasks(prev => prev.map(t => t._id === data._id ? { ...t, ...data } : t));
            } else if (event === "task_completed") {
                setTasks(prev => prev.map(t => t._id === data._id ? { ...t, ...data, status: "Completed" } : t));
            } else if (event === "task_deleted") {
                setTasks(prev => prev.filter(t => t._id !== data._id));
            } else if (event === "employee_activity_updated") {
                fetchData();
            }
        };

        delegationSocket.on("message", handleDelegationMessage);
        return () => {
            delegationSocket.off("message", handleDelegationMessage);
        };
    }, [delegationSocket]);


    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const getStatusColor = (priority) => {
        if (priority === "Urgent") return "bg-red-500";
        if (priority === "High") return "bg-rose-500";
        if (priority === "Medium") return "bg-amber-500";
        return "bg-emerald-500";
    };

    // --- Dynamic Metric Calculations ---
    const openTasks = tasks.filter(t => t.status !== "Completed" && t.status !== "completed");
    const completedTasks = tasks.filter(t => t.status === "Completed" || t.status === "completed");
    const totalCount = tasks.length;
    const pendingCount = tasks.filter(t => t.status === "Pending" || t.status === "todo" || t.status === "To Do").length;
    const inProgressCount = tasks.filter(t => t.status === "In Progress" || t.status === "in progress" || t.status === "in_progress").length;
    const completedCount = completedTasks.length;
    const inReviewCount = tasks.filter(t => t.status === "In Review" || t.status === "in review" || t.status === "in_review").length;
    const activeCount = pendingCount + inProgressCount + inReviewCount;

    // Overdue: not completed and deadline passed
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueCount = openTasks.filter(t => t.deadline && t.deadline < todayStr).length;

    // Primary KPIs
    const dynamicPrimaryKPI = [
        {
            label: "Active",
            value: activeCount.toString(),
            labelColor: "text-slate-400",
        },
        {
            label: "Pending",
            value: pendingCount.toString(),
            labelColor: "text-amber-500",
        },
        {
            label: "In Progress",
            value: inProgressCount.toString(),
            labelColor: "text-indigo-500",
        },
        {
            label: "In Review",
            value: inReviewCount.toString(),
            labelColor: "text-purple-500",
        },
        {
            label: "Overdue",
            value: overdueCount.toString(),
            labelColor: "text-rose-500",
        },
        {
            label: "Completed",
            value: completedCount.toString(),
            labelColor: "text-emerald-500",
        },
    ];

    // Secondary KPIs
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Avg Cycle Time
    const completedTasksWithDates = completedTasks.filter(t => t.startDate && t.deadline);
    let avgCycleTime = 0;
    if (completedTasksWithDates.length > 0) {
        const totalMs = completedTasksWithDates.reduce((acc, t) => {
            const start = new Date(t.startDate);
            const end = new Date(t.deadline);
            return acc + (end - start);
        }, 0);
        const avgMs = totalMs / completedTasksWithDates.length;
        avgCycleTime = Math.max(0, Math.round(avgMs / (1000 * 60 * 60 * 24)));
    } else {
        const tasksWithDates = tasks.filter(t => t.startDate && t.deadline);
        if (tasksWithDates.length > 0) {
            const totalMs = tasksWithDates.reduce((acc, t) => {
                const start = new Date(t.startDate);
                const end = new Date(t.deadline);
                return acc + (end - start);
            }, 0);
            const avgMs = totalMs / tasksWithDates.length;
            avgCycleTime = Math.max(0, Math.round(avgMs / (1000 * 60 * 60 * 24)));
        }
    }

    // On-Time Delivery
    const onTimeCompleted = completedTasks.filter(t => !t.deadline || t.deadline >= todayStr).length;
    const onTimeDeliveryRate = completedTasks.length > 0 ? Math.round((onTimeCompleted / completedTasks.length) * 100) : 100;

    // Due in 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];
    const dueIn3DaysCount = openTasks.filter(t => t.deadline && t.deadline >= todayStr && t.deadline <= threeDaysStr).length;

    const dynamicSecondaryKPI = [
        {
            label: "Completion Rate",
            value: `${completionRate}%`,
            labelColor: "text-indigo-500",
        },
        {
            label: "Avg Cycle Time",
            value: `${avgCycleTime} days`,
            labelColor: "text-amber-500",
        },
        {
            label: "On-Time Delivery",
            value: `${onTimeDeliveryRate}%`,
            labelColor: "text-emerald-500",
        },
        {
            label: "Due in 3 Days",
            value: dueIn3DaysCount.toString(),
            labelColor: "text-rose-500",
        },
    ];

    // Helper: calculate relative deadline text
    const getRelativeTimeline = (deadlineDateStr) => {
        if (!deadlineDateStr) return { text: "No deadline", isOverdue: false };
        const deadline = new Date(deadlineDateStr);
        const today = new Date();
        deadline.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            const absDays = Math.abs(diffDays);
            return {
                text: `${absDays} day${absDays !== 1 ? 's' : ''} ago`,
                isOverdue: true
            };
        } else if (diffDays === 0) {
            return {
                text: "today",
                isOverdue: false
            };
        } else {
            return {
                text: `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
                isOverdue: false
            };
        }
    };

    // --- Department Workload Calculations ---
    const getEmployeeDepartment = (empName) => {
        if (!empName || empName.toLowerCase() === "unassigned") return "Unassigned";
        const emp = employees.find(e => (e.name || e.employee_name) === empName);
        if (!emp) return "Unassigned";
        const role = (emp.role || emp.position || "").toLowerCase();
        if (role.includes("designer") || role.includes("design") || role.includes("ui") || role.includes("ux")) return "Designer";
        if (role.includes("developer") || role.includes("engineer") || role.includes("frontend") || role.includes("backend") || role.includes("fullstack")) return "Developer";
        if (role.includes("qa") || role.includes("test")) return "QA";
        if (role.includes("manager") || role.includes("coordinator") || role.includes("hr")) return "Management";
        return "Other";
    };

    const workloadCounts = {};
    openTasks.forEach(t => {
        const dept = getEmployeeDepartment(t.employee_name || t.employee);
        workloadCounts[dept] = (workloadCounts[dept] || 0) + 1;
    });
    const maxWorkload = Math.max(...Object.values(workloadCounts), 1);
    const sortedDepts = Object.keys(workloadCounts).sort((a, b) => workloadCounts[b] - workloadCounts[a]);

    // --- Top Assignees Calculations ---
    const assigneeCounts = {};
    openTasks.forEach(t => {
        const name = t.employee_name || t.employee;
        if (name && name.toLowerCase() !== "unassigned") {
            assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
        }
    });
    const maxAssigneeTasks = Math.max(...Object.values(assigneeCounts), 1);
    const topAssignees = Object.keys(assigneeCounts)
        .map(name => {
            const emp = employees.find(e => (e.name || e.employee_name) === name);
            return {
                name,
                count: assigneeCounts[name],
                avatar: emp?.avatar || name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(),
                role: emp?.role || "Team Member"
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    // --- Recent Activity Timeline Generation ---
    const generatedActivities = [];
    tasks.forEach((task, idx) => {
        const emp = task.employee_name || task.employee || "Unassigned";
        const code = task._id ? `DLG-${String(task._id).substring(task._id.length - 6).toUpperCase()}` : `DLG-2026-00${10 + idx}`;

        if (task.status === "Completed") {
            generatedActivities.push({
                id: `act-comp-${task._id || idx}`,
                author: emp,
                text: `completed task: "${task.title}"`,
                taskCode: code,
                time: "1d ago",
                color: "bg-emerald-500"
            });
            generatedActivities.push({
                id: `act-comm-${task._id || idx}`,
                author: emp,
                text: `Added a comment`,
                taskCode: code,
                time: "2d ago",
                color: "bg-indigo-500"
            });
        } else if (task.status === "In Progress") {
            generatedActivities.push({
                id: `act-prog-${task._id || idx}`,
                author: emp,
                text: `Checklist toggle`,
                taskCode: code,
                time: "3h ago",
                color: "bg-indigo-500"
            });
            generatedActivities.push({
                id: `act-attach-${task._id || idx}`,
                author: emp,
                text: `Attached file`,
                taskCode: code,
                time: "1d ago",
                color: "bg-indigo-500"
            });
        } else {
            generatedActivities.push({
                id: `act-pend-${task._id || idx}`,
                author: emp,
                text: `Task delegated`,
                taskCode: code,
                time: "2d ago",
                color: "bg-slate-400"
            });
        }
    });
    const activitiesList = generatedActivities.slice(0, 8);

    // --- Priority calculations ---
    const priorityCounts = { Urgent: 0, High: 0, Medium: 0, Low: 0 };
    openTasks.forEach(t => {
        const p = t.priority || "Medium";
        if (priorityCounts[p] !== undefined) {
            priorityCounts[p]++;
        } else {
            priorityCounts["Medium"]++;
        }
    });
    const openTotal = openTasks.length || 1;
    const urgentPercent = Math.round((priorityCounts.Urgent / openTotal) * 100);
    const highPercent = Math.round((priorityCounts.High / openTotal) * 100);
    const mediumPercent = Math.round((priorityCounts.Medium / openTotal) * 100);
    const lowPercent = Math.max(0, 100 - urgentPercent - highPercent - mediumPercent);

    // --- Task Aging calculations ---
    const getTaskAgeDays = (task) => {
        let createdDate = new Date();
        if (task.startDate) {
            createdDate = new Date(task.startDate);
        } else if (task._id && task._id.length === 24) {
            const timestamp = parseInt(task._id.substring(0, 8), 16) * 1000;
            createdDate = new Date(timestamp);
        }
        const diffTime = Math.abs(new Date() - createdDate);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    const agingCounts = { "0-2 days": 0, "3-7 days": 0, "8-14 days": 0, "15+ days": 0 };
    openTasks.forEach(t => {
        const age = getTaskAgeDays(t);
        if (age <= 2) agingCounts["0-2 days"]++;
        else if (age <= 7) agingCounts["3-7 days"]++;
        else if (age <= 14) agingCounts["8-14 days"]++;
        else agingCounts["15+ days"]++;
    });
    const maxAging = Math.max(...Object.values(agingCounts), 1);

    // --- Donut Chart / Status Mix Calculations ---
    const statusGroups = [
        { label: "Assigned", count: pendingCount, color: "#f59e0b", bgClass: "bg-amber-500" },
        { label: "In Progress", count: inProgressCount, color: "#4f46e5", bgClass: "bg-indigo-500" },
        { label: "In Review", count: inReviewCount, color: "#8b5cf6", bgClass: "bg-purple-500" },
        { label: "Completed", count: completedCount, color: "#10b981", bgClass: "bg-emerald-500" }
    ];

    // Filter groups that have count > 0 to render segments
    const activeSegments = statusGroups.filter(g => g.count > 0);
    const totalActiveCount = activeSegments.reduce((sum, g) => sum + g.count, 0);

    let accumulatedOffset = 0;
    const segmentsWithOffsets = activeSegments.map(g => {
        const percent = (g.count / (totalActiveCount || 1)) * 100;
        const segmentOffset = (accumulatedOffset / 100) * 188.5;
        accumulatedOffset += percent;
        return {
            ...g,
            percent,
            offset: segmentOffset
        };
    });

    const displayLegend = [
        { label: "Assigned", count: pendingCount, percent: totalCount > 0 ? (pendingCount / totalCount) * 100 : 0, bgClass: "bg-amber-500" },
        { label: "In Progress", count: inProgressCount, percent: totalCount > 0 ? (inProgressCount / totalCount) * 100 : 0, bgClass: "bg-indigo-500" },
        { label: "In Review", count: inReviewCount, percent: totalCount > 0 ? (inReviewCount / totalCount) * 100 : 0, bgClass: "bg-purple-500" },
        { label: "Completed", count: completedCount, percent: totalCount > 0 ? (completedCount / totalCount) * 100 : 0, bgClass: "bg-emerald-500" }
    ];

    const gap = segmentsWithOffsets.length > 1 ? 3 : 0;

    // --- Employee Productivity Calculations ---
    const prodData = getOverallProductivity(tasks, employees);

    const topPerformers = [...prodData.employeesMetrics]
        .sort((a, b) => b.completedCount - a.completedCount || b.completionRate - a.completionRate)
        .slice(0, 3);

    const longestActiveDelegations = tasks
        .filter(t => t.status !== "Completed" && t.status !== "completed")
        .map(t => ({
            ...t,
            daysWorked: calculateDaysWorked(t.assignedDate, t.completedDate)
        }))
        .sort((a, b) => b.daysWorked - a.daysWorked)
        .slice(0, 3);

    const overdueTasks = tasks.filter(t => t.status !== "Completed" && t.status !== "completed" && t.deadline && t.deadline < todayStr);
    const overdueByEmployee = {};
    overdueTasks.forEach(t => {
        const name = t.employee_name || t.employee || "Unassigned";
        if (name !== "Unassigned") {
            overdueByEmployee[name] = (overdueByEmployee[name] || 0) + 1;
        }
    });
    const employeesWithOverdue = Object.keys(overdueByEmployee).map(name => ({
        name,
        count: overdueByEmployee[name]
    })).slice(0, 3);

    const recentUpdates = [];
    tasks.forEach(t => {
        const emp = t.employee_name || t.employee || "Unassigned";
        if (t.statusHistory) {
            t.statusHistory.forEach(h => {
                recentUpdates.push({
                    employee: emp,
                    taskTitle: t.title,
                    status: h.status,
                    date: h.changedAt || t.assignedDate
                });
            });
        }
    });
    const quickSnapshot = recentUpdates
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);

    if (isLoading) {
        return (
            <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-6 animate-pulse">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <div className="h-6 w-48 bg-slate-200 rounded"></div>
                        <div className="h-3 w-64 bg-slate-150 rounded"></div>
                    </div>
                </div>

                {/* Primary KPI Skeletons */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-col gap-2">
                            <div className="h-3 w-16 bg-slate-200 rounded"></div>
                            <div className="h-6 w-24 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>

                {/* Secondary KPI Skeletons */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-col gap-2">
                            <div className="h-3 w-20 bg-slate-200 rounded"></div>
                            <div className="h-6 w-24 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 space-y-4">
                        <div className="h-4 w-40 bg-slate-200 rounded"></div>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex gap-4 items-center justify-between border-t border-slate-100 pt-3">
                                <div className="space-y-2 flex-1">
                                    <div className="h-3 w-1/3 bg-slate-200 rounded"></div>
                                    <div className="h-2 w-1/2 bg-slate-150 rounded"></div>
                                </div>
                                <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 space-y-4">
                        <div className="h-4 w-32 bg-slate-200 rounded"></div>
                        <div className="flex justify-center py-4">
                            <div className="w-28 h-28 rounded-full border-8 border-slate-200 flex items-center justify-center">
                                <div className="h-6 w-12 bg-slate-150 rounded"></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex justify-between items-center">
                                    <div className="h-3 w-16 bg-slate-150 rounded"></div>
                                    <div className="h-3 w-8 bg-slate-200 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-5">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Title block */}
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Delegation Dashboard</h1>
                    <p className="text-slate-500 text-xs mt-1">At-a-glance overview of delegated work.</p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                    {/* Create Delegation Shortcut */}
                    <button
                        onClick={() => navigate("/create-delegation")}
                        className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/10 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center gap-2 cursor-pointer"
                    >
                        <FiPlus size={14} />
                        New Delegation
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="space-y-4 mt-2">
                {/* Primary row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {dynamicPrimaryKPI.map((card) => (
                        <KPICard key={card.label} {...card} />
                    ))}
                </div>

                {/* Secondary row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {dynamicSecondaryKPI.map((card) => (
                        <SecondaryKPICard key={card.label} {...card} />
                    ))}
                </div>
            </div>


            {/* ── Attention Required Section (Styled exactly like 2nd Image) ── */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.01)] border border-slate-200/80 mt-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <FiAlertTriangle className="text-amber-500" size={18} />
                        <h2 className="text-lg font-bold text-slate-900 font-display">Attention Required</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigate("/tasks")}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-0.5 cursor-pointer"
                        >
                            View all
                        </button>
                        <FiChevronRight className="text-indigo-500" size={14} />
                    </div>
                </div>

                {/* List Items */}
                <div className="flex flex-col gap-0 border-t border-slate-100 divide-y divide-slate-100">
                    {openTasks.slice(0, 5).map((task) => {
                        const rel = getRelativeTimeline(task.deadline);
                        return (
                            <div
                                key={task._id || task.id}
                                className="flex items-center justify-between py-4 hover:bg-indigo-50/10 transition-colors px-3 -mx-3 rounded-xl cursor-pointer group"
                                onClick={() => navigate(`/tasks/${task._id || task.id}`)}
                            >
                                {/* Left Side */}
                                <div className="flex items-center gap-4">
                                    {/* Thick left accent bar based on priority */}
                                    <div className={`w-1.5 h-11 rounded-full ${getStatusColor(task.priority)}`} />
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">
                                            {task.title}
                                        </h4>
                                        <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1.5">
                                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide font-sans">
                                                DLG-{task._id ? String(task._id).substring(task._id.length - 6).toUpperCase() : "N/A"}
                                            </span>
                                            <span>{task.employee_name || task.employee || "Unassigned"}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Right Side */}
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            {rel.isOverdue && <FiAlertCircle className="text-rose-500" size={13} />}
                                            <span className={`text-xs font-bold ${rel.isOverdue ? 'text-rose-500' : 'text-amber-600'}`}>
                                                {rel.text}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-400 mt-1">
                                            {task.deadline ? new Date(task.deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "No deadline"}
                                        </p>
                                    </div>
                                    <FiChevronRight className="text-slate-355 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" size={16} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Visual Custom Widgets Panels Area (3-Column Layout matching screenshot) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">

                {/* Column 1: Department Workload & Priority (Open) */}
                <div className="flex flex-col gap-5">
                    {/* Department Workload */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.01)] border border-slate-200/80 flex flex-col h-[280px]">
                        <div className="flex items-center justify-between mb-5 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900 font-display">Department Workload</h3>
                            </div>
                            <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                <FiMoreHorizontal size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                            {sortedDepts.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-10">No active workloads found.</p>
                            ) : (
                                sortedDepts.map(dept => {
                                    const count = workloadCounts[dept];
                                    const percent = Math.round((count / maxWorkload) * 100);
                                    return (
                                        <div key={dept} className="space-y-1.5">
                                            <div className="flex justify-between text-xs font-semibold text-slate-600 font-sans">
                                                <span>{dept}</span>
                                                <span className="font-bold text-slate-800">{count}</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Priority (Open) */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.01)] border border-slate-200/80 flex flex-col h-[280px]">
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                            <h3 className="text-sm font-bold text-slate-900 font-display">Priority (Open)</h3>
                            <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                <FiMoreHorizontal size={18} />
                            </button>
                        </div>

                        {/* Stacked Progress Bar (Directly below Priority Open) */}
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex mb-4 flex-shrink-0">
                            <div className="h-full bg-red-500 transition-all" style={{ width: `${urgentPercent}%` }} title={`Urgent: ${priorityCounts.Urgent}`} />
                            <div className="h-full bg-rose-500 transition-all" style={{ width: `${highPercent}%` }} title={`High: ${priorityCounts.High}`} />
                            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${mediumPercent}%` }} title={`Medium: ${priorityCounts.Medium}`} />
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${lowPercent}%` }} title={`Low: ${priorityCounts.Low}`} />
                        </div>

                        {/* Vertical Legend */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 text-xs font-semibold text-slate-600 pr-1">
                            <div className="flex items-center justify-between py-0.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                    <span>Urgent</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800">{priorityCounts.Urgent}</span>
                                    <span className="text-[11px] text-slate-400 font-normal w-8 text-right">{urgentPercent}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                    <span>High</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800">{priorityCounts.High}</span>
                                    <span className="text-[11px] text-slate-400 font-normal w-8 text-right">{highPercent}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                    <span>Medium</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800">{priorityCounts.Medium}</span>
                                    <span className="text-[11px] text-slate-400 font-normal w-8 text-right">{mediumPercent}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <span>Low</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800">{priorityCounts.Low}</span>
                                    <span className="text-[11px] text-slate-400 font-normal w-8 text-right">{lowPercent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Top Assignees */}
                <div className="flex flex-col gap-5">
                    {/* Top Assignees */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.01)] border border-slate-200/80 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-5 flex-shrink-0">
                            <h3 className="text-sm font-bold text-slate-900 font-display">Top Assignees</h3>
                            <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                <FiMoreHorizontal size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                            {topAssignees.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-10">No active assignees found.</p>
                            ) : (
                                topAssignees.map(assignee => {
                                    const percent = Math.round((assignee.count / maxAssigneeTasks) * 100);
                                    return (
                                        <div key={assignee.name} className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                                                {assignee.avatar}
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex justify-between text-xs font-semibold text-slate-700 font-sans truncate">
                                                    <span className="truncate">{assignee.name}</span>
                                                    <span className="font-bold text-slate-900 flex-shrink-0">{assignee.count}</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Recent Activity (spanning full height) */}
                <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.01)] border border-slate-200/80 flex flex-col h-[580px] lg:h-full">
                    <div className="flex items-center justify-between mb-5 flex-shrink-0">
                        <h3 className="text-sm font-bold text-slate-900 font-display">Recent Activity</h3>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                            <FiMoreHorizontal size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                        {activitiesList.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-10">No recent activity logged.</p>
                        ) : (
                            <div className="relative pl-5 space-y-4 before:absolute before:inset-y-1 before:left-1.5 before:w-[1px] before:bg-slate-100">
                                {activitiesList.map((act) => (
                                    <div key={act.id} className="relative flex justify-between items-start gap-3 text-xs">
                                        <span className={`absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${act.color}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-700 leading-relaxed font-medium">
                                                <span className="font-bold text-slate-900">{act.author}</span> {act.text}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="bg-slate-50 border border-slate-100 text-slate-400 text-[9px] font-bold px-1 rounded">
                                                    {act.taskCode}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-semibold">{act.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Trend & Status Mix Charts (2-Column Layout matching reference) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
                {/* Workload Trend (spans 2 columns on lg) */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col h-[320px]">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <FiTrendingUp className="text-indigo-500" size={16} />
                            <h3 className="text-sm font-bold text-slate-900 font-display">Workload Trend</h3>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">LAST 14 DAYS</span>
                    </div>
                    <div className="flex-1 min-h-0">
                        <svg viewBox="0 0 600 200" className="w-full h-full">
                            {/* Grid Lines */}
                            <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="40" y1="60" x2="580" y2="60" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="40" y1="100" x2="580" y2="100" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="40" y1="140" x2="580" y2="140" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="40" y1="180" x2="580" y2="180" stroke="#cbd5e1" strokeWidth="1" />

                            {/* Y-Axis Labels */}
                            <text x="15" y="24" className="text-[10px] fill-slate-400 font-semibold font-sans">8</text>
                            <text x="15" y="64" className="text-[10px] fill-slate-400 font-semibold font-sans">6</text>
                            <text x="15" y="104" className="text-[10px] fill-slate-400 font-semibold font-sans">4</text>
                            <text x="15" y="144" className="text-[10px] fill-slate-400 font-semibold font-sans">2</text>
                            <text x="15" y="184" className="text-[10px] fill-slate-400 font-semibold font-sans">0</text>

                            {/* Gradients & Glow Filters */}
                            <defs>
                                <linearGradient id="gradient-assigned" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="gradient-completed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                                <filter id="glow-indigo" x="-10%" y="-10%" width="120%" height="120%">
                                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#4f46e5" floodOpacity="0.25" />
                                </filter>
                                <filter id="glow-emerald" x="-10%" y="-10%" width="120%" height="120%">
                                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10b981" floodOpacity="0.25" />
                                </filter>
                            </defs>

                            {/* Fills */}
                            <path
                                d="M 40,180 L 160,180 C 190,180 220,48 240,48 C 260,48 275,180 285,180 L 360,180 C 380,180 400,130 420,130 L 500,130 C 520,130 540,180 560,180 L 580,180 Z"
                                fill="url(#gradient-assigned)"
                            />
                            <path
                                d="M 40,180 L 165,180 C 195,180 220,110 240,110 C 260,110 275,180 285,180 L 580,180 Z"
                                fill="url(#gradient-completed)"
                            />

                            {/* Lines */}
                            <path
                                d="M 40,180 L 160,180 C 190,180 220,48 240,48 C 260,48 275,180 285,180 L 360,180 C 380,180 400,130 420,130 L 500,130 C 520,130 540,180 560,180 L 580,180"
                                fill="none"
                                stroke="#4f46e5"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                filter="url(#glow-indigo)"
                            />
                            <path
                                d="M 40,180 L 165,180 C 195,180 220,110 240,110 C 260,110 275,180 285,180 L 580,180"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                filter="url(#glow-emerald)"
                            />

                            {/* Marker Highlights at Peaks */}
                            <circle cx="240" cy="48" r="4.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                            <circle cx="240" cy="110" r="4.5" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
                            <circle cx="460" cy="130" r="4.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />

                            {/* X-Axis Labels */}
                            <text x="40" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">13 Jun</text>
                            <text x="120" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">15 Jun</text>
                            <text x="200" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">17 Jun</text>
                            <text x="240" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">18 Jun</text>
                            <text x="320" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">20 Jun</text>
                            <text x="400" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">22 Jun</text>
                            <text x="480" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">24 Jun</text>
                            <text x="560" y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold font-sans">26 Jun</text>
                        </svg>
                    </div>
                </div>

                {/* Status Mix (spans 1 column on lg) */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col h-[320px] justify-between">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <FiClock className="text-indigo-500" size={16} />
                            <h3 className="text-sm font-bold text-slate-900 font-display">Status Mix</h3>
                        </div>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                            <FiMoreHorizontal size={18} />
                        </button>
                    </div>

                    {/* Donut Chart Visual */}
                    <div className="flex-1 flex items-center justify-center relative">
                        <svg viewBox="0 0 100 100" className="w-32 h-32">
                            {/* Base Gray/Slate Empty Circle */}
                            <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />

                            {/* Dynamic Donut Segments */}
                            {segmentsWithOffsets.map((seg, idx) => (
                                <circle
                                    key={idx}
                                    cx="50"
                                    cy="50"
                                    r="30"
                                    fill="transparent"
                                    stroke={seg.color}
                                    strokeWidth="8"
                                    strokeDasharray={`${Math.max(0, (seg.percent / 100) * 188.5 - gap)} 188.5`}
                                    strokeDashoffset={-seg.offset}
                                    transform="rotate(-90 50 50)"
                                    strokeLinecap="round"
                                    className="transition-all duration-300 ease-in-out hover:stroke-[10px] cursor-pointer"
                                />
                            ))}
                        </svg>

                        <div className="absolute text-center leading-none">
                            <span className="text-base font-extrabold text-slate-800 font-display block">{totalCount}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Total</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2 text-xs font-semibold text-slate-600 font-sans mt-3">
                        {displayLegend.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${item.bgClass}`} />
                                    <span>{item.label}</span>
                                </div>
                                <div className="flex gap-3 text-right">
                                    <span className="font-bold text-slate-800">{item.count}</span>
                                    <span className="text-[11px] text-slate-400 font-normal w-8 text-right">
                                        {Math.round(item.percent)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
