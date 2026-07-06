import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiPlus, FiTrash2, FiBookOpen, FiArrowLeft, FiSave, FiInfo, FiChevronDown, FiPlusSquare, FiSettings, FiChevronRight } from "react-icons/fi";
import { useToast } from "../context/ToastContext";

export default function CreateFormTemplateView() {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get("edit");

    const [templateName, setTemplateName] = useState("");
    const [description, setDescription] = useState("");
    const [fields, setFields] = useState([]);
    const [showGuide, setShowGuide] = useState(false);

    // Load template if editing
    useEffect(() => {
        if (editId) {
            const stored = localStorage.getItem("delegatex_form_templates");
            if (stored) {
                try {
                    const list = JSON.parse(stored);
                    const found = list.find(t => t.id === editId);
                    if (found) {
                        setTemplateName(found.name);
                        setDescription(found.description);
                        setFields(found.fields || []);
                    }
                } catch (e) {
                    console.error("Failed to load template for edit", e);
                }
            }
        }
    }, [editId]);

    const addField = (type) => {
        const newField = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            type,
            label: `Untitled ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            placeholder: type === "dropdown" ? "Select option..." : "Enter text...",
            required: false,
            options: type === "dropdown" ? ["Option 1", "Option 2", "Option 3"] : []
        };
        setFields([...fields, newField]);
    };

    const updateFieldProperty = (id, property, value) => {
        setFields(fields.map(f => {
            if (f.id === id) {
                return { ...f, [property]: value };
            }
            return f;
        }));
    };

    const updateDropdownOptions = (id, optionsText) => {
        const optionsList = optionsText.split(",").map(opt => opt.trim()).filter(opt => opt.length > 0);
        updateFieldProperty(id, "options", optionsList);
    };

    const deleteField = (id) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const handleSave = () => {
        if (!templateName.trim()) {
            showToast("Please enter a template name.", "error");
            return;
        }

        const stored = localStorage.getItem("delegatex_form_templates");
        let list = [];
        if (stored) {
            try {
                list = JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }

        if (editId) {
            // Update existing
            list = list.map(t => {
                if (t.id === editId) {
                    return {
                        ...t,
                        name: templateName,
                        description: description,
                        fields: fields
                    };
                }
                return t;
            });
            showToast("Template updated successfully!");
        } else {
            // Create new
            const newTemplate = {
                id: "tmpl-" + Date.now(),
                name: templateName,
                description: description,
                fields: fields
            };
            list.push(newTemplate);
            showToast("Form Template created successfully!");
        }

        localStorage.setItem("delegatex_form_templates", JSON.stringify(list));
        navigate("/templates/form-templates");
    };

    const moveField = (index, direction) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= fields.length) return;
        const newFields = [...fields];
        const temp = newFields[index];
        newFields[index] = newFields[nextIndex];
        newFields[nextIndex] = temp;
        setFields(newFields);
    };

    return (
        <div className="space-y-8 mt-2">
            {/* Header / Top Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <span>Workspace</span>
                    <FiChevronRight size={12} className="text-slate-350" />
                    <span>Templates</span>
                    <FiChevronRight size={12} className="text-slate-350" />
                    <Link to="/templates/form-templates" className="hover:text-slate-600 transition">Form Templates</Link>
                    <FiChevronRight size={12} className="text-slate-350" />
                    <span className="text-slate-650 font-bold">{editId ? "Edit" : "Create"}</span>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => setShowGuide(!showGuide)}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                        <FiBookOpen size={14} />
                        Guide
                    </button>
                    <button
                        onClick={() => navigate("/templates/form-templates")}
                        className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                        <FiSave size={14} />
                        {editId ? "Save Changes" : "Create Template"}
                    </button>
                </div>
            </div>

            {/* Guide Banner */}
            {showGuide && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4 animate-fade-in">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                        <FiInfo size={16} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-900 font-display">Form Builder Guide</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            To build a custom form, add fields from the configuration list. Customize the label, placeholder, and check the <strong>Required</strong> toggle to mandate user input. Use the dropdown configuration to define options separated by commas. Changes are reflected in real-time in the client preview block on the right.
                        </p>
                    </div>
                </div>
            )}

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Panel: Configuration */}
                <div className="space-y-6">
                    {/* Panel Title & Navigation Info */}
                    <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                        <button
                            onClick={() => navigate("/templates/form-templates")}
                            className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                            title="Back to list"
                        >
                            <FiArrowLeft size={15} />
                        </button>
                        <div>
                            <h2 className="text-sm font-bold font-display text-slate-950 tracking-tight">
                                {editId ? "Edit Form Template" : "Create New Form Template"}
                            </h2>
                            <p className="text-slate-500 text-[10px] mt-0.5">
                                {editId ? "Modify fields and parameters of this template." : "Design custom input schemas for your onboarding processes."}
                            </p>
                        </div>
                    </div>

                    {/* Basic Meta Details */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">1. General Information</h3>
                        <div className="space-y-3.5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Template Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Lead Engagement & Briefing Form"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
                                <textarea
                                    placeholder="Provide a brief explanation of when to send this template or what details it gathers."
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Fields List Config */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">2. Configure Fields</h3>
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">
                                {fields.length} {fields.length === 1 ? "Field" : "Fields"} Added
                            </span>
                        </div>

                        {fields.length > 0 ? (
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                                {fields.map((field, idx) => (
                                    <div key={field.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 relative group">
                                        {/* Field Title / Header */}
                                        <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                                                    {field.type}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-800">Field #{idx + 1}</span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                                                <button
                                                    onClick={() => moveField(idx, -1)}
                                                    disabled={idx === 0}
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30 cursor-pointer"
                                                    title="Move Up"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() => moveField(idx, 1)}
                                                    disabled={idx === fields.length - 1}
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30 cursor-pointer"
                                                    title="Move Down"
                                                >
                                                    ▼
                                                </button>
                                                <button
                                                    onClick={() => deleteField(field.id)}
                                                    className="p-1 hover:bg-rose-100 hover:text-rose-600 rounded text-slate-400 ml-1.5 cursor-pointer"
                                                    title="Delete field"
                                                >
                                                    <FiTrash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Field Config inputs */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Field Label</label>
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={(e) => updateFieldProperty(field.id, "label", e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-850 outline-none focus:border-indigo-500 transition-all font-sans"
                                                />
                                            </div>
                                            
                                            {field.type !== "checkbox" && field.type !== "date" && (
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Placeholder</label>
                                                    <input
                                                        type="text"
                                                        value={field.placeholder}
                                                        onChange={(e) => updateFieldProperty(field.id, "placeholder", e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-850 outline-none focus:border-indigo-500 transition-all font-sans"
                                                    />
                                                </div>
                                            )}

                                            {field.type === "dropdown" && (
                                                <div className="md:col-span-2 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Options (Comma separated)</label>
                                                        <span className="text-[8px] text-slate-400 font-semibold">e.g. Option 1, Option 2, Option 3</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter options list..."
                                                        defaultValue={field.options.join(", ")}
                                                        onBlur={(e) => updateDropdownOptions(field.id, e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-850 outline-none focus:border-indigo-500 transition-all font-sans"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Toggle Required */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`req-${field.id}`}
                                                checked={field.required}
                                                onChange={(e) => updateFieldProperty(field.id, "required", e.target.checked)}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <label htmlFor={`req-${field.id}`} className="text-[10px] font-bold text-slate-550 select-none cursor-pointer">
                                                Required field
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50">
                                <FiPlusSquare className="mx-auto text-slate-350 mb-2" size={24} />
                                <p className="text-xs text-slate-450 font-medium">No fields configured yet. Add fields below to build your form layout.</p>
                            </div>
                        )}

                        {/* Add Field Buttons Grid */}
                        <div className="border-t border-slate-100 pt-4">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5 font-display">Add Element</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { type: "text", label: "Text Input" },
                                    { type: "email", label: "Email" },
                                    { type: "phone", label: "Phone" },
                                    { type: "date", label: "Date" },
                                    { type: "dropdown", label: "Dropdown" },
                                    { type: "checkbox", label: "Checkbox" },
                                    { type: "longtext", label: "Long Text" }
                                ].map((elem) => (
                                    <button
                                        key={elem.type}
                                        onClick={() => addField(elem.type)}
                                        className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-150 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                                    >
                                        <FiPlus size={12} />
                                        {elem.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Live Preview */}
                <div className="space-y-4">
                    <div className="sticky top-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block mb-2 font-display">Live Client Preview</span>
                        
                        {/* Device / Console Preview Window (DelegateX Premium Theme Style) */}
                        <div className="bg-white border border-slate-200 rounded-3xl w-full overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                            {/* Device Topbar */}
                            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-slate-500 text-[10px] font-bold select-none">
                                <div className="w-12"></div>
                                <span className="font-display tracking-tight text-slate-500">client-portal.delegatex.com</span>
                                <div>
                                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-[8px] tracking-wider uppercase font-semibold">Live</span>
                                </div>
                            </div>

                            {/* Client Portal Simulation Body */}
                            <div className="p-6 flex-1 space-y-5 overflow-y-auto max-h-[550px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                <div>
                                    <h2 className="text-sm font-bold text-slate-900 font-display tracking-tight">
                                        {templateName || "Untitled Template"}
                                    </h2>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                        {description || "No description configured. Provide a description on the left to help your client fill out this form."}
                                    </p>
                                </div>

                                <div className="space-y-4 pt-2 border-t border-slate-200">
                                    {fields.length > 0 ? (
                                        fields.map((field) => (
                                            <div key={field.id} className="space-y-1.5 text-left">
                                                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 select-none">
                                                    {field.label || "Untitled Field"}
                                                    {field.required && <span className="text-rose-500 font-bold">*</span>}
                                                </label>

                                                {field.type === "text" && (
                                                    <input
                                                        type="text"
                                                        disabled
                                                        placeholder={field.placeholder || "Enter text..."}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 disabled:text-slate-850 disabled:opacity-100 disabled:placeholder-slate-400 cursor-not-allowed outline-none"
                                                    />
                                                )}

                                                {field.type === "email" && (
                                                    <input
                                                        type="email"
                                                        disabled
                                                        placeholder={field.placeholder || "Enter email address..."}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 disabled:text-slate-850 disabled:opacity-100 disabled:placeholder-slate-400 cursor-not-allowed outline-none"
                                                    />
                                                )}

                                                {field.type === "phone" && (
                                                    <input
                                                        type="tel"
                                                        disabled
                                                        placeholder={field.placeholder || "e.g. +1 (555) 000-0000"}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 disabled:text-slate-850 disabled:opacity-100 disabled:placeholder-slate-400 cursor-not-allowed outline-none"
                                                    />
                                                )}

                                                {field.type === "date" && (
                                                    <input
                                                        type="date"
                                                        disabled
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-450 disabled:text-slate-850 disabled:opacity-100 disabled:placeholder-slate-400 cursor-not-allowed outline-none"
                                                    />
                                                )}

                                                {field.type === "longtext" && (
                                                    <textarea
                                                        disabled
                                                        placeholder={field.placeholder || "Enter description..."}
                                                        rows={3}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 disabled:text-slate-850 disabled:opacity-100 disabled:placeholder-slate-400 cursor-not-allowed outline-none resize-none"
                                                    />
                                                )}

                                                {field.type === "dropdown" && (
                                                    <div className="relative">
                                                        <select
                                                            disabled
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 disabled:text-slate-850 disabled:opacity-100 disabled:placeholder-slate-400 cursor-not-allowed outline-none appearance-none"
                                                        >
                                                            <option>{field.placeholder || "Select option..."}</option>
                                                            {field.options && field.options.map((opt, oIdx) => (
                                                                <option key={oIdx}>{opt}</option>
                                                            ))}
                                                        </select>
                                                        <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-500">
                                                            <FiChevronDown size={14} />
                                                        </span>
                                                    </div>
                                                )}

                                                {field.type === "checkbox" && (
                                                    <div className="flex items-center gap-2.5 py-1 select-none">
                                                        <input
                                                            type="checkbox"
                                                            disabled
                                                            className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-indigo-600 cursor-not-allowed"
                                                        />
                                                        <span className="text-[11px] text-slate-650">{field.label || "Check this option"}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                                            No fields configured. Add elements to preview layout.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button Preview */}
                            <div className="p-5 border-t border-slate-200 bg-slate-50 mt-auto">
                                <button
                                    disabled
                                    className="w-full bg-indigo-800 text-white py-2.5 rounded-xl text-xs font-semibold opacity-70 cursor-not-allowed"
                                >
                                    Submit Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
