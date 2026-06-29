import { useState, useEffect, useRef } from "react";
import { FiX, FiCheck, FiChevronDown } from "react-icons/fi";
import { getEmployees } from "../../services/employeeApi";
import { getProjects } from "../../services/projectApi";

function AddTaskModal({ isOpen, onClose, onSave }) {
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        employee: "",
        employee_id: "",
        employee_name: "",
        project: "",
        priority: "Medium",
        deadline: "",
        status: "Pending"
    });

    const [employees, setEmployees] = useState([]);
    const [projects, setProjects] = useState([]);
    const [errors, setErrors] = useState({});

    // Custom Dropdown States
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [loadingEmployees, setLoadingEmployees] = useState(true);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setLoadingEmployees(true);
            // Load employees and projects for dropdowns
            async function fetchOptions() {
                try {
                    const [empRes, projRes] = await Promise.all([
                        getEmployees(),
                        getProjects()
                    ]);
                    setEmployees(empRes || []);
                    setProjects(projRes.data || []);
                } catch (err) {
                    console.error("Failed to load task relations options", err);
                } finally {
                    setLoadingEmployees(false);
                }
            }
            fetchOptions();

            // Reset form
            setFormData({
                title: "",
                description: "",
                employee: "",
                employee_id: "",
                employee_name: "",
                project: "",
                priority: "Medium",
                deadline: "",
                status: "Pending"
            });
            setErrors({});
            setDropdownOpen(false);
            setHighlightedIndex(-1);
        }
    }, [isOpen]);

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const validate = () => {
        const tempErrors = {};
        if (!formData.title.trim()) tempErrors.title = "Task title is required";
        if (!formData.employee) tempErrors.employee = "Please select an assignee";
        if (!formData.project) tempErrors.project = "Please select a project";
        if (!formData.deadline) tempErrors.deadline = "Deadline is required";
        setErrors(tempErrors);
        return Object.keys(tempErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        onSave(formData);
        onClose();
    };

    // Keyboard navigation helper
    const handleKeyDown = (e) => {
        if (!dropdownOpen) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setDropdownOpen(true);
                if (employees.length > 0) {
                    setHighlightedIndex(0);
                }
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightedIndex((prev) => (prev + 1) % employees.length);
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex((prev) => (prev - 1 + employees.length) % employees.length);
                break;
            case "Enter":
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < employees.length) {
                    selectEmployee(employees[highlightedIndex]);
                }
                break;
            case "Escape":
            case "Tab":
                setDropdownOpen(false);
                break;
            default:
                break;
        }
    };

    const selectEmployee = (emp) => {
        setFormData({
            ...formData,
            employee: emp.name,
            employee_name: emp.name,
            employee_id: emp._id
        });
        setDropdownOpen(false);
        setHighlightedIndex(-1);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Box Wrapper */}
            <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
                {/* Modal Container */}
                <div className="relative bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-5 sm:p-6 md:p-8 animate-slide-up z-10 overflow-hidden">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                        <FiX size={16} />
                    </button>

                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-slate-900 font-display">Assign New Task</h3>
                        <p className="text-xs text-slate-500 mt-1">Delegate specific actions to team members and tracks.</p>
                    </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Task Title */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Task Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Build login auth module"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className={`w-full bg-slate-50 border ${errors.title ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"} text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans`}
                        />
                        {errors.title && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.title}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description</label>
                        <textarea
                            rows={3}
                            placeholder="Describe requirements and endpoints..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans resize-none"
                        />
                    </div>

                    {/* Assignee Selection (Custom Dropdown) */}
                    <div className="relative" ref={dropdownRef}>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Assign Member</label>
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            onKeyDown={handleKeyDown}
                            className={`w-full bg-slate-50 border ${
                                errors.employee ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            } text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans cursor-pointer flex items-center justify-between text-left focus:bg-white`}
                            aria-haspopup="listbox"
                            aria-expanded={dropdownOpen}
                        >
                            <span className={formData.employee ? "text-slate-800 font-medium" : "text-slate-400"}>
                                {formData.employee || "Select Assignee"}
                            </span>
                            <FiChevronDown className={`text-slate-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} size={14} />
                        </button>
                        
                        {errors.employee && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.employee}</p>}

                        {dropdownOpen && (
                            <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1.5 focus:outline-none animate-slide-up">
                                {loadingEmployees ? (
                                    <div className="px-4 py-3 text-xs text-slate-400 font-medium flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Loading team members...</span>
                                    </div>
                                ) : employees.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-slate-400 font-medium text-center">
                                        No team members available
                                    </div>
                                ) : (
                                    <ul role="listbox" className="focus:outline-none">
                                        {employees.map((emp, index) => {
                                            const isSelected = formData.employee_id === emp._id || formData.employee === emp.name;
                                            const isHighlighted = index === highlightedIndex;
                                            return (
                                                <li
                                                    key={emp._id}
                                                    role="option"
                                                    aria-selected={isSelected}
                                                    onClick={() => selectEmployee(emp)}
                                                    className={`px-4 py-2.5 text-xs text-slate-700 cursor-pointer flex items-center justify-between transition-colors duration-150 ${
                                                        isSelected 
                                                            ? "bg-indigo-50/80 text-indigo-700 font-semibold" 
                                                            : isHighlighted 
                                                                ? "bg-slate-50 text-slate-900" 
                                                                : "hover:bg-slate-50 hover:text-slate-900"
                                                    }`}
                                                >
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-semibold">{emp.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-normal">{emp.role}</span>
                                                    </div>
                                                    {isSelected && <FiCheck className="text-indigo-600 shrink-0" size={14} />}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Project Association (Dropdown) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Associated Project</label>
                        <select
                            value={formData.project}
                            onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                            className={`w-full bg-slate-50 border ${errors.project ? "border-rose-300 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"} text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans cursor-pointer`}
                        >
                            <option value="">Select Project</option>
                            {projects.map((proj) => (
                                <option key={proj._id} value={proj.name}>
                                    {proj.name}
                                </option>
                            ))}
                        </select>
                        {errors.project && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.project}</p>}
                    </div>

                    {/* Priority and Deadline Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Priority</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans cursor-pointer"
                            >
                                <option>High</option>
                                <option>Medium</option>
                                <option>Low</option>
                            </select>
                        </div>
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
                    </div>

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
                            Assign Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
);
}

export default AddTaskModal;