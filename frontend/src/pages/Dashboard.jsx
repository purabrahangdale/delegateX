import { useEffect, useState } from "react";
import { getEmployees } from "../services/employeeApi";
import { getProjects } from "../services/projectApi";
import { getTasks } from "../services/taskApi";
import { FiUsers, FiBriefcase, FiCheckSquare, FiClock, FiPlus, FiActivity, FiArrowUpRight, FiZap } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

function Dashboard() {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const [empRes, projRes, taskRes] = await Promise.all([
                    getEmployees(),
                    getProjects(),
                    getTasks()
                ]);
                setEmployees(Array.isArray(empRes) ? empRes : (empRes?.data || []));
                setProjects(projRes.data || []);
                setTasks(taskRes.data || []);
            } catch (err) {
                console.error("Error loading dashboard data", err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Statistics Calculations
    const totalEmployees = employees.length || 0;
    const activeProjects = projects.filter(p => p.status === "In Progress").length || 0;
    const completedTasks = tasks.filter(t => t.status === "Completed").length || 0;
    const pendingTasks = tasks.filter(t => t.status === "Pending" || t.status === "In Progress").length || 0;

    // Task completion rate percentage
    const totalTasks = tasks.length || 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const stats = [
        {
            title: "Total Members",
            value: totalEmployees,
            change: `+${employees.filter(e => e.status === "Active").length} Active now`,
            color: "text-indigo-600 border-indigo-100 bg-indigo-50/50",
            icon: FiUsers,
        },
        {
            title: "Active Projects",
            value: activeProjects,
            change: `${projects.length} Total tracks`,
            color: "text-amber-600 border-amber-100 bg-amber-50/50",
            icon: FiBriefcase,
        },
        {
            title: "Completed Tasks",
            value: completedTasks,
            change: `${completionRate}% Completion rate`,
            color: "text-emerald-600 border-emerald-100 bg-emerald-50/50",
            icon: FiCheckSquare,
        },
        {
            title: "Pending Pipeline",
            value: pendingTasks,
            change: "Requires supervision",
            color: "text-rose-600 border-rose-100 bg-rose-50/50",
            icon: FiClock,
        },
    ];

    // Mock activities for timeline
    const activities = [
        { id: 1, type: "task", text: "Aman Verma completed authentication flow", time: "10 mins ago", color: "bg-emerald-500" },
        { id: 2, type: "project", text: "New project 'HR Portal Beta' was initialized", time: "2 hours ago", color: "bg-indigo-500" },
        { id: 3, type: "employee", text: "Sanjay Kumar was added to the Frontend Team", time: "4 hours ago", color: "bg-amber-500" },
        { id: 4, type: "task", text: "Priya Patel updated task 'Database Sync'", time: "1 day ago", color: "bg-slate-400" },
    ];

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse mt-2">
                <div className="flex flex-col gap-2">
                    <div className="h-8 w-48 bg-slate-200 rounded-xl"></div>
                    <div className="h-4 w-72 bg-slate-200 rounded-xl"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 bg-slate-100 border border-slate-200 rounded-2xl"></div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="h-96 bg-slate-100 border border-slate-200 rounded-2xl lg:col-span-2"></div>
                    <div className="h-96 bg-slate-100 border border-slate-200 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 mt-2">
            {/* Welcome Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Dashboard Overview</h1>
                    <p className="text-slate-500 text-xs mt-1">Real-time insights on your workspace productivity and delegation pipelines.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/tasks')}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                        <FiPlus size={14} />
                        Delegate Task
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <div 
                            key={index}
                            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-start justify-between group"
                        >
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.title}</span>
                                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{item.value}</h2>
                                <p className="text-[10px] text-slate-400 font-semibold">{item.change}</p>
                            </div>
                            <div className={`p-3 rounded-xl border transition-all duration-300 group-hover:scale-105 ${item.color}`}>
                                <Icon size={16} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Visual Analytics Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Chart (Col 1 & 2) */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 font-display">Task Resolution Trend</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Tasks completed daily over the past week</p>
                        </div>
                        <span className="text-[10px] bg-indigo-50/50 text-indigo-600 font-bold px-2.5 py-1 rounded-lg border border-indigo-100/50 flex items-center gap-1">
                            <FiActivity size={10} />
                            Live Metrics
                        </span>
                    </div>

                    {/* Custom SVG Line Chart */}
                    <div className="relative h-64 w-full flex items-end">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15" />
                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>
                            
                            {/* Grid Lines */}
                            <line x1="0" y1="40" x2="600" y2="40" stroke="#f8fafc" strokeWidth="1" />
                            <line x1="0" y1="100" x2="600" y2="100" stroke="#f8fafc" strokeWidth="1" />
                            <line x1="0" y1="160" x2="600" y2="160" stroke="#f8fafc" strokeWidth="1" />

                            {/* Area under the line */}
                            <path 
                                d="M 0 200 Q 100 130, 200 160 T 400 80 T 600 40 L 600 200 Z" 
                                fill="url(#chartGradient)" 
                            />

                            {/* Main Curve Line */}
                            <path 
                                d="M 0 200 Q 100 130, 200 160 T 400 80 T 600 40" 
                                fill="none" 
                                stroke="#4f46e5" 
                                strokeWidth="2.5" 
                                strokeLinecap="round"
                            />

                            {/* Node points */}
                            <circle cx="200" cy="160" r="4.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                            <circle cx="400" cy="80" r="4.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                            <circle cx="600" cy="40" r="4.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
                        </svg>

                        {/* Chart labels overlay */}
                        <div className="absolute inset-x-0 bottom-0 flex justify-between px-2 pt-2 text-[10px] text-slate-400 font-bold font-sans">
                            <span>Mon</span>
                            <span>Tue</span>
                            <span>Wed</span>
                            <span>Thu</span>
                            <span>Fri</span>
                            <span>Sat</span>
                            <span>Sun</span>
                        </div>
                    </div>
                </div>

                {/* Circular Gauge Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 font-display">Workspace Health</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Overall task completion percentage</p>
                    </div>

                    <div className="relative flex items-center justify-center my-6">
                        <svg className="w-36 h-36 transform -rotate-90">
                            <circle 
                                cx="72" 
                                cy="72" 
                                r="54" 
                                stroke="#f8fafc" 
                                strokeWidth="10" 
                                fill="transparent" 
                            />
                            <circle 
                                cx="72" 
                                cy="72" 
                                r="54" 
                                stroke="#4f46e5" 
                                strokeWidth="10" 
                                fill="transparent" 
                                strokeDasharray={339.3}
                                strokeDashoffset={339.3 - (339.3 * completionRate) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-700 ease-out"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-2xl font-extrabold text-slate-800 font-display leading-none">{completionRate}%</span>
                            <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase mt-1">Resolved</span>
                        </div>
                    </div>

                    <div className="text-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                        <p className="text-[11px] text-slate-500 leading-normal">
                            {completionRate > 70 
                                ? "Excellent. The pipeline efficiency is well within SLA targets." 
                                : "Pending tasks are increasing. Reallocations recommended."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Actions & Recent Activities Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activities Timeline */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <h3 className="text-sm font-bold text-slate-900 mb-6 font-display">System Activity Feed</h3>
                    <div className="relative pl-6 space-y-6 before:absolute before:inset-y-1 before:left-2 before:w-[1px] before:bg-slate-100">
                        {activities.map((act) => (
                            <div key={act.id} className="relative flex justify-between items-start gap-4">
                                <span className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${act.color}`}></span>
                                <div>
                                    <p className="text-xs text-slate-700 leading-normal font-medium">{act.text}</p>
                                    <span className="text-[9px] text-slate-400 font-semibold block mt-1">{act.time}</span>
                                </div>
                                <span className="p-1 rounded bg-slate-50 text-slate-400 hover:text-slate-700 transition cursor-pointer">
                                    <FiArrowUpRight size={12} />
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions Section */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col justify-between gap-6">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-1 font-display">Quick Actions</h3>
                        <p className="text-xs text-slate-400">Perform direct administrative operations instantly.</p>
                    </div>

                    <div className="space-y-2.5">
                        <button 
                            onClick={() => navigate('/employees')}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/10 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-all duration-200 text-left group cursor-pointer"
                        >
                            <span className="flex items-center gap-2">
                                <FiUsers className="text-slate-400 group-hover:text-indigo-500" />
                                Add Team Member
                            </span>
                            <FiPlus className="text-slate-300 group-hover:text-indigo-500" />
                        </button>
                        <button 
                            onClick={() => navigate('/projects')}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/10 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-all duration-200 text-left group cursor-pointer"
                        >
                            <span className="flex items-center gap-2">
                                <FiBriefcase className="text-slate-400 group-hover:text-indigo-500" />
                                Create New Project
                            </span>
                            <FiPlus className="text-slate-300 group-hover:text-indigo-500" />
                        </button>
                        <button 
                            onClick={() => navigate('/tasks')}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/10 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-all duration-200 text-left group cursor-pointer"
                        >
                            <span className="flex items-center gap-2">
                                <FiZap className="text-slate-400 group-hover:text-indigo-500" />
                                Review Open Kanban
                            </span>
                            <FiArrowUpRight className="text-slate-300 group-hover:text-indigo-500" />
                        </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start gap-3">
                        <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                            <FiZap size={14} />
                        </span>
                        <div>
                            <span className="text-[10px] font-bold text-slate-700 block uppercase tracking-wider">Workspace tip</span>
                            <p className="text-[10px] text-slate-400 leading-normal mt-1">Assign high priority statuses to tasks close to deadlines to alert team members.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;