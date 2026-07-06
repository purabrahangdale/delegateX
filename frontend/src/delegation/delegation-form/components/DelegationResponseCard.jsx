import React from "react";
import { FiDownload, FiPrinter, FiEye, FiFileText, FiCalendar } from "react-icons/fi";
import { downloadPDF, printPDF } from "../utils/pdfGenerator";
import { formatTimestamp } from "../utils/formHelpers";

export default function DelegationResponseCard({ response, onViewPDF }) {
    // Attempt to guess client name/email from answers
    const findValueByKeywords = (keywords) => {
        if (!response.answers) return null;
        for (const [key, value] of Object.entries(response.answers)) {
            // Find in field configurations or keys
            const keyLower = key.toLowerCase();
            if (keywords.some(kw => keyLower.includes(kw))) {
                return value;
            }
        }
        return null;
    };

    const clientName = findValueByKeywords(["name", "firstname", "lastname", "client"]) || "Anonymous";
    const clientEmail = findValueByKeywords(["email", "mail"]) || "N/A";

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition duration-300 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                            Submission
                        </span>
                        <h4 className="text-xs font-bold text-[#111827] font-display tracking-tight mt-1 line-clamp-1">
                            {response.formTitle || "Delegation Response"}
                        </h4>
                    </div>
                    <FiFileText size={16} className="text-slate-400 shrink-0 mt-1" />
                </div>

                {/* Details */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#4B5563]">Client Name:</span>
                        <span className="font-semibold text-[#111827]">{clientName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#4B5563]">Email:</span>
                        <span className="font-semibold text-[#111827] truncate max-w-[150px]">{clientEmail}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#6B7280] pt-1">
                        <span className="flex items-center gap-1">
                            <FiCalendar size={11} />
                            Submitted:
                        </span>
                        <span className="font-medium text-[#111827]">{formatTimestamp(response.timestamp)}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                <button
                    onClick={() => onViewPDF && onViewPDF(response)}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer"
                    title="View PDF"
                >
                    <FiEye size={12} />
                    View
                </button>
                <button
                    onClick={() => downloadPDF(response.pdfPath, `response_${response.id}.pdf`)}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer"
                    title="Download PDF"
                    disabled={!response.pdfPath}
                >
                    <FiDownload size={12} />
                    Get
                </button>
                <button
                    onClick={() => printPDF(response.pdfPath)}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer"
                    title="Print PDF"
                    disabled={!response.pdfPath}
                >
                    <FiPrinter size={12} />
                    Print
                </button>
            </div>
        </div>
    );
}
