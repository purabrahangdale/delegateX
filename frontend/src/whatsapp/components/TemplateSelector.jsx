import { useMemo, useState } from "react";
import { FiSearch, FiCheckCircle } from "react-icons/fi";
import TemplateStatusBadge from "./TemplateStatusBadge";

/**
 * Searchable list of Meta-approved templates (from GET /templates/sendable).
 * Shared by the campaign builder, automation rules and the diagnostics test send.
 */
function TemplateSelector({ templates, selectedId, onSelect, loading, emptyHint }) {
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return templates;
        return templates.filter((t) =>
            [t.name, t.meta_template_name, t.language, t.meta_category].some((v) => (v || "").toLowerCase().includes(q))
        );
    }, [templates, query]);

    if (loading) {
        return <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />;
    }

    if (!templates.length) {
        return (
            <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-[11px] text-amber-800 leading-relaxed">
                {emptyHint || "No Meta-approved templates yet. Create a template, submit it for review, and sync statuses once Meta approves it."}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search approved templates..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filtered.map((t) => {
                    const body = (t.components || []).find((c) => c.type === "BODY")?.text || "";
                    const active = t._id === selectedId;
                    return (
                        <button
                            type="button"
                            key={t._id}
                            onClick={() => onSelect(t)}
                            className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${active ? "border-[#25D366] bg-emerald-50/40" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-800 truncate">{t.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">{t.language}</span>
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded uppercase">{t.meta_category}</span>
                                    <TemplateStatusBadge status={t.status} />
                                    {active && <FiCheckCircle size={14} className="text-[#25D366]" />}
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-1 line-clamp-2 whitespace-pre-wrap">{body}</p>
                            <p className="text-[9px] text-slate-400 mt-1">Meta name: <span className="font-mono">{t.meta_template_name}</span> · {t.slots?.length || 0} variable(s)</p>
                        </button>
                    );
                })}
                {!filtered.length && <p className="text-[11px] text-slate-400 p-2">No template matches "{query}".</p>}
            </div>
        </div>
    );
}

export default TemplateSelector;
