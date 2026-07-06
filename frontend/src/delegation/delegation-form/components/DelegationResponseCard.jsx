import React from "react";
import { FiDownload, FiPrinter, FiEye, FiFileText, FiCalendar, FiUser, FiMail } from "react-icons/fi";
import { downloadPDF, printPDF } from "../utils/pdfGenerator";
import { formatTimestamp } from "../utils/formHelpers";

export default function DelegationResponseCard({ response, onViewPDF }) {
    // Guess client details from answers using keyword matching
    const findByKeywords = (keywords) => {
        if (!response.answers) return null;
        for (const [key, value] of Object.entries(response.answers)) {
            if (keywords.some(kw => key.toLowerCase().includes(kw))) {
                return value;
            }
        }
        return null;
    };

    const clientName  = findByKeywords(["name", "firstname", "lastname", "client", "fullname"]) || "Anonymous";
    const clientEmail = findByKeywords(["email", "mail"]) || "—";
    const hasPDF      = !!response.pdfPath;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition duration-300 flex flex-col group">

            {/* Colour accent stripe */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />

            <div className="p-5 flex flex-col flex-1 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                            Submission
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 font-display tracking-tight mt-1 line-clamp-1">
                            {response.formTitle || "Delegation Response"}
                        </h4>
                    </div>
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${hasPDF ? "bg-emerald-50 border border-emerald-100 text-emerald-600" : "bg-slate-50 border border-slate-200 text-slate-400"}`}>
                        <FiFileText size={13} />
                    </div>
                </div>

                {/* Client details */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[11px]">
                        <FiUser size={11} className="text-slate-400 shrink-0" />
                        <span className="text-slate-500 w-16">Name:</span>
                        <span className="font-semibold text-slate-800 truncate">{clientName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                        <FiMail size={11} className="text-slate-400 shrink-0" />
                        <span className="text-slate-500 w-16">Email:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[130px]">{clientEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                        <FiCalendar size={10} className="shrink-0" />
                        <span>{formatTimestamp(response.timestamp)}</span>
                    </div>
                </div>

                {/* PDF status badge */}
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${hasPDF ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span className={`text-[10px] font-semibold ${hasPDF ? "text-emerald-600" : "text-amber-600"}`}>
                        {hasPDF ? "PDF Generated" : "PDF Pending"}
                    </span>
                </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-1.5 p-4 pt-0 border-t border-slate-100">
                <button
                    onClick={() => onViewPDF && onViewPDF(response)}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer"
                    title="View PDF"
                    disabled={!hasPDF}
                >
                    <FiEye size={11} />
                    View
                </button>
                <button
                    onClick={() => downloadPDF(response.pdfPath, `response_${response.id}.pdf`)}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Download PDF"
                    disabled={!hasPDF}
                >
                    <FiDownload size={11} />
                    Get
                </button>
                <button
                    onClick={() => printPDF(response.pdfPath)}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Print PDF"
                    disabled={!hasPDF}
                >
                    <FiPrinter size={11} />
                    Print
                </button>
            </div>
        </div>
    );
}
