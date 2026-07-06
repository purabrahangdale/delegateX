import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiPlus, FiCopy, FiCheck, FiArrowRight, FiFileText, FiInbox, FiExternalLink } from "react-icons/fi";
import { getForms } from "../api/delegationFormApi";
import { useToast } from "../../../context/ToastContext";
import { formatTimestamp } from "../utils/formHelpers";

export default function DelegationFormsPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState("");

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const res = await getForms();
            setForms(res.data || []);
        } catch (e) {
            console.error("Failed to load forms:", e);
            showToast("Failed to fetch delegation forms.", "error");
        } finally {
            setLoading(false);
        }
    };

    const copyShareLink = (id) => {
        const publicUrl = `${window.location.origin}/delegation/form/${id}`;
        navigator.clipboard.writeText(publicUrl);
        setCopiedId(id);
        showToast("Public shareable link copied to clipboard!");
        setTimeout(() => setCopiedId(""), 2000);
    };

    return (
        <div className="space-y-8 mt-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white font-display">Delegation Forms</h1>
                    <p className="text-slate-500 text-xs mt-0.5">Build onboarding schemas, share links, and download generated reportlab PDFs.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/delegation/delegation-form/responses"
                        className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl transition"
                    >
                        View Responses
                    </Link>
                    <Link
                        to="/delegation/delegation-form/create"
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <FiPlus size={14} />
                        New Delegation Form
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-500 text-xs">
                    Loading templates...
                </div>
            ) : forms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {forms.map((form) => (
                        <div
                            key={form.id}
                            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:border-slate-350 transition duration-300 flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
                                        <FiFileText size={18} />
                                    </div>
                                    <span className="text-[9px] text-indigo-750 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
                                        {form.fields ? form.fields.length : 0} fields
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-[#111827] tracking-tight line-clamp-1">{form.title}</h3>
                                    <p className="text-[11px] text-[#6B7280] line-clamp-2 leading-relaxed">{form.description || "No description provided."}</p>
                                </div>
                                <div className="text-[9px] text-[#4B5563] pt-2 border-t border-[#E5E7EB]">
                                    Created: {formatTimestamp(form.createdAt)}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-[#E5E7EB]">
                                <button
                                    onClick={() => copyShareLink(form.id)}
                                    className="flex items-center gap-1 text-[10px] font-bold text-[#111827] hover:text-indigo-600 transition cursor-pointer"
                                    title="Copy Link"
                                >
                                    {copiedId === form.id ? <FiCheck size={12} className="text-emerald-500" /> : <FiCopy size={12} />}
                                    Share
                                </button>
                                <div className="flex gap-2">
                                    <a
                                        href={`/delegation/form/${form.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-[10px] text-[#111827] hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center"
                                        title="View Public Form"
                                    >
                                        <FiExternalLink size={12} />
                                    </a>
                                    <Link
                                        to={`/delegation/forms/edit/${form.id}`}
                                        className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-[10px] font-semibold py-1.5 px-3 rounded-xl transition"
                                    >
                                        Edit
                                        <FiArrowRight size={10} className="text-slate-900" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="border border-dashed border-slate-800 rounded-3xl p-16 text-center bg-slate-950/20 max-w-xl mx-auto">
                    <FiInbox size={32} className="mx-auto text-slate-650 mb-3" />
                    <h3 className="text-sm font-bold text-white tracking-tight">No Delegation Forms Created</h3>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Design a custom client-facing intake schema, automatically save responses in MongoDB, and download instantly compiled PDFs.
                    </p>
                    <Link
                        to="/delegation/delegation-form/create"
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold mt-5 shadow-lg shadow-indigo-600/10 transition"
                    >
                        <FiPlus size={13} />
                        Get Started
                    </Link>
                </div>
            )}
        </div>
    );
}
