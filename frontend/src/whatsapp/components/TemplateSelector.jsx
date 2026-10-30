import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiCheckCircle, FiClock } from "react-icons/fi";
import TemplateStatusBadge from "./TemplateStatusBadge";
import { getRecentTemplates } from "../services/whatsappApi";
import { parseUtcTimestamp } from "../utils/inboxTime";

const matchesQuery = (t, q) =>
    [t.name, t.meta_template_name, t.language, t.meta_category].some((v) => (v || "").toLowerCase().includes(q));

function usedAgo(value) {
    const d = parseUtcTimestamp(value);
    if (!d) return "";
    const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    const days = Math.floor(mins / 1440);
    return days < 30 ? `${days}d ago` : d.toLocaleDateString();
}

/**
 * Searchable list of Meta-approved templates (from GET /templates/sendable).
 * Shared by the campaign builder, automation rules and the diagnostics test send.
 * With `showRecent`, the user's last sent templates on the selected number are listed first
 * ("Recently Used"), above the full list ("All Templates").
 */
function TemplateSelector({ templates, selectedId, onSelect, loading, emptyHint, showRecent = false }) {
    const [query, setQuery] = useState("");
    const [recentEntries, setRecentEntries] = useState([]);

    useEffect(() => {
        if (!showRecent) return;
        let cancelled = false;
        getRecentTemplates()
            .then((list) => { if (!cancelled) setRecentEntries(list); })
            .catch(() => { /* history is a convenience — search over all templates still works */ });
        return () => { cancelled = true; };
    }, [showRecent]);

    // Only templates in the current approved list (i.e. the selected number's WABA), in most-recent order.
    const recent = useMemo(() => {
        const byId = new Map(templates.map((t) => [t._id, t]));
        return recentEntries
            .map((e) => byId.get(e.template_id) && { template: byId.get(e.template_id), lastUsedAt: e.last_used_at })
            .filter(Boolean);
    }, [templates, recentEntries]);

    const q = query.trim().toLowerCase();
    const filtered = useMemo(() => (q ? templates.filter((t) => matchesQuery(t, q)) : templates), [templates, q]);
    const filteredRecent = useMemo(() => (q ? recent.filter((r) => matchesQuery(r.template, q)) : recent), [recent, q]);

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

    const renderCard = (t, lastUsedAt) => {
        const body = (t.components || []).find((c) => c.type === "BODY")?.text || "";
        const active = t._id === selectedId;
        return (
            <button
                type="button"
                key={t._id}
                onClick={() => onSelect(t)}
                className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${active ? "border-[#25D366] bg-emerald-50/40 shadow-xs" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{t.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{t.language}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase">{t.meta_category}</span>
                        <TemplateStatusBadge status={t.status} />
                        {active && <FiCheckCircle size={16} className="text-[#25D366]" />}
                    </div>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-1.5 line-clamp-2 whitespace-pre-wrap">{body}</p>
                <p className="text-[10px] text-slate-400 mt-1.5">
                    Meta name: <span className="font-mono">{t.meta_template_name}</span> · {t.slots?.length || 0} variable(s)
                    {lastUsedAt && <> · <span className="text-emerald-600 font-semibold">Used {usedAgo(lastUsedAt)}</span></>}
                </p>
            </button>
        );
    };

    const sectionTitle = (icon, label, count) => (
        <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide px-0.5">
            {icon}{label}<span className="text-slate-400 font-semibold">({count})</span>
        </p>
    );
    const sectioned = filteredRecent.length > 0;

    return (
        <div className="space-y-3">
            <div className="relative">
                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search approved templates..."
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
            </div>
            <div className="max-h-[520px] overflow-y-auto space-y-2.5 pr-1">
                {sectioned && (
                    <>
                        {sectionTitle(<FiClock size={11} className="text-emerald-600" />, "Recently Used", filteredRecent.length)}
                        {filteredRecent.map((r) => renderCard(r.template, r.lastUsedAt))}
                        <div className="pt-2 border-t border-slate-100">
                            {sectionTitle(null, "All Templates", filtered.length)}
                        </div>
                    </>
                )}
                {filtered.map((t) => renderCard(t))}
                {!filtered.length && <p className="text-[11px] text-slate-400 p-2">No template matches "{query}".</p>}
            </div>
        </div>
    );
}

export default TemplateSelector;
