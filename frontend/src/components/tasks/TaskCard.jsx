import { FiTrash2, FiChevronLeft, FiChevronRight, FiClock, FiGrid } from "react-icons/fi";

function TaskCard({ task, onStatusChange, onDelete, onClick }) {
    const getPriorityStyle = (priority) => {
        switch (priority) {
            case "High":
                return "bg-rose-50/60 text-rose-700 border-rose-150";
            case "Medium":
                return "bg-amber-50/60 text-amber-650 border-amber-150";
            case "Low":
                return "bg-emerald-50/60 text-emerald-700 border-emerald-150";
            default:
                return "bg-slate-50 text-slate-500 border-slate-200";
        }
    };

    const handleShiftLeft = () => {
        const taskId = task._id || task.id;
        if (task.status === "In Progress") onStatusChange(taskId, "Pending");
        else if (task.status === "Completed") onStatusChange(taskId, "In Progress");
    };

    const handleShiftRight = () => {
        const taskId = task._id || task.id;
        if (task.status === "Pending") onStatusChange(taskId, "In Progress");
        else if (task.status === "In Progress") onStatusChange(taskId, "Completed");
    };

    const taskId = task._id || task.id;

    return (
        <div 
            onClick={onClick}
            className="w-full min-h-[140px] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between gap-3 relative cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
        >
            {/* Top Row */}
            <div className="flex justify-between items-start gap-4">
                {/* LEFT: priority badge, status badge, task title */}
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getPriorityStyle(task.priority)}`}>
                        {task.priority || "Medium"} Priority
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${
                        task.status === "Completed" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : task.status === "In Progress"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                : "bg-slate-50 text-slate-500 border-slate-200"
                    }`}>
                        {task.status || "Pending"}
                    </span>
                    <h4 className="text-sm font-semibold leading-tight text-slate-900 truncate max-w-[200px] sm:max-w-md md:max-w-xl lg:max-w-2xl font-display" title={task.title}>
                        {task.title}
                    </h4>
                </div>

                {/* RIGHT: delete trash button, status shift controls */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Shifting triggers */}
                    <div className="flex items-center gap-0.5">
                        {task.status !== "Pending" && (
                            <button
                                onClick={handleShiftLeft}
                                className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition cursor-pointer"
                                title="Move Backwards"
                            >
                                <FiChevronLeft size={12} />
                            </button>
                        )}
                        {task.status !== "Completed" && (
                            <button
                                onClick={handleShiftRight}
                                className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition cursor-pointer"
                                title="Move Forwards"
                            >
                                <FiChevronRight size={12} />
                            </button>
                        )}
                    </div>
                    
                    {/* Delete button */}
                    <button
                        onClick={() => onDelete(taskId)}
                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Task"
                    >
                        <FiTrash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Middle Row */}
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {task.description || "No description provided."}
                </p>
            </div>

            {/* Bottom Row */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                {/* LEFT: assignee avatar, project name, clock icon, due date */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500 min-w-0">
                    <div className="flex items-center gap-1.5" title={`Assigned to ${task.employee}`}>
                        <div className="w-5.5 h-5.5 rounded bg-indigo-50 text-indigo-650 border border-indigo-100/50 flex items-center justify-center font-bold text-[9px] shrink-0 font-display">
                            {task.employee?.charAt(0) || "?"}
                        </div>
                        <span className="font-bold text-slate-650 truncate max-w-[120px]">{task.employee}</span>
                    </div>
                    <span className="text-slate-300">|</span>
                    <span className="font-bold text-slate-600 truncate max-w-[150px]" title={task.project}>
                        {task.project}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-semibold flex items-center gap-1 text-slate-400">
                        <FiClock size={10} className="text-slate-300" /> {task.deadline}
                    </span>
                </div>

                {/* RIGHT: open details arrow button */}
                <div className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all duration-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </div>
        </div>
    );
}

export default TaskCard;