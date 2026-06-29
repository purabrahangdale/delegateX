import { useState, useEffect } from "react";
import { FiX, FiCheck } from "react-icons/fi";

function AddEmployeeModal({ isOpen, onClose, onSave, employeeToEdit }) {
    const [formData, setFormData] = useState({
        name: "",
        role: "",
        project: "",
        status: "Active",
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (employeeToEdit) {
            setFormData({
                name: employeeToEdit.name || "",
                role: employeeToEdit.role || "",
                project: employeeToEdit.project || "",
                status: employeeToEdit.status || "Active",
            });
        } else {
            setFormData({
                name: "",
                role: "",
                project: "",
                status: "Active",
            });
        }
        setErrors({});
    }, [employeeToEdit, isOpen]);

    if (!isOpen) return null;

    const validate = () => {
        const tempErrors = {};
        if (!formData.name.trim()) tempErrors.name = "Full name is required";
        if (!formData.role) tempErrors.role = "Role designation is required";
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
                            {employeeToEdit ? "Modify Team Member" : "Add Team Member"}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            {employeeToEdit ? "Update profile details and role assignments." : "Delegate a new member to the system directory."}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-full">
                        {/* Name */}
                        <div className="w-full max-w-full">
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Rahul Sharma"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full max-w-full bg-slate-50 border ${errors.name ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"} text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans`}
                            />
                            {errors.name && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.name}</p>}
                        </div>

                        {/* Role select */}
                        <div className="w-full max-w-full">
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Role Designation</label>
                            <div className="relative w-full max-w-full overflow-hidden">
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className={`w-full max-w-full bg-slate-50 border ${errors.role ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"} text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans cursor-pointer`}
                                >
                                    <option value="">Select Role</option>
                                    <option>Frontend Engineer</option>
                                    <option>Backend Engineer</option>
                                    <option>Tester</option>
                                    <option>Project Manager</option>
                                    <option>Full Stack Developer</option>
                                </select>
                            </div>
                            {errors.role && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.role}</p>}
                        </div>

                        {/* Project */}
                        <div className="w-full max-w-full">
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Assigned Project</label>
                            <input
                                type="text"
                                placeholder="e.g. E-Commerce Development"
                                value={formData.project}
                                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                                className="w-full max-w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans"
                            />
                        </div>

                        {/* Status selection (only during edit) */}
                        {employeeToEdit && (
                            <div className="w-full max-w-full">
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
                                <div className="relative w-full max-w-full overflow-hidden">
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full max-w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans cursor-pointer"
                                    >
                                        <option>Active</option>
                                        <option>Away</option>
                                        <option>On Leave</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Form actions */}
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
                                className="flex-1 py-3 text-xs font-semibold bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/15 transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <FiCheck size={14} />
                                {employeeToEdit ? "Save Changes" : "Create Profile"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AddEmployeeModal;