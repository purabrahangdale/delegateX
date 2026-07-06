import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    FiInbox, FiChevronRight, FiArrowLeft, FiFilter,
    FiDownload, FiFileText, FiRefreshCw
} from "react-icons/fi";
import { getResponses, getForms } from "../api/delegationFormApi";
import { useToast } from "../../../context/ToastContext";
import DelegationResponseCard from "../components/DelegationResponseCard";
import DelegationPDFViewer from "../components/DelegationPDFViewer";

export default function DelegationResponsesPage() {
    const { showToast } = useToast();
    const [responses, setResponses] = useState([]);
    const [forms, setForms] = useState([]);
    const [selectedFormId, setSelectedFormId] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedResponse, setSelectedResponse] = useState(null);

    useEffect(() => {
        loadData();
    }, [selectedFormId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [respRes, formsRes] = await Promise.all([
                getResponses(selectedFormId),
                getForms()
            ]);
            const respData = respRes.data && respRes.data.success !== undefined ? (respRes.data.success ? respRes.data.data : []) : respRes.data;
            const formsData = formsRes.data && formsRes.data.success !== undefined ? (formsRes.data.success ? formsRes.data.data : []) : formsRes.data;
            setResponses(Array.isArray(respData) ? respData : []);
            setForms(Array.isArray(formsData) ? formsData : []);
        } catch (e) {
            console.error("Failed to load responses data:", e);
            showToast("Failed to fetch response submissions.", "error");
            setResponses([]);
            setForms([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 mt-2">
            {/* ── Header ────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span>Workspace</span>
                        <FiChevronRight size={12} className="text-slate-700" />
                        <span>Delegation</span>
                        <FiChevronRight size={12} className="text-slate-700" />
                        <Link to="/delegation/delegation-form" className="hover:text-slate-350 transition">Forms</Link>
                        <FiChevronRight size={12} className="text-slate-700" />
                        <span className="text-slate-900 font-bold">Responses</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 font-display mt-2">
                        Client Responses
                        {!loading && responses.length > 0 && (
                            <span className="ml-3 text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full align-middle">
                                {responses.length} total
                            </span>
                        )}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* Form filter */}
                    <div className="relative flex items-center bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 gap-2 select-none">
                        <FiFilter size={13} className="text-slate-500" />
                        <select
                            value={selectedFormId}
                            onChange={(e) => setSelectedFormId(e.target.value)}
                            className="bg-transparent text-xs text-slate-300 font-semibold outline-none cursor-pointer appearance-none pr-5"
                        >
                            <option value="" className="bg-slate-950 text-white">All Forms</option>
                            {forms.map(form => (
                                <option key={form.id} value={form.id} className="bg-slate-950 text-white">
                                    {form.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={loadData}
                        className="p-2 text-slate-500 hover:text-white bg-slate-950 border border-slate-900 rounded-xl transition cursor-pointer"
                        title="Refresh"
                    >
                        <FiRefreshCw size={14} />
                    </button>

                    <Link
                        to="/delegation/delegation-form"
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-xl text-xs font-semibold transition"
                    >
                        <FiArrowLeft size={13} />
                        Back to Forms
                    </Link>
                </div>
            </div>

            {/* ── Content ───────────────────────────────── */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse space-y-3">
                            <div className="h-5 w-20 rounded bg-slate-100" />
                            <div className="h-4 bg-slate-100 rounded w-3/4" />
                            <div className="h-3 bg-slate-100 rounded w-full" />
                            <div className="h-3 bg-slate-100 rounded w-1/2" />
                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <div className="h-7 flex-1 bg-slate-100 rounded-xl" />
                                <div className="h-7 flex-1 bg-slate-100 rounded-xl" />
                                <div className="h-7 flex-1 bg-slate-100 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : responses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {responses.map((response) => (
                        <DelegationResponseCard
                            key={response.id}
                            response={response}
                            onViewPDF={(resp) => setSelectedResponse(resp)}
                        />
                    ))}
                </div>
            ) : (
                <div className="border border-dashed border-slate-800 rounded-3xl p-16 text-center bg-slate-950/30 max-w-xl mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-4">
                        <FiInbox size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight font-display">
                        No Submissions Found
                    </h3>
                    <p className="text-slate-500 text-xs mt-2 leading-relaxed max-w-xs mx-auto">
                        There are no client answers submitted yet for {selectedFormId ? "this form" : "any of your delegation forms"}.
                        Share a public form link to start collecting responses.
                    </p>
                    <Link
                        to="/delegation/delegation-form"
                        className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-5 py-2.5 rounded-xl text-xs font-semibold mt-5 transition"
                    >
                        <FiFileText size={13} />
                        Go to Forms
                    </Link>
                </div>
            )}

            {/* ── PDF Lightbox ──────────────────────────── */}
            {selectedResponse && (
                <DelegationPDFViewer
                    response={selectedResponse}
                    onClose={() => setSelectedResponse(null)}
                />
            )}
        </div>
    );
}
