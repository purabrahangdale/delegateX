import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiInbox, FiChevronRight, FiArrowLeft, FiFilter } from "react-icons/fi";
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
            setResponses(respRes.data || []);
            setForms(formsRes.data || []);
        } catch (e) {
            console.error("Failed to load responses data:", e);
            showToast("Failed to fetch response submissions.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 mt-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span>Workspace</span>
                        <FiChevronRight size={12} className="text-slate-700" />
                        <span>Delegation</span>
                        <FiChevronRight size={12} className="text-slate-700" />
                        <Link to="/delegation/delegation-form" className="hover:text-slate-300 transition">Forms</Link>
                        <FiChevronRight size={12} className="text-slate-700" />
                        <span className="text-white font-bold">Responses</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-white font-display mt-2">Client Responses</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex items-center bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 gap-2 select-none">
                        <FiFilter size={13} className="text-slate-500" />
                        <select
                            value={selectedFormId}
                            onChange={(e) => setSelectedFormId(e.target.value)}
                            className="bg-transparent text-xs text-slate-300 font-semibold outline-none cursor-pointer appearance-none pr-6"
                        >
                            <option value="" className="bg-slate-950 text-white">All Forms</option>
                            {forms.map(form => (
                                <option key={form.id} value={form.id} className="bg-slate-950 text-white">
                                    {form.title}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Link
                        to="/delegation/delegation-form"
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-xl text-xs font-semibold transition"
                    >
                        <FiArrowLeft size={13} />
                        Back to Forms
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-500 text-xs">
                    Loading response records...
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
                <div className="border border-dashed border-slate-800 rounded-3xl p-16 text-center bg-slate-950/20 max-w-xl mx-auto">
                    <FiInbox size={32} className="mx-auto text-slate-650 mb-3" />
                    <h3 className="text-sm font-bold text-white tracking-tight">No Submissions Found</h3>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        There are no client answers submitted yet for {selectedFormId ? "this form" : "any of your delegation forms"}.
                    </p>
                </div>
            )}

            {/* Light Box PDF Viewer Modal */}
            {selectedResponse && (
                <DelegationPDFViewer
                    response={selectedResponse}
                    onClose={() => setSelectedResponse(null)}
                />
            )}
        </div>
    );
}
