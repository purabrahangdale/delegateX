import React from "react";
import DelegationFieldRenderer from "./DelegationFieldRenderer";

export default function DelegationLivePreview({ title, description, fields }) {
    const hasFields = fields && fields.length > 0;

    return (
        <div className="space-y-3">
            {/* Section label */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display">
                    Live Client Preview
                </span>
                {hasFields && (
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                        {fields.length} {fields.length === 1 ? "field" : "fields"}
                    </span>
                )}
            </div>

            {/* Preview card */}
            <div className="bg-white border border-slate-200 rounded-3xl w-full overflow-hidden shadow-xl flex flex-col min-h-[480px]">

                {/* Simulated browser / portal topbar */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between select-none">
                    {/* Traffic lights */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                    </div>

                    {/* URL bar */}
                    <div className="flex-1 mx-3 bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-[9px] text-slate-400 font-mono truncate">
                            delegatex.com/delegation/form/{title ? title.toLowerCase().replace(/\s+/g, "-").substring(0, 20) : "..."}
                        </span>
                    </div>

                    {/* Live badge */}
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-[8px] tracking-wider uppercase font-bold shrink-0">
                        Live
                    </span>
                </div>

                {/* DelegateX branding inside portal */}
                <div className="px-5 py-3 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[9px]">
                            D
                        </div>
                        <span className="text-white text-[10px] font-bold font-display tracking-tight">DelegateX</span>
                        <span className="text-slate-600 text-[8px] font-semibold uppercase tracking-wider">Client Portal</span>
                    </div>
                    <span className="bg-emerald-950/60 border border-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded text-[7px] tracking-wider uppercase font-semibold">
                        Secure
                    </span>
                </div>

                {/* Form body */}
                <div className="p-5 flex-1 space-y-4 overflow-y-auto max-h-[460px]">
                    {/* Title + description */}
                    <div className="space-y-1 pb-3 border-b border-slate-100">
                        <h2 className="text-sm font-bold text-slate-900 font-display tracking-tight">
                            {title || <span className="text-slate-300 italic font-normal">Untitled Form</span>}
                        </h2>
                        {description && (
                            <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>
                        )}
                    </div>

                    {/* Fields */}
                    <div className="space-y-4">
                        {hasFields ? (
                            fields.map((field, idx) => (
                                <DelegationFieldRenderer
                                    key={field.id || idx}
                                    field={field}
                                    disabled={true}
                                    light={true}
                                />
                            ))
                        ) : (
                            <div className="text-center py-10 text-slate-300 text-xs border border-dashed border-slate-200 rounded-2xl select-none">
                                <p className="text-[10px] text-slate-400 font-medium">
                                    Add fields on the left to preview your form
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit button preview */}
                <div className="p-5 border-t border-slate-200 bg-slate-50">
                    <button
                        disabled
                        className="w-full bg-indigo-600/75 text-white py-2.5 rounded-xl text-xs font-semibold cursor-not-allowed select-none"
                    >
                        Submit Details
                    </button>
                </div>
            </div>
        </div>
    );
}
