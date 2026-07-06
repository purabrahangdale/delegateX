import React from "react";
import { FiChevronDown } from "react-icons/fi";
import DelegationFieldRenderer from "./DelegationFieldRenderer";

export default function DelegationLivePreview({ title, description, fields }) {
    return (
        <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-450 block mb-2 font-display">Live Client Preview</span>
            
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
                            {title || "Untitled Delegation Form"}
                        </h2>
                        {description && (
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                {description}
                            </p>
                        )}
                    </div>

                    <div className="space-y-4 pt-2 border-t border-slate-200">
                        {fields && fields.length > 0 ? (
                            fields.map((field, idx) => (
                                <DelegationFieldRenderer
                                    key={field.id || idx}
                                    field={field}
                                    disabled={true}
                                    light={true}
                                />
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
                        className="w-full bg-indigo-600/90 text-white py-2.5 rounded-xl text-xs font-semibold opacity-70 cursor-not-allowed"
                    >
                        Submit Details
                    </button>
                </div>
            </div>
        </div>
    );
}
