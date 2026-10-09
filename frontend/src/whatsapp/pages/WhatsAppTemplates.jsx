import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import WhatsAppTemplateFilter from "../components/WhatsAppTemplateFilter";
import {
    getWhatsAppTemplates,
    getWhatsAppTemplateNames,
    updateWhatsAppTemplate,
    deleteWhatsAppTemplate,
    toggleWhatsAppTemplateFavorite,
    submitWhatsAppTemplate,
    syncTemplatesFromMeta,
    apiErrorMessage,
} from "../services/whatsappApi";
import TemplateStatusBadge from "../components/TemplateStatusBadge";
import { useToast } from "../../context/ToastContext";
import {
    FiPlus, FiTrash2, FiEye, FiToggleLeft, FiToggleRight,
    FiFileText, FiX, FiCheck, FiRotateCcw,
    FiBarChart2, FiHeart, FiUploadCloud, FiRefreshCw, FiAlertTriangle
} from "react-icons/fi";

function WhatsAppTemplates() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [syncing, setSyncing] = useState(false);
    const [submittingId, setSubmittingId] = useState(null);
    const [statusFilter, setStatusFilter] = useState("");
    const [templates, setTemplates] = useState([]);
    const [dbTemplateNames, setDbTemplateNames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [previewTemplate, setPreviewTemplate] = useState(null);

    // Filter states
    const [selectedContentTypes, setSelectedContentTypes] = useState([]);
    const [selectedTemplateNames, setSelectedTemplateNames] = useState([]);
    const [selectedTemplateTypes, setSelectedTemplateTypes] = useState([]);

    const fetchTemplates = async () => {
        try {
            const [data, names] = await Promise.all([
                getWhatsAppTemplates(),
                getWhatsAppTemplateNames(),
            ]);
            setTemplates(data || []);
            setDbTemplateNames(names || []);
        } catch (err) {
            console.error("Failed to load templates", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    // Merge template names dynamically from database and memory
    const availableTemplateNames = useMemo(() => {
        const set = new Set([...dbTemplateNames, ...templates.map((t) => t.name)]);
        return Array.from(set).filter(Boolean).sort();
    }, [dbTemplateNames, templates]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const r = await syncTemplatesFromMeta();
            showToast(`Synced ${r.total_on_meta} template(s) from Meta (${r.created} imported, ${r.updated} updated${r.reset_to_draft ? `, ${r.reset_to_draft} unconfirmed reset to draft` : ""}).`, "success");
            await fetchTemplates();
        } catch (err) {
            showToast(`Sync failed: ${apiErrorMessage(err)}`, "error");
        } finally {
            setSyncing(false);
        }
    };

    const handleSubmit = async (tmpl) => {
        setSubmittingId(tmpl._id);
        try {
            const r = await submitWhatsAppTemplate(tmpl._id);
            showToast(r.message, "success");
        } catch (err) {
            showToast(`Meta submission failed: ${apiErrorMessage(err)}`, "error");
        } finally {
            setSubmittingId(null);
            await fetchTemplates();
        }
    };

    const handleDelete = async (tmpl) => {
        const onMeta = tmpl.meta_template_id && tmpl.status !== "DELETED";
        if (!confirm(onMeta
            ? `Delete "${tmpl.name}" here AND from your WhatsApp Business Account on Meta? This cannot be undone. Past campaigns keep their history.`
            : `Delete "${tmpl.name}"?`)) return;
        try {
            await deleteWhatsAppTemplate(tmpl._id);
            await fetchTemplates();
        } catch (err) {
            showToast(`Delete failed: ${apiErrorMessage(err)}`, "error");
        }
    };

    const handleToggle = async (tmpl) => {
        try {
            await updateWhatsAppTemplate(tmpl._id, { is_active: !tmpl.is_active });
            await fetchTemplates();
        } catch (err) {
            console.error("Toggle error:", err);
        }
    };

    const handleFavorite = async (e, tmplId) => {
        e.stopPropagation();
        try {
            await toggleWhatsAppTemplateFavorite(tmplId);
            await fetchTemplates();
        } catch (err) {
            console.error("Favorite error:", err);
        }
    };

    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedContentTypes([]);
        setSelectedTemplateNames([]);
        setSelectedTemplateTypes([]);
        setStatusFilter("");
    };

    const categoryColors = {
        onboarding: "text-blue-600 bg-blue-50 border-blue-100",
        reminder: "text-amber-600 bg-amber-50 border-amber-100",
        notification: "text-indigo-600 bg-indigo-50 border-indigo-100",
        utility: "text-slate-600 bg-slate-50 border-slate-100",
        marketing: "text-purple-600 bg-purple-50 border-purple-100",
        authentication: "text-emerald-600 bg-emerald-50 border-emerald-100",
        promotional: "text-rose-600 bg-rose-50 border-rose-100",
        transactional: "text-teal-600 bg-teal-50 border-teal-100",
    };

    // Combined Instant Filtering + Performance Score Ranking (Top performer pinned at top)
    const filteredTemplates = useMemo(() => {
        let result = templates.filter((tmpl) => {
            // 1. Search Bar Filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesSearch =
                    tmpl.name?.toLowerCase().includes(q) ||
                    tmpl.category?.toLowerCase().includes(q) ||
                    tmpl.content?.toLowerCase().includes(q) ||
                    tmpl.description?.toLowerCase().includes(q);
                if (!matchesSearch) return false;
            }

            // 2. Content Type Filter
            if (selectedContentTypes.length > 0) {
                const tmplType = (tmpl.content_type || "text").toLowerCase();
                const matchesCT = selectedContentTypes.some(
                    (ct) => ct.toLowerCase() === tmplType
                );
                if (!matchesCT) return false;
            }

            // 3. Template Name Filter
            if (selectedTemplateNames.length > 0) {
                const matchesName = selectedTemplateNames.some(
                    (name) => name.toLowerCase() === tmpl.name?.toLowerCase()
                );
                if (!matchesName) return false;
            }

            // 4. Template Type Filter
            if (selectedTemplateTypes.length > 0) {
                const tmplCat = (tmpl.category || "").toLowerCase();
                const matchesType = selectedTemplateTypes.some(
                    (tt) => tt.toLowerCase() === tmplCat
                );
                if (!matchesType) return false;
            }

            // 5. Meta status filter
            if (statusFilter && (tmpl.status || "DRAFT") !== statusFilter) return false;

            return true;
        });

        // Sort by real performance score; templates without send data keep their order
        result.sort((a, b) => (b.performance_score ?? -1) - (a.performance_score ?? -1));
        return result;
    }, [templates, searchQuery, selectedContentTypes, selectedTemplateNames, selectedTemplateTypes, statusFilter]);

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-56 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in font-sans">
            {/* Header with Global Search */}
            <WhatsAppHeader
                activeTab="templates"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {/* Template Library Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 font-display">WhatsApp Templates</h2>
                    <p className="text-[10px] text-slate-400">Only templates Meta has approved can be used in campaigns and automations.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* TEMPLATE INSIGHTS BUTTON */}
                    <button
                        onClick={() => navigate("/whatsapp/templates/insights")}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        <FiBarChart2 size={14} className="text-emerald-400" />
                        <span>Template Insights</span>
                    </button>

                    {/* FILTER BUTTON BESIDE TEMPLATE INSIGHTS */}
                    <WhatsAppTemplateFilter
                        availableTemplateNames={availableTemplateNames}
                        selectedContentTypes={selectedContentTypes}
                        setSelectedContentTypes={setSelectedContentTypes}
                        selectedTemplateNames={selectedTemplateNames}
                        setSelectedTemplateNames={setSelectedTemplateNames}
                        selectedTemplateTypes={selectedTemplateTypes}
                        setSelectedTemplateTypes={setSelectedTemplateTypes}
                        onReset={handleResetFilters}
                    />

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white"
                        title="Filter by Meta review status"
                    >
                        <option value="">All statuses</option>
                        {["DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED", "DISABLED", "DELETED"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        title="Fetch every template and its current review status from Meta"
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                        <FiRefreshCw size={13} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing..." : "Sync from Meta"}
                    </button>
                    <button
                        onClick={() => navigate("/whatsapp/templates/create")}
                        className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        <FiPlus size={13} /> Create Template
                    </button>
                </div>
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredTemplates.length > 0 ? (
                    filteredTemplates.map((tmpl) => (
                        <div
                            key={tmpl._id}
                            className={`bg-white border rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
                                tmpl.is_active ? "border-slate-200/80" : "border-slate-200/50 opacity-60"
                            }`}
                        >
                            <div>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-bold text-slate-800 font-display flex items-center gap-2">
                                            {tmpl.name}
                                        </h3>

                                        {/* Dynamic Badges */}
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <TemplateStatusBadge status={tmpl.status} />
                                            {tmpl.meta_category && (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 uppercase" title="Meta template category">{tmpl.meta_category}</span>
                                            )}
                                            {tmpl.language && (
                                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-slate-500">{tmpl.language}</span>
                                            )}
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${categoryColors[tmpl.category] || categoryColors.utility}`}>
                                                {tmpl.category}
                                            </span>
                                            {tmpl.content_type && (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-500 uppercase">
                                                    {tmpl.content_type}
                                                </span>
                                            )}
                                            {tmpl.badges?.map((b, bIdx) => (
                                                <span
                                                    key={bIdx}
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-slate-50 border-slate-200 text-slate-700"
                                                >
                                                    {b.icon} {b.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={(e) => handleFavorite(e, tmpl._id)}
                                            className="text-slate-400 hover:text-rose-500 transition p-1"
                                            title="Toggle Favorite"
                                        >
                                            <FiHeart size={14} className={tmpl.is_favorite ? "fill-rose-500 text-rose-500" : ""} />
                                        </button>
                                        <button onClick={() => handleToggle(tmpl)} className="cursor-pointer text-slate-400 hover:text-emerald-500 transition">
                                            {tmpl.is_active ? <FiToggleRight size={22} className="text-emerald-500" /> : <FiToggleLeft size={22} />}
                                        </button>
                                    </div>
                                </div>

                                {tmpl.description && (
                                    <p className="text-[10px] text-slate-400 mb-2">{tmpl.description}</p>
                                )}

                                {tmpl.rejected_reason && (
                                    <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1 mb-2 flex gap-1"><FiAlertTriangle size={11} className="shrink-0 mt-0.5" /> Meta rejection reason: {tmpl.rejected_reason}</p>
                                )}
                                {tmpl.last_submit_error && (
                                    <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1 mb-2">Last submission error: {tmpl.last_submit_error.message}{tmpl.last_submit_error.code ? ` (code ${tmpl.last_submit_error.code})` : ""}</p>
                                )}
                                {tmpl.sync_note && tmpl.status === "DRAFT" && (
                                    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mb-2">{tmpl.sync_note}</p>
                                )}
                                {tmpl.has_unsubmitted_changes && (
                                    <p className="text-[10px] text-amber-700 mb-2">Edited locally since the last Meta submission — resubmit to apply.</p>
                                )}

                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3 max-h-28 overflow-y-auto">
                                    <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">{tmpl.content}</p>
                                </div>

                                {tmpl.variables?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {tmpl.variables.map((v, i) => (
                                            <span key={i} className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold border border-indigo-100">{`{{${v}}}`}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                                <span className="text-[9px] text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100" title="Computed from real delivery data">
                                    {tmpl.performance_score != null ? `Score: ${tmpl.performance_score}` : "No send data yet"}
                                </span>
                                <div className="flex items-center gap-2">
                                    {(!tmpl.meta_template_id || ["REJECTED", "PAUSED", "DELETED"].includes(tmpl.status) || (tmpl.has_unsubmitted_changes && tmpl.status === "APPROVED")) && (
                                        <button
                                            onClick={() => handleSubmit(tmpl)}
                                            disabled={submittingId === tmpl._id}
                                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer disabled:opacity-50"
                                            title="Send this template to Meta for review"
                                        >
                                            <FiUploadCloud size={12} /> {submittingId === tmpl._id ? "Submitting..." : tmpl.meta_template_id && tmpl.status !== "DELETED" ? "Resubmit" : "Submit to Meta"}
                                        </button>
                                    )}
                                    <button onClick={() => setPreviewTemplate(tmpl)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer" title="Preview">
                                        <FiEye size={13} />
                                    </button>
                                    <button onClick={() => handleDelete(tmpl)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Delete">
                                        <FiTrash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    /* Empty state when no matching templates exist */
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-2xs space-y-3 col-span-full">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                            <FiFileText size={22} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 font-display">No templates found matching the selected filters.</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">Try resetting your filters or modifying your search keywords to view available templates.</p>
                        <button
                            onClick={handleResetFilters}
                            className="mt-2 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                            <FiRotateCcw size={13} /> Reset Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setPreviewTemplate(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 animate-slide-up space-y-4 font-sans">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display">WhatsApp Template Phone Preview</h3>
                            <button onClick={() => setPreviewTemplate(null)} className="text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                        </div>
                        <div className="bg-[#DCF8C6] text-slate-900 rounded-2xl rounded-tr-none p-4 shadow-xs border border-emerald-200">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap font-mono">{previewTemplate.content}</p>
                            
                            {previewTemplate.response_buttons?.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-emerald-200/70 flex flex-col gap-1.5">
                                    {previewTemplate.response_buttons.map((btn, idx) => (
                                        <div
                                            key={btn.id || idx}
                                            className="w-full bg-white/95 text-slate-800 border border-slate-200 font-bold text-[10px] py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs text-center"
                                        >
                                            <span className="truncate">{btn.text || btn.label}</span>
                                            {btn.offer_code && (
                                                <span className="ml-auto font-mono text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                                    {btn.offer_code}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-1 mt-2 text-[8px] text-slate-400">
                                <span>10:42 AM</span>
                                <span className="flex -space-x-1 text-blue-500"><FiCheck size={10} /><FiCheck size={10} /></span>
                            </div>
                        </div>
                        <button onClick={() => setPreviewTemplate(null)} className="w-full py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition">Close Preview</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppTemplates;
