import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    FiPlus, FiCopy, FiCheck, FiArrowRight, FiFileText,
    FiInbox, FiExternalLink, FiTrash2, FiGrid, FiList,
    FiShare2, FiEdit3, FiZap
} from "react-icons/fi";
import { getForms, saveForm } from "../api/delegationFormApi";
import { useToast } from "../../../context/ToastContext";
import { formatTimestamp } from "../utils/formHelpers";

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com";

export default function DelegationFormsPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState("");

    useEffect(() => {
        loadForms();
    }, []);

    const loadForms = async () => {
        setLoading(true);
        try {
            const res = await getForms();
            const data = res.data && res.data.success !== undefined ? (res.data.success ? res.data.data : []) : res.data;
            setForms(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to load forms:", e);
            showToast("Failed to fetch delegation forms.", "error");
            setForms([]);
        } finally {
            setLoading(false);
        }
    };

    const copyShareLink = (id) => {
        const publicUrl = `${window.location.origin}/delegation/form/${id}`;
        navigator.clipboard.writeText(publicUrl);
        setCopiedId(id);
        showToast("Public shareable link copied!");
        setTimeout(() => setCopiedId(""), 2000);
    };

    return (
        <div className="space-y-8 mt-2">
            {/* ── Header ────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 font-display">
                        Delegation Forms
                    </h1>
                    <p className="text-slate-500 text-xs mt-0.5">
                        Build intake forms, share shareable links, and auto-generate professional PDFs.
                    </p>
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
                        New Form
                    </Link>
                </div>
            </div>

            {/* ── Stats Strip ───────────────────────────── */}
            {!loading && forms.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Total Forms", value: forms.length, icon: FiFileText, color: "indigo" },
                        { label: "Total Fields", value: forms.reduce((s, f) => s + (f.fields?.length || 0), 0), icon: FiGrid, color: "violet" },
                        { label: "Active Links", value: forms.length, icon: FiZap, color: "emerald" },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${stat.color === "indigo" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                                    stat.color === "violet" ? "bg-purple-50 text-purple-600 border border-purple-100" :
                                        "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                }`}>
                                <stat.icon size={15} />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-slate-900 font-display leading-none">{stat.value}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Content ───────────────────────────────── */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse space-y-3">
                            <div className="h-8 w-8 rounded-xl bg-slate-100" />
                            <div className="h-4 bg-slate-100 rounded w-3/4" />
                            <div className="h-3 bg-slate-100 rounded w-full" />
                            <div className="h-3 bg-slate-100 rounded w-2/3" />
                        </div>
                    ))}
                </div>
            ) : forms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {forms.map((form) => (
                        <div
                            key={form.id}
                            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition duration-300 flex flex-col justify-between group"
                        >
                            <div className="space-y-3">
                                {/* Card header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
                                        <FiFileText size={17} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
                                            {form.fields?.length || 0} fields
                                        </span>
                                    </div>
                                </div>

                                {/* Title & description */}
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-slate-900 tracking-tight line-clamp-1 font-display">
                                        {form.title}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                        {form.description || "No description provided."}
                                    </p>
                                </div>

                                {/* Created date */}
                                <div className="text-[9px] text-slate-400 pt-2 border-t border-slate-100">
                                    Created: {formatTimestamp(form.createdAt)}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100">
                                <button
                                    onClick={() => copyShareLink(form.id)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-indigo-600 transition cursor-pointer"
                                    title="Copy Share Link"
                                >
                                    {copiedId === form.id
                                        ? <FiCheck size={12} className="text-emerald-500" />
                                        : <FiShare2 size={12} />
                                    }
                                    {copiedId === form.id ? "Copied!" : "Share"}
                                </button>

                                <div className="flex gap-1.5">
                                    <a
                                        href={`/delegation/form/${form.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                                        title="Open Public Form"
                                    >
                                        <FiExternalLink size={12} />
                                    </a>
                                    <Link
                                        to={`/delegation/forms/edit/${form.id}`}
                                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold py-1.5 px-3 rounded-xl transition"
                                    >
                                        <FiEdit3 size={10} />
                                        Edit
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Empty state */
                <div className="border border-dashed border-slate-800 rounded-3xl p-16 text-center bg-slate-950/30 max-w-xl mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4">
                        <FiFileText size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight font-display">
                        No Delegation Forms Yet
                    </h3>
                    <p className="text-slate-500 text-xs mt-2 leading-relaxed max-w-xs mx-auto">
                        Design a custom client-facing intake form. Automatically save responses in MongoDB and generate professional PDFs instantly.
                    </p>
                    <Link
                        to="/delegation/delegation-form/create"
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold mt-6 shadow-lg shadow-indigo-600/10 transition"
                    >
                        <FiPlus size={13} />
                        Create First Form
                    </Link>
                </div>
            )}
        </div>
    );
}
