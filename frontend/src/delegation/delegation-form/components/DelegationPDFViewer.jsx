import React from "react";
import { FiX, FiDownload, FiPrinter } from "react-icons/fi";
import { downloadPDF, printPDF } from "../utils/pdfGenerator";

export default function DelegationPDFViewer({ response, onClose }) {
    if (!response) return null;

    const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com";
    const fullUrl = response.pdfPath ? (response.pdfPath.startsWith("http") ? response.pdfPath : `${API_BASE_URL}${response.pdfPath}`) : "";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center select-none">
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">PDF Response Document</span>
                        <h3 className="text-xs font-bold text-slate-950 font-display">{response.formTitle}</h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => downloadPDF(response.pdfPath, `response_${response.id}.pdf`)}
                            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer"
                            title="Download PDF"
                        >
                            <FiDownload size={14} />
                        </button>
                        <button
                            onClick={() => printPDF(response.pdfPath)}
                            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer"
                            title="Print PDF"
                        >
                            <FiPrinter size={14} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer ml-2"
                            title="Close"
                        >
                            <FiX size={14} />
                        </button>
                    </div>
                </div>

                {/* PDF content Frame */}
                <div className="flex-1 bg-slate-100 p-4">
                    {fullUrl ? (
                        <iframe
                            src={fullUrl}
                            className="w-full h-full rounded-2xl border border-slate-200"
                            title="Response PDF Viewer"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                            No PDF path configured for this submission.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
