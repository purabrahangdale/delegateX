import { useState, useRef, useEffect } from "react";
import { processWhatsAppAiAssistant } from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import {
    FiZap, FiCheck, FiX, FiChevronDown, FiGlobe, FiCheckCircle,
    FiAlertCircle, FiEdit3, FiRefreshCw, FiScissors, FiMaximize2,
    FiSmile, FiBriefcase, FiCheckSquare, FiShield
} from "react-icons/fi";

const LANGUAGES = [
    "English",
    "Hindi",
    "Marathi",
    "Spanish",
    "French",
    "German",
    "Arabic",
    "Japanese",
    "Chinese",
];

const AI_ACTIONS = [
    { id: "fix_grammar", label: "Fix Grammar", icon: FiCheckCircle, desc: "Correct spelling, punctuation & capitalization" },
    { id: "rewrite", label: "Rewrite Professionally", icon: FiBriefcase, desc: "Improve tone, clarity & corporate language" },
    { id: "friendly", label: "Make Friendly", icon: FiSmile, desc: "Warm, conversational & engaging tone" },
    { id: "formal", label: "Make Formal", icon: FiCheckSquare, desc: "Respectful executive business tone" },
    { id: "shorten", label: "Shorten Message", icon: FiScissors, desc: "Concise & direct without losing key details" },
    { id: "expand", label: "Expand Message", icon: FiMaximize2, desc: "Elaborate with professional call-to-action" },
    { id: "translate", label: "Translate", icon: FiGlobe, desc: "Translate text preserving {{placeholders}}", isSubmenu: true },
    { id: "validate_variables", label: "Validate Variables", icon: FiEdit3, desc: "Check broken {{braces}} & missing variables" },
    { id: "compliance_check", label: "WhatsApp Compliance Check", icon: FiShield, desc: "Check Meta WhatsApp template guidelines" },
];

