import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import WhatsAppTemplateFilter from "../components/WhatsAppTemplateFilter";
import {
    getWhatsAppTemplates,
    getWhatsAppTemplateNames,
    updateWhatsAppTemplate,
    deleteWhatsAppTemplate,
    seedWhatsAppTemplates,
    toggleWhatsAppTemplateFavorite,
} from "../services/whatsappApi";
import {
    FiPlus, FiTrash2, FiEye, FiToggleLeft, FiToggleRight,
    FiFileText, FiDownload, FiX, FiCheck, FiRotateCcw,
    FiBarChart2, FiHeart
} from "react-icons/fi";

function WhatsAppTemplates() {
    const navigate = useNavigate();
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

    const handleSeed = async () => {
        try {
            await seedWhatsAppTemplates();
            await fetchTemplates();
        } catch (err) {
            console.error("Seed error:", err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this template?")) return;
        try {
            await deleteWhatsAppTemplate(id);
            await fetchTemplates();
        } catch (err) {
            console.error("Delete error:", err);
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

            return true;
        });

        // Automatically sort templates by performance score descending
        result.sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0));
        return result;
    }, [templates, searchQuery, selectedContentTypes, selectedTemplateNames, selectedTemplateTypes]);

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
                    <h2 className="text-sm font-bold text-slate-800 font-display">Approved WhatsApp Templates</h2>
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

                    <button
                        onClick={handleSeed}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                        <FiDownload size={13} /> Seed Defaults
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
                                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                    Score: {tmpl.performance_score || 92.5}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setPreviewTemplate(tmpl)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer" title="Preview">
                                        <FiEye size={13} />
                                    </button>
                                    <button onClick={() => handleDelete(tmpl._id)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Delete">
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
