import React from "react";
import { FiPlus, FiTrash2, FiPlusSquare } from "react-icons/fi";
import { generateUniqueId } from "../utils/formHelpers";

export default function DelegationFormBuilder({ title, setTitle, description, setDescription, fields, setFields }) {
    
    const addField = (type) => {
        const newField = {
            id: generateUniqueId(type),
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
        <div className="space-y-6">
            {/* General Settings */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">1. General Information</h3>
                <div className="space-y-3.5">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Form Title</label>
                        <input
                            type="text"
                            placeholder="e.g., Client Assignment Onboarding Form"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
                        <textarea
                            placeholder="Briefly state the goal or guide the client on how to complete this form."
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
                        {fields.length} {fields.length === 1 ? "Field" : "Fields"}
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
                                            type="button"
                                            onClick={() => moveField(idx, -1)}
                                            disabled={idx === 0}
                                            className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30 cursor-pointer"
                                            title="Move Up"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveField(idx, 1)}
                                            disabled={idx === fields.length - 1}
                                            className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30 cursor-pointer"
                                            title="Move Down"
                                        >
                                            ▼
                                        </button>
                                        <button
                                            type="button"
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
                                    
                                    {field.type !== "checkbox" && field.type !== "date" && field.type !== "file" && (
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Placeholder</label>
                                            <input
                                                type="text"
                                                value={field.placeholder || ""}
                                                onChange={(e) => updateFieldProperty(field.id, "placeholder", e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 outline-none focus:border-indigo-500 transition-all font-sans"
                                            />
                                        </div>
                                    )}

                                    {field.type === "dropdown" && (
                                        <div className="md:col-span-2 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Options (Comma separated)</label>
                                                <span className="text-[8px] text-slate-400 font-semibold">e.g. Option 1, Option 2</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Enter options..."
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
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                            { type: "text", label: "Text Input" },
                            { type: "email", label: "Email" },
                            { type: "phone", label: "Phone" },
                            { type: "number", label: "Number" },
                            { type: "date", label: "Date Picker" },
                            { type: "dropdown", label: "Dropdown Select" },
                            { type: "textarea", label: "Text Area" },
                            { type: "checkbox", label: "Checkbox" },
                            { type: "file", label: "File Upload" }
                        ].map((elem) => (
                            <button
                                type="button"
                                key={elem.type}
                                onClick={() => addField(elem.type)}
                                className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-150 py-2 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                            >
                                <FiPlus size={11} />
                                {elem.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
