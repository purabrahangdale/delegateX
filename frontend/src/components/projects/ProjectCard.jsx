import { useState } from "react";
import { FiTrash2, FiEdit, FiClock, FiLayers, FiCheck, FiX, FiAlertCircle } from "react-icons/fi";

function ProjectCard({ project, onEdit, onDelete }) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    const getStatusStyle = (status) => {
        switch (status) {
            case "In Progress":
                return "bg-indigo-50/60 text-indigo-700 border-indigo-100";
            case "Completed":
                return "bg-emerald-50/60 text-emerald-700 border-emerald-100";
            case "Pending":
                return "bg-amber-50/60 text-amber-700 border-amber-100";
            default:
                return "bg-slate-50 text-slate-500 border-slate-200";
        }
    };

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between h-64 group relative">
            
            {/* Upper Section */}
            <div>
                <div className="flex justify-between items-start gap-4 mb-2.5">
                    <h3 className="text-sm font-bold font-display text-slate-800 tracking-tight group-hover:text-indigo-600 transition truncate">
                        {project.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold shrink-0 border uppercase tracking-wider ${getStatusStyle(project.status)}`}>
                        {project.status}
                    </span>
                </div>
                <p className="text-slate-400 text-xs leading-normal font-sans line-clamp-3 mb-4">
                    {project.description || "No description provided."}
                </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 mb-2">
                <div className="flex justify-between items-center text-[10px] font-bold font-sans">
                    <span className="text-slate-400 uppercase tracking-wider">Project Track</span>
                    <span className="text-indigo-600">{project.progress || 0}%</span>
                </div>
                <div className="w-full bg-slate-50 border border-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${project.progress || 0}%` }}
                    ></div>
                </div>
            </div>

            {/* Bottom details block */}
            <div className="border-t border-slate-100/80 pt-3.5 flex items-center justify-between mt-auto">
                <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex gap-3">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                            <FiClock size={11} className="text-slate-300" />
                            <span>{project.deadline || "No Due Date"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                            <FiLayers size={11} className="text-slate-300" />
                            <span>{project.tasks || 0} Tasks</span>
                        </div>
                    </div>
                    {project.team && project.team.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Team:</span>
                            <div className="flex -space-x-1.5 overflow-hidden">
                                {project.team.slice(0, 3).map((member, index) => (
                                    <div
                                        key={index}
                                        className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-indigo-50 text-indigo-600 border border-indigo-100/50 flex items-center justify-center font-bold text-[8px] font-display"
                                        title={member}
                                    >
                                        {member.charAt(0)}
                                    </div>
                                ))}
                                {project.team.length > 3 && (
                                    <div
                                        className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-[8px] font-display"
                                        title={project.team.slice(3).join(", ")}
                                    >
                                        +{project.team.length - 3}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* CRUD options */}
                <div className="flex items-center gap-0.5">
                    {confirmDelete ? (
                        <div className="flex items-center gap-1 animate-fade-in">
                            <button
                                onClick={() => onDelete(project._id)}
                                className="p-1 rounded bg-rose-500 hover:bg-rose-600 text-white transition cursor-pointer"
                                title="Confirm Delete"
                            >
                                <FiCheck size={11} />
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                title="Cancel"
                            >
                                <FiX size={11} />
                            </button>
                        </div>
                    ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition duration-200 flex items-center">
                            <button
                                onClick={() => onEdit(project)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Edit Project"
                            >
                                <FiEdit size={12} />
                            </button>
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Project"
                            >
                                <FiTrash2 size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProjectCard;