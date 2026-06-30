import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TaskCard from "../components/tasks/TaskCard";
import AddTaskModal from "../components/tasks/AddTaskModal";
import { getTasks, addTask, updateTask, deleteTask } from "../services/taskApi";
import { FiPlus, FiSearch, FiSliders, FiCheckSquare, FiPlusSquare, FiAlertCircle } from "react-icons/fi";
import { useToast } from "../context/ToastContext";
import tasksData from "../data/tasksData";

function Tasks() {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState(tasksData);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [activeFilter, setActiveFilter] = useState("All");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch tasks
    const fetchTasks = async () => {
        setLoading(true);
        try {
            const response = await getTasks();
            const list = response.data || [];
            setTasks(list);
        } catch (error) {
            console.error("Failed to load tasks", error);
            showToast("Failed to load delegated tasks.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    // Create new task
    const handleAddTask = async (taskData) => {
        try {
            await addTask(taskData);
            showToast("Task delegated successfully!");
            fetchTasks();
        } catch (error) {
            console.error(error);
            showToast("Failed to delegate task.", "error");
        }
    };

    // Update task status (shifting)
    const handleStatusChange = async (taskId, newStatus) => {
        try {
            // Find task details to pass full body schema
            const taskToUpdate = tasks.find(t => (t._id || t.id) === taskId);
            if (!taskToUpdate) return;

            const updatedTask = {
                ...taskToUpdate,
                status: newStatus
            };
            // Remove MongoDB metadata fields if any to avoid validation errors
            delete updatedTask._id;

            await updateTask(taskId, updatedTask);
            showToast(`Task moved to ${newStatus}`);
            fetchTasks();
        } catch (error) {
            console.error(error);
            showToast("Failed to update task track status.", "error");
        }
    };

    // Delete task
    const handleDeleteTask = async (taskId) => {
        try {
            await deleteTask(taskId);
            showToast("Task removed from board.");
            fetchTasks();
        } catch (error) {
            console.error(error);
            showToast("Failed to delete task.", "error");
        }
    };

    // Calculate metrics
    const totalTasks = tasks.length;
    const highPriorityCount = tasks.filter(t => t.priority === "High").length;
    const completedCount = tasks.filter(t => t.status === "Completed").length;
    const inProgressCount = tasks.filter(t => t.status === "In Progress").length;

    // Filtered tasks
    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
            (t.project && t.project.toLowerCase().includes(search.toLowerCase())) ||
            (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
        const matchesPriority = priorityFilter === "All" || t.priority === priorityFilter;

        let matchesStatus = true;
        if (activeFilter !== "All") {
            const taskStatus = (t.status || "").toLowerCase();
            if (activeFilter === "To Do") {
                matchesStatus = taskStatus === "pending" || taskStatus === "todo" || taskStatus === "to do";
            } else if (activeFilter === "In Progress") {
                matchesStatus = taskStatus === "in progress" || taskStatus === "in_progress";
            } else if (activeFilter === "Completed") {
                matchesStatus = taskStatus === "completed";
            }
        }

        return matchesSearch && matchesPriority && matchesStatus;
    });

    const columns = [
        { id: "Pending", title: "To Do", bg: "bg-slate-50 border-slate-200/50" },
        { id: "In Progress", title: "In Progress", bg: "bg-indigo-50/10 border-indigo-100/50" },
        { id: "Completed", title: "Completed", bg: "bg-emerald-50/10 border-emerald-100/50" }
    ];

    return (
        <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Task Delegation</h1>
                    <p className="text-slate-500 text-xs mt-1">Assign and monitor employee task lists, priority tags, and resolution pipelines.</p>
                </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tasks</span>
                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{totalTasks}</p>
                </div>
                <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">High Priority</span>
                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{highPriorityCount}</p>
                </div>
                <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">In Progress</span>
                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{inProgressCount}</p>
                </div>
                <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Completed</span>
                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{completedCount}</p>
                </div>
            </div>

            {/* Controls Bar - Horizontally Aligned at h-10 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[280px]">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiSearch size={14} />
                    </span>
                    <input
                        type="text"
                        placeholder="Search by project or task title..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-10 shadow-sm"
                    />
                </div>

                {/* Priority Selector & Assign button */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Priority:</span>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-xs px-3 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition cursor-pointer font-sans h-10 shadow-sm"
                        >
                            <option value="All">All Priorities</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl text-xs font-medium shadow-sm transition active:scale-[0.98] cursor-pointer h-10 whitespace-nowrap font-sans"
                    >
                        <FiPlus size={14} />
                        Assign Task
                    </button>
                </div>
            </div>

            {/* Segmented Filter Buttons */}
            <div className="flex items-center gap-2 max-w-full overflow-x-auto pb-0.5">
                {["All", "To Do", "In Progress", "Completed"].map((filter) => {
                    const isActive = activeFilter === filter;
                    return (
                        <button
                            key={filter}
                            type="button"
                            onClick={() => setActiveFilter(filter)}
                            className={`h-10 px-4 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center ${isActive
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                                }`}
                        >
                            {filter}
                        </button>
                    );
                })}
            </div>

            {/* Vertically stacked full-width task sections */}
            {loading ? (
                <div className="space-y-4 w-full">
                    {[1, 2, 3].map(c => (
                        <div key={c} className="bg-slate-100/50 border border-slate-200/60 rounded-2xl h-36 animate-pulse w-full"></div>
                    ))}
                </div>
            ) : filteredTasks.length > 0 ? (
                <div className="flex flex-col gap-4 w-full">
                    {[
                        { title: "To Do", dotColor: "bg-amber-500" },
                        { title: "In Progress", dotColor: "bg-indigo-500" },
                        { title: "Completed", dotColor: "bg-emerald-500" }
                    ]
                        .filter(col => activeFilter === "All" || col.title === activeFilter)
                        .map(col => {
                            const columnTasks = filteredTasks.filter(t => {
                                const taskStatus = (t.status || "").toLowerCase();
                                if (col.title === "To Do") {
                                    return taskStatus === "pending" || taskStatus === "todo" || taskStatus === "to do";
                                }
                                if (col.title === "In Progress") {
                                    return taskStatus === "in progress" || taskStatus === "in_progress";
                                }
                                if (col.title === "Completed") {
                                    return taskStatus === "completed";
                                }
                                return false;
                            });

                            return (
                                <div
                                    key={col.title}
                                    className="w-full rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-3"
                                >
                                    {/* Sticky Section Header */}
                                    <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-white/85 backdrop-blur-sm px-3 py-2 border border-slate-200/60 shadow-sm mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`}></span>
                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{col.title}</span>
                                        </div>
                                        <span className="bg-slate-200/80 text-slate-750 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                            {columnTasks.length}
                                        </span>
                                    </div>

                                    {/* Section task rows */}
                                    <div className="space-y-3">
                                        {columnTasks.length > 0 ? (
                                            columnTasks.map((task) => (
                                                <TaskCard
                                                    key={task._id || task.id}
                                                    task={task}
                                                    onStatusChange={handleStatusChange}
                                                    onDelete={handleDeleteTask}
                                                    onClick={() => navigate(`/tasks/${task._id || task.id}`)}
                                                />
                                            ))
                                        ) : (
                                            <div className="bg-white/40 border border-dashed border-slate-200 rounded-xl py-6 px-4 text-center text-xs text-slate-400 font-semibold">
                                                No tasks in this stage
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            ) : (
                /* Premium Empty state */
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 flex flex-col items-center justify-center gap-2.5 shadow-sm w-full">
                    <FiCheckSquare size={32} className="text-slate-300" />
                    <span className="text-sm font-semibold text-slate-800">No tasks found</span>
                    <span className="text-xs text-slate-400">Try adjusting your filters or search keywords.</span>
                </div>
            )}

            {/* Modal Form */}
            <AddTaskModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAddTask}
            />
        </div>
    );
}

export default Tasks;
