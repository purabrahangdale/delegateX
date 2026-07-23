import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWhatsAppTemplates, createWhatsAppTemplate, updateWhatsAppTemplate, deleteWhatsAppTemplate, seedWhatsAppTemplates } from "../services/whatsappApi";
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiToggleLeft, FiToggleRight, FiFileText, FiDownload, FiX, FiCheck } from "react-icons/fi";

function WhatsAppTemplates() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [previewTemplate, setPreviewTemplate] = useState(null);
    const [formData, setFormData] = useState({ name: "", category: "utility", content: "", variables: "", description: "" });

    const fetchTemplates = async () => {
        try {
            const data = await getWhatsAppTemplates();
            setTemplates(data);
        } catch (err) {
            console.error("Failed to load templates", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTemplates(); }, []);

    const handleSeed = async () => {
        try {
            await seedWhatsAppTemplates();
            await fetchTemplates();
        } catch (err) {
            console.error("Seed error:", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            variables: formData.variables ? formData.variables.split(",").map(v => v.trim()).filter(Boolean) : [],
        };
        try {
            if (editingTemplate) {
                await updateWhatsAppTemplate(editingTemplate._id, payload);
            } else {
                await createWhatsAppTemplate(payload);
            }
            setShowForm(false);
            setEditingTemplate(null);
            setFormData({ name: "", category: "utility", content: "", variables: "", description: "" });
            await fetchTemplates();
        } catch (err) {
            console.error("Save error:", err);
        }
    };

    const handleEdit = (tmpl) => {
        setEditingTemplate(tmpl);
        setFormData({
            name: tmpl.name,
            category: tmpl.category,
            content: tmpl.content,
            variables: (tmpl.variables || []).join(", "),
            description: tmpl.description || "",
        });
        setShowForm(true);
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

    const categoryColors = {
        onboarding: "text-blue-600 bg-blue-50 border-blue-100",
        reminder: "text-amber-600 bg-amber-50 border-amber-100",
        notification: "text-indigo-600 bg-indigo-50 border-indigo-100",
        utility: "text-slate-600 bg-slate-50 border-slate-100",
    };

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-8 w-48 bg-slate-200 rounded-xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-slate-100 border border-slate-200 rounded-2xl"></div>)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-600 text-white text-sm shadow-lg shadow-green-500/20">
                            <FiFileText size={16} />
                        </span>
                        WhatsApp Templates
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">Create and manage reusable message templates for automation workflows.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSeed} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer">
                        <FiDownload size={14} /> Seed Defaults
                    </button>
                    <button onClick={() => navigate("/whatsapp/templates/create")} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-green-500/15 transition cursor-pointer">
                        <FiPlus size={14} /> Create Template
                    </button>
                </div>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {templates.map((tmpl) => (
                    <div key={tmpl._id} className={`bg-white border rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] hover:shadow-md transition-all duration-300 ${tmpl.is_active ? "border-slate-200/80" : "border-slate-200/50 opacity-60"}`}>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 font-display">{tmpl.name}</h3>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border mt-1 inline-block ${categoryColors[tmpl.category] || categoryColors.utility}`}>
                                    {tmpl.category}
                                </span>
                            </div>
                            <button onClick={() => handleToggle(tmpl)} className="cursor-pointer text-slate-400 hover:text-green-500 transition">
                                {tmpl.is_active ? <FiToggleRight size={20} className="text-green-500" /> : <FiToggleLeft size={20} />}
                            </button>
                        </div>

                        {tmpl.description && (
                            <p className="text-[10px] text-slate-400 mb-2">{tmpl.description}</p>
                        )}

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3 max-h-24 overflow-y-auto">
                            <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">{tmpl.content.substring(0, 200)}{tmpl.content.length > 200 ? "..." : ""}</p>
                        </div>

                        {tmpl.variables?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {tmpl.variables.map((v, i) => (
                                    <span key={i} className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold border border-indigo-100">{`{{${v}}}`}</span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                            <button onClick={() => setPreviewTemplate(tmpl)} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-50">
                                <FiEye size={11} /> Preview
                            </button>
                            <button onClick={() => handleEdit(tmpl)} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-amber-600 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-amber-50">
                                <FiEdit2 size={11} /> Edit
                            </button>
                            <button onClick={() => handleDelete(tmpl._id)} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-rose-50">
                                <FiTrash2 size={11} /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {templates.length === 0 && (
                <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl">
                    <FiFileText size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-xs text-slate-400">No templates yet. Click "Seed Defaults" to load starter templates.</p>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowForm(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-900 font-display">{editingTemplate ? "Edit Template" : "Create Template"}</h3>
                            <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Name</label>
                                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20" placeholder="e.g. Welcome Message" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20">
                                    <option value="onboarding">Onboarding</option>
                                    <option value="reminder">Reminder</option>
                                    <option value="notification">Notification</option>
                                    <option value="utility">Utility</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
                                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20" placeholder="Short description..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Content</label>
                                <textarea required value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} rows={6} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 resize-none font-mono" placeholder="Use {{variable_name}} for placeholders..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Variables (comma-separated)</label>
                                <input type="text" value={formData.variables} onChange={(e) => setFormData({ ...formData, variables: e.target.value })} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20" placeholder="client_name, project_type, assigned_to" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 text-xs font-semibold text-white bg-green-500 rounded-xl hover:bg-green-600 transition cursor-pointer shadow-sm shadow-green-500/20">{editingTemplate ? "Update" : "Create"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPreviewTemplate(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-900 font-display">Template Preview</h3>
                            <button onClick={() => setPreviewTemplate(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
                        </div>
                        <div className="bg-emerald-50 rounded-2xl rounded-br-md p-4 shadow-sm">
                            <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-800">{previewTemplate.content}</p>
                            <div className="flex items-center justify-end gap-1 mt-2">
                                <span className="text-[8px] text-slate-400">Now</span>
                                <span className="flex -space-x-1.5"><FiCheck size={10} className="text-blue-500" /><FiCheck size={10} className="text-blue-500" /></span>
                            </div>
                        </div>
                        <button onClick={() => setPreviewTemplate(null)} className="w-full mt-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppTemplates;