function WhatsAppAiAssistant({ content, onApplySuggestion }) {
    const { showToast } = useToast();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null); // { action, original_content, suggested_content, changes_made, warnings }
    const [editedSuggestedText, setEditedSuggestedText] = useState("");
    const [isEditingManually, setIsEditingManually] = useState(false);
    const dropdownRef = useRef(null);

    // Handle click outside dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
                setShowLangMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleRunAction = async (actionId, targetLang = null) => {
        if (!content || !content.trim()) {
            showToast("Please enter message content in the editor before using AI Assistant", "warning");
            setDropdownOpen(false);
            return;
        }

        setLoading(true);
        setDropdownOpen(false);
        setShowLangMenu(false);
        setAiResult(null);

        try {
            const data = await processWhatsAppAiAssistant({
                action: actionId,
                content: content.trim(),
                target_language: targetLang,
            });

            if (data && data.status === "success") {
                setAiResult(data);
                setEditedSuggestedText(data.suggested_content);
                setIsEditingManually(false);
                showToast("AI Assistant completed request successfully", "success");
            } else {
                showToast("AI processing failed. Please try again.", "error");
            }
        } catch (err) {
            console.error("AI Assistant request error:", err);
            showToast("AI Assistant request failed. Please check internet connection.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = () => {
        if (!editedSuggestedText) return;
        onApplySuggestion(editedSuggestedText);
        setAiResult(null);
        showToast("Accepted AI suggestions and updated editor content", "success");
    };

    const handleReject = () => {
        setAiResult(null);
        showToast("Discarded AI suggestions", "info");
    };

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-white shadow-md shadow-amber-500/20">
                        <FiZap size={16} />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                            ✨ AI Writing Assistant
                            <span className="text-[9px] font-extrabold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Gemini 2.5
                            </span>
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Improve grammar, rewrite professionally, optimize tone, and validate your WhatsApp template using AI.
                        </p>
                    </div>
                </div>

                {/* Primary AI Dropdown Button */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                            setDropdownOpen(!dropdownOpen);
                            setShowLangMenu(false);
                        }}
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-amber-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                        {loading ? (
                            <FiRefreshCw size={14} className="animate-spin" />
                        ) : (
                            <FiZap size={14} />
                        )}
                        <span>✨ AI Assistant</span>
                        <FiChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Actions Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 z-30 space-y-1 font-sans animate-in fade-in zoom-in-95 duration-150">
                            {!showLangMenu ? (
                                AI_ACTIONS.map((item) => {
                                    const Icon = item.icon;
                                    if (item.isSubmenu) {
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setShowLangMenu(true)}
                                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-amber-50/70 hover:text-amber-900 transition cursor-pointer group"
                                            >
                                                <div className="flex items-start gap-2.5">
                                                    <Icon size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-800 group-hover:text-amber-900">{item.label}</p>
                                                        <p className="text-[10px] text-slate-400">{item.desc}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">▶</span>
                                            </button>
                                        );
                                    }
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleRunAction(item.id)}
                                            className="w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left hover:bg-slate-50 transition cursor-pointer group"
                                        >
                                            <Icon size={14} className="text-slate-400 group-hover:text-amber-500 mt-0.5 shrink-0 transition" />
                                            <div>
                                                <p className="text-xs font-semibold text-slate-800 group-hover:text-amber-600 transition">{item.label}</p>
                                                <p className="text-[10px] text-slate-400">{item.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                /* Language Submenu */
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between p-2 border-b border-slate-100 mb-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Select Target Language</span>
                                        <button type="button" onClick={() => setShowLangMenu(false)} className="text-[10px] text-amber-600 font-bold hover:underline">
                                            ← Back
                                        </button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                                        {LANGUAGES.map((lang) => (
                                            <button
                                                key={lang}
                                                type="button"
                                                onClick={() => handleRunAction("translate", lang)}
                                                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition cursor-pointer"
                                            >
                                                🌐 {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Loading State Banner */}
            {loading && (
                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-center gap-3 text-amber-800 animate-pulse">
                    <FiRefreshCw size={16} className="animate-spin text-amber-600" />
                    <span className="text-xs font-bold font-display">✨ AI is improving your template...</span>
                </div>
            )}

            {/* AI Response Panel */}
            {aiResult && !loading && (
                <div className="border border-emerald-200 rounded-2xl p-5 bg-gradient-to-b from-emerald-50/50 to-white shadow-xs space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-emerald-500 text-white">
                                <FiCheckCircle size={14} />
                            </span>
                            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider font-display">
                                AI Suggestion ({aiResult.action?.replace("_", " ").toUpperCase()})
                            </h4>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Placeholder Protected
                        </span>
                    </div>

                    {/* Original vs Suggested Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Original Message */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Original Message
                            </span>
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto">
                                <p className="text-xs text-slate-600 leading-relaxed font-mono whitespace-pre-wrap">
                                    {aiResult.original_content}
                                </p>
                            </div>
                        </div>

                        {/* Suggested Message */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                                    Suggested Message
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingManually(!isEditingManually)}
                                    className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                                >
                                    <FiEdit3 size={10} />
                                    {isEditingManually ? "Lock Editing" : "Edit Manually"}
                                </button>
                            </div>

                            {isEditingManually ? (
                                <textarea
                                    value={editedSuggestedText}
                                    onChange={(e) => setEditedSuggestedText(e.target.value)}
                                    rows={5}
                                    className="w-full p-3 text-xs font-mono bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            ) : (
                                <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl max-h-40 overflow-y-auto">
                                    <p className="text-xs text-emerald-950 font-medium leading-relaxed font-mono whitespace-pre-wrap">
                                        {editedSuggestedText}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Changes Made & Warnings */}
                    {(aiResult.changes_made?.length > 0 || aiResult.warnings?.length > 0) && (
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                            {aiResult.changes_made?.length > 0 && (
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        Changes Made by AI:
                                    </span>
                                    <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
                                        {aiResult.changes_made.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {aiResult.warnings?.length > 0 && (
                                <div className="pt-2 border-t border-slate-200/60 text-amber-700">
                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <FiAlertCircle size={12} /> Compliance & Variable Warnings:
                                    </span>
                                    <ul className="list-disc list-inside text-[11px] space-y-0.5">
                                        {aiResult.warnings.map((warn, idx) => (
                                            <li key={idx}>{warn}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Review Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-emerald-100">
                        <button
                            type="button"
                            onClick={handleReject}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            onClick={handleAccept}
                            className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition cursor-pointer"
                        >
                            <FiCheck size={14} /> Accept Changes
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppAiAssistant;
