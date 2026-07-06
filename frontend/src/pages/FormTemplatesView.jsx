import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiSliders, FiEye, FiEdit3, FiTrash2, FiClipboard, FiChevronRight, FiX } from "react-icons/fi";
import { useToast } from "../context/ToastContext";

const DEFAULT_TEMPLATES = [
    {
        id: "demo-1",
        name: "Client Requirement Form",
        description: "Collect initial project requirements, scope, tech stack, and timeline constraints from the client.",
        fields: [
            { id: "1", type: "text", label: "Project Name", placeholder: "e.g., Enterprise CRM Redesign", required: true },
            { id: "2", type: "dropdown", label: "Primary Technology Stack", placeholder: "Select primary stack", required: true, options: ["React / Node.js", "Python / Django", "Java / Spring Boot", "Other"] },
            { id: "3", type: "longtext", label: "Scope of Work & Features", placeholder: "Describe the core features and requirements in detail...", required: true },
            { id: "4", type: "dropdown", label: "Expected Timeline", placeholder: "Select timeline", required: false, options: ["1 Month", "2-3 Months", "3-6 Months", "6+ Months"] },
            { id: "5", type: "text", label: "Target Budget (USD)", placeholder: "e.g., $15,000", required: false },
            { id: "6", type: "checkbox", label: "Requires Mutual NDA Signing", required: false }
        ]
    },
    {
        id: "demo-2",
        name: "Client Information Form",
        description: "Collect key business information, point of contact details, and communication preferences.",
        fields: [
            { id: "1", type: "text", label: "Company Legal Name", placeholder: "e.g., Acme Corporation", required: true },
            { id: "2", type: "text", label: "Primary Contact Person", placeholder: "e.g., Jane Doe", required: true },
            { id: "3", type: "email", label: "Corporate Email Address", placeholder: "e.g., contact@acme.com", required: true },
            { id: "4", type: "phone", label: "Contact Number", placeholder: "e.g., +1 (555) 019-2834", required: false },
            { id: "5", type: "dropdown", label: "Preferred Communication Channel", placeholder: "Select channel", required: true, options: ["Email", "WhatsApp", "Slack", "Zoom / Teams"] }
        ]
    }
];

