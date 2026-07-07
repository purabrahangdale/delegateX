import React from "react";
import { FiChevronDown, FiUploadCloud } from "react-icons/fi";

export default function DelegationFieldRenderer({ field, value, onChange, error, disabled = false, light = false }) {
    const handleFileChange = (e) => {
        if (onChange) {
            onChange(e.target.files[0]);
        }
    };

    const inputClass = light 
        ? `w-full bg-slate-50 border ${
            error ? "border-rose-500/80" : "border-slate-200 focus:border-indigo-500"
          } rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-200`
        : `w-full bg-slate-900 border ${
            error ? "border-rose-500/80" : "border-slate-800 focus:border-indigo-500"
          } rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 outline-none transition-all duration-200`;

    return (
        <div className="space-y-1.5 text-left w-full">
            <label className={`text-[11px] font-semibold ${light ? "text-slate-700" : "text-slate-200"} flex items-center gap-1 select-none`}>
                {field.label}
                {field.required && <span className="text-rose-500 font-bold">*</span>}
            </label>

            {field.type === "text" && (
                <input
                    type="text"
                    disabled={disabled}
                    placeholder={field.placeholder || "Enter text..."}
                    value={value || ""}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className={inputClass}
                />
            )}

            {field.type === "email" && (
                <input
                    type="email"
                    disabled={disabled}
                    placeholder={field.placeholder || "Enter email address..."}
                    value={value || ""}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className={inputClass}
                />
            )}

            {field.type === "phone" && (
                <div className="flex gap-2 w-full">
                    <div className={`${
                        light 
                            ? "bg-slate-100 border-slate-200 text-slate-700" 
                            : "bg-slate-950 border-slate-800 text-slate-200"
                        } border rounded-xl py-2.5 px-3.5 text-xs font-semibold flex items-center justify-center select-none min-w-[50px] shrink-0`}
                    >
                        +91
                    </div>
                    <input
                        type="tel"
                        disabled={disabled}
                        placeholder={field.placeholder || "Enter 10-digit number"}
                        value={value || ""}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            if (val.length <= 10 && onChange) {
                                onChange(val);
                            }
                        }}
                        className={inputClass}
                    />
                </div>
            )}

            {field.type === "number" && (
                <input
                    type="number"
                    disabled={disabled}
                    placeholder={field.placeholder || "Enter number..."}
                    value={value || ""}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className={inputClass}
                />
            )}

            {field.type === "date" && (
                <input
                    type="date"
                    disabled={disabled}
                    value={value || ""}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className={inputClass}
                />
            )}

            {field.type === "textarea" && (
                <textarea
                    disabled={disabled}
                    placeholder={field.placeholder || "Enter description..."}
                    rows={3}
                    value={value || ""}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className={`${inputClass} resize-none`}
                />
            )}

            {field.type === "dropdown" && (
                <div className="relative">
                    <select
                        disabled={disabled}
                        value={value || ""}
                        onChange={(e) => onChange && onChange(e.target.value)}
                        className={`${inputClass} appearance-none`}
                    >
                        <option value="">{field.placeholder || "Select option..."}</option>
                        {field.options && field.options.map((opt, oIdx) => (
                            <option key={oIdx} value={opt} className={light ? "bg-white text-slate-800" : "bg-slate-950 text-white"}>{opt}</option>
                        ))}
                    </select>
                    <span className={`absolute inset-y-0 right-3.5 flex items-center pointer-events-none ${light ? "text-slate-400" : "text-slate-500"}`}>
                        <FiChevronDown size={14} />
                    </span>
                </div>
            )}

            {field.type === "checkbox" && (
                <div className="flex items-center gap-2.5 py-1 select-none">
                    <input
                        type="checkbox"
                        disabled={disabled}
                        checked={!!value}
                        onChange={(e) => onChange && onChange(e.target.checked)}
                        className={`w-4 h-4 rounded ${light ? "border-slate-300 bg-slate-50 text-indigo-650" : "border-slate-800 bg-slate-900 text-indigo-500"} cursor-pointer focus:ring-0`}
                    />
                    <span className={`text-[11px] ${light ? "text-slate-600" : "text-slate-350"}`}>{field.placeholder || "Check to confirm"}</span>
                </div>
            )}

            {field.type === "file" && (
                <div className="relative">
                    {disabled ? (
                        <div className={`flex items-center justify-center border border-dashed ${light ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-800 bg-slate-950/40 text-slate-500"} rounded-xl p-4 cursor-not-allowed`}>
                            <FiUploadCloud size={16} className="mr-2" />
                            <span className="text-[10px]">File upload (Disabled in preview)</span>
                        </div>
                    ) : (
                        <label className={`flex items-center justify-center border border-dashed ${light ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-500/50" : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"} rounded-xl p-4 cursor-pointer transition`}>
                            <FiUploadCloud size={16} className={`mr-2 ${light ? "text-indigo-600" : "text-indigo-400"}`} />
                            <span className="text-[10px] font-semibold">
                                {value ? value.name : field.placeholder || "Click to upload file"}
                            </span>
                            <input
                                type="file"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    )}
                </div>
            )}

            {error && <span className="text-[10px] font-medium text-rose-500 block mt-0.5">{error}</span>}
        </div>
    );
}
