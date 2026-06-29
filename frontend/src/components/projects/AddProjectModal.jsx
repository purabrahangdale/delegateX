import { useState, useEffect } from "react";
import { FiX, FiCheck } from "react-icons/fi";

function AddProjectModal({ isOpen, onClose, onSave, projectToEdit }) {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        deadline: "",
        progress: 0,
        status: "Pending",
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (projectToEdit) {
            setFormData({
                name: projectToEdit.name || "",
                description: projectToEdit.description || "",
                deadline: projectToEdit.deadline || "",
                progress: projectToEdit.progress || 0,
                status: projectToEdit.status || "Pending",
            });
        } else {
            setFormData({
                name: "",
                description: "",
                deadline: "",
                progress: 0,
                status: "Pending",
            });
        }
        setErrors({});
    }, [projectToEdit, isOpen]);

    if (!isOpen) return null;

    const validate = () => {
        const tempErrors = {};
        if (!formData.name.trim()) tempErrors.name = "Project name is required";
        if (!formData.deadline) tempErrors.deadline = "Deadline date is required";
        setErrors(tempErrors);
        return Object.keys(tempErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Overlay backdrop */}
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Box Wrapper */}
            <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
                {/* Modal Box */}
                <div className="relative bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-5 sm:p-6 md:p-8 animate-slide-up z-10 overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                    <FiX size={16} />
                </button>

                <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-900 font-display">
                        {projectToEdit ? "Modify Project" : "Create Project"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        {projectToEdit ? "Update progress track and info details." : "Initialize a new project track for the work group."}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Project Name</label>
                        <input
                            type="text"
                            placeholder="e.g. E-Commerce Redesign"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={`w-full bg-slate-50 border ${errors.name ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"} text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans`}
                        />
                        {errors.name && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.name}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description</label>
                        <textarea
                            rows={3}
                            placeholder="Detail the milestones, goals, and tech stack..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans resize-none"
                        />
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Deadline</label>
                        <input
                            type="date"
                            value={formData.deadline}
                            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            className={`w-full bg-slate-50 border ${errors.deadline ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"} text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans`}
                        />
                        {errors.deadline && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.deadline}</p>}
                    </div>

                    {/* Progress Slider (Only during edit) */}
                    {projectToEdit && (
                        <>
                            <div>
                                <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1.5">
                                    <span>Project Track Progress</span>
                                    <span className="text-indigo-600 font-bold">{formData.progress}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={formData.progress}
                                    onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans cursor-pointer"
                                >
                                    <option>Pending</option>
                                    <option>In Progress</option>
                                    <option>Completed</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/15 transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <FiCheck size={14} />
                            {projectToEdit ? "Save Changes" : "Create Project"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
);
}

export default AddProjectModal;