export default function FormTemplatesView() {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterFieldCount, setFilterFieldCount] = useState("all");
    const [previewTemplate, setPreviewTemplate] = useState(null);

    // Load templates from localStorage or fallback to default templates
    useEffect(() => {
        const stored = localStorage.getItem("delegatex_form_templates");
        if (stored) {
            try {
                setTemplates(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse stored templates, using defaults.", e);
                setTemplates(DEFAULT_TEMPLATES);
                localStorage.setItem("delegatex_form_templates", JSON.stringify(DEFAULT_TEMPLATES));
            }
        } else {
            setTemplates(DEFAULT_TEMPLATES);
            localStorage.setItem("delegatex_form_templates", JSON.stringify(DEFAULT_TEMPLATES));
        }
    }, []);

    // Save templates to localStorage and update state
    const saveTemplates = (newTemplates) => {
        setTemplates(newTemplates);
        localStorage.setItem("delegatex_form_templates", JSON.stringify(newTemplates));
    };

    const handleDelete = (id, name) => {
        if (window.confirm(`Are you sure you want to delete the template "${name}"?`)) {
            const updated = templates.filter(t => t.id !== id);
            saveTemplates(updated);
            showToast(`Template "${name}" deleted from registry.`);
        }
    };

    // Filter templates based on search query and field count filter
    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchesFields = true;
        if (filterFieldCount === "small") {
            matchesFields = template.fields.length <= 5;
        } else if (filterFieldCount === "large") {
            matchesFields = template.fields.length > 5;
        }

        return matchesSearch && matchesFields;
    });

    const getFieldTypeBadgeLabel = (type) => {
        switch (type) {
            case "text": return "Text Input";
            case "email": return "Email";
            case "phone": return "Phone";
            case "date": return "Date";
            case "dropdown": return "Dropdown";
            case "checkbox": return "Checkbox";
            case "longtext": return "Long Text";
            default: return type;
        }
    };

    const getUniqueFieldTypes = (fields) => {
        const types = fields.map(f => getFieldTypeBadgeLabel(f.type));
        return [...new Set(types)];
    };

    return (
        <div className="space-y-8 mt-2">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span>Workspace</span>
                <FiChevronRight size={12} className="text-slate-350" />
                <span>Templates</span>
                <FiChevronRight size={12} className="text-slate-350" />
                <span className="text-slate-600">Form Templates</span>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Client Form Templates</h1>
                    <p className="text-slate-500 text-xs mt-1">
                        Build reusable form templates for client onboarding, requirement collection, and CRM workflows.
                    </p>
                </div>
                <Link
                    to="/templates/form-templates/create"
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                    <FiPlus size={14} />
                    New Template
                </Link>
            </div>

            {/* Search and Filters */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiSearch size={14} />
                    </span>
                    <input
                        type="text"
                        placeholder="Search templates by name or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3">
                    <FiSliders size={12} className="text-slate-400" />
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Filter Fields:</span>
                    <select
                        value={filterFieldCount}
                        onChange={(e) => setFilterFieldCount(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition cursor-pointer font-sans"
                    >
                        <option value="all">All Sizes</option>
                        <option value="small">Small (≤ 5 fields)</option>
                        <option value="large">Large (&gt; 5 fields)</option>
                    </select>
                </div>
            </div>

            {/* Grid Container */}
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => {
                        const uniqueTypes = getUniqueFieldTypes(template.fields);
                        return (
                            <div
                                key={template.id}
                                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] hover:shadow-[0_8px_16px_rgba(15,23,42,0.02)] transition duration-200 flex flex-col justify-between h-56"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg">
                                            {template.fields.length} {template.fields.length === 1 ? "Field" : "Fields"}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">Form Template</span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-800 font-display mb-1.5 line-clamp-1">{template.name}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{template.description}</p>
                                    
                                    {/* Field Type Badges */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {uniqueTypes.slice(0, 3).map((type, idx) => (
                                            <span key={idx} className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                {type}
                                            </span>
                                        ))}
                                        {uniqueTypes.length > 3 && (
                                            <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                                +{uniqueTypes.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setPreviewTemplate(template)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                        >
                                            <FiEye size={12} />
                                            Preview
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => navigate(`/templates/form-templates/create?edit=${template.id}`)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                                            title="Edit Template"
                                        >
                                            <FiEdit3 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(template.id, template.name)}
                                            className="p-2 text-slate-400 hover:text-rose-650 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                                            title="Delete Template"
                                        >
                                            <FiTrash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <FiClipboard size={32} className="text-slate-350" />
                        <span className="text-xs text-slate-450 font-semibold">No form templates found matching your search.</span>
                    </div>
                </div>
            )}

            {/* Premium Live Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-950 border border-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-900 flex justify-between items-center bg-slate-950">
                            <div>
                                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">Live Preview</span>
                                <h3 className="text-sm font-bold text-white font-display">{previewTemplate.name}</h3>
                            </div>
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-xl transition cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable Form Preview */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {previewTemplate.description && (
                                <p className="text-xs text-slate-300 bg-slate-900/40 p-3.5 rounded-xl border border-slate-900 leading-relaxed">
                                    {previewTemplate.description}
                                </p>
                            )}

                            <div className="space-y-4">
                                {previewTemplate.fields.length > 0 ? (
                                    previewTemplate.fields.map((field) => (
                                        <div key={field.id} className="space-y-1.5 text-left">
                                            <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1 select-none">
                                                {field.label || "Untitled Field"}
                                                {field.required && <span className="text-rose-500 font-bold">*</span>}
                                            </label>

                                            {field.type === "text" && (
                                                <input
                                                    type="text"
                                                    disabled
                                                    placeholder={field.placeholder || "Enter text..."}
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 disabled:text-white disabled:opacity-100 disabled:placeholder-slate-500 cursor-not-allowed outline-none"
                                                />
                                            )}

                                            {field.type === "email" && (
                                                <input
                                                    type="email"
                                                    disabled
                                                    placeholder={field.placeholder || "Enter email address..."}
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 disabled:text-white disabled:opacity-100 disabled:placeholder-slate-500 cursor-not-allowed outline-none"
                                                />
                                            )}

                                            {field.type === "phone" && (
                                                <input
                                                    type="tel"
                                                    disabled
                                                    placeholder={field.placeholder || "e.g. +1 (555) 000-0000"}
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 disabled:text-white disabled:opacity-100 disabled:placeholder-slate-500 cursor-not-allowed outline-none"
                                                />
                                            )}

                                            {field.type === "date" && (
                                                <input
                                                    type="date"
                                                    disabled
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 disabled:text-white disabled:opacity-100 disabled:placeholder-slate-500 cursor-not-allowed outline-none"
                                                />
                                            )}

                                            {field.type === "longtext" && (
                                                <textarea
                                                    disabled
                                                    placeholder={field.placeholder || "Enter description..."}
                                                    rows={3}
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 disabled:text-white disabled:opacity-100 disabled:placeholder-slate-500 cursor-not-allowed outline-none resize-none"
                                                />
                                            )}

                                            {field.type === "dropdown" && (
                                                <select
                                                    disabled
                                                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 disabled:text-white disabled:opacity-100 disabled:placeholder-slate-500 cursor-not-allowed outline-none"
                                                >
                                                    <option>{field.placeholder || "Select option..."}</option>
                                                    {field.options && field.options.map((opt, oIdx) => (
                                                        <option key={oIdx}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {field.type === "checkbox" && (
                                                <div className="flex items-center gap-2.5 py-1 select-none">
                                                    <input
                                                        type="checkbox"
                                                        disabled
                                                        className="w-4 h-4 rounded border-slate-800 bg-slate-900/60 text-indigo-500 cursor-not-allowed"
                                                    />
                                                    <span className="text-xs text-slate-300">{field.label || "Check this option"}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-slate-500 text-xs">
                                        No fields configured in this template.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-900 bg-slate-950 flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-xl transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
