import { useEffect, useState } from "react";
import {
    FiDownload, FiFilter, FiCalendar, FiRefreshCw, FiInbox, FiUser, FiTag, FiFileText,
    FiChevronLeft, FiChevronRight, FiMousePointer,
} from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, exportButtonEngagement, getButtonEngagementReport } from "../services/whatsappApi";

/*
 * Interactive button engagement: button-wise analytics per campaign and contact-level responses.
 * Button names come from the template / WhatsApp replies (server side) — nothing here assumes Yes / No.
 */
const PAGE_SIZE = 200;
const EMPTY_FILTERS = { campaign_id: "", from_date: "", to_date: "", template: "", button: "", response_status: "" };

const inputClass = "w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 text-slate-700";
const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1";

const cleanParams = (filters) => Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
const fmt = (n) => (n || 0).toLocaleString("en-IN");

function ButtonBar({ title, ids, clicks, contacts, percentage, muted }) {
    return (
        <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
                <div className="min-w-0">
                    <span className={`font-bold ${muted ? "text-slate-500" : "text-slate-800"}`}>{title}</span>
                    {ids?.length > 0 && <span className="ml-2 text-[10px] font-mono text-slate-400 truncate">ID: {ids.join(", ")}</span>}
                </div>
                <div className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                    {clicks != null && <span className="font-bold text-slate-800">{fmt(clicks)} clicks</span>}
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span>{fmt(contacts)} contacts</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-semibold">{percentage}%</span>
                </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${muted ? "bg-slate-300" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, percentage)}%` }} />
            </div>
        </div>
    );
}

function ButtonEngagementReport() {
    const { showToast } = useToast();
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(0);
    const [report, setReport] = useState(null);
    const [loadedKey, setLoadedKey] = useState(null);
    const [exportFormat, setExportFormat] = useState("xlsx");
    const [exportScope, setExportScope] = useState("filtered");
    const [exporting, setExporting] = useState(false);

    // Loading until the response for the current filters + page has arrived.
    const requestKey = JSON.stringify([filters, page]);
    const loading = loadedKey !== requestKey;

    useEffect(() => {
        let cancelled = false;
        getButtonEngagementReport({ ...cleanParams(filters), limit: PAGE_SIZE, skip: page * PAGE_SIZE })
            .then((data) => { if (!cancelled) setReport(data); })
            .catch((err) => { if (!cancelled) showToast(apiErrorMessage(err, "Failed to load button engagement report"), "error"); })
            .finally(() => { if (!cancelled) setLoadedKey(JSON.stringify([filters, page])); });
        return () => { cancelled = true; };
    }, [filters, page, showToast]);

    const setFilter = (key, value) => {
        setPage(0);
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = exportScope === "all" ? { all_records: true } : cleanParams(filters);
            const fileName = await exportButtonEngagement({ ...params, format: exportFormat });
            showToast(`Downloaded ${fileName}`, "success");
        } catch (err) {
            showToast(apiErrorMessage(err, "Failed to export button engagement report"), "error");
        } finally {
            setExporting(false);
        }
    };

    const summary = report?.summary || {};
    const options = report?.options || { campaigns: [], templates: [] };
    const buttons = summary.buttons || [];
    const rows = report?.rows || [];
    const totalRows = report?.total_rows || 0;
    const pages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

    const kpis = [
        { title: "Messages Sent", value: fmt(summary.messages_sent), note: `of ${fmt(summary.total_recipients)} recipients`, color: "text-slate-900" },
        { title: "Total Button Clicks", value: fmt(summary.total_clicks), note: `${fmt(summary.campaigns)} campaigns`, color: "text-emerald-600" },
        { title: "Contacts Responded", value: fmt(summary.responded), note: `${summary.response_rate || 0}%`, color: "text-indigo-600" },
        { title: "No Response", value: fmt(summary.no_response), note: `${summary.no_response_rate || 0}%`, color: "text-amber-600" },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                    <div key={k.title} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{k.title}</span>
                        <div className="flex items-baseline justify-between mt-2">
                            <span className={`text-2xl font-extrabold font-display ${k.color}`}>{k.value}</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">{k.note}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters & export */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                            <FiFilter size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 font-display">Button Engagement Filter & Download</h3>
                            <p className="text-xs text-slate-400">Clicks are matched to the exact campaign message they answer. Delivery and read receipts are not counted.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => { setPage(0); setFilters(EMPTY_FILTERS); }}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                            <FiRefreshCw size={12} />
                            <span>Reset Filters</span>
                        </button>
                        <select value={exportScope} onChange={(e) => setExportScope(e.target.value)} className={`${inputClass} w-auto`} aria-label="Records to export">
                            <option value="filtered">Filtered records</option>
                            <option value="all">All records</option>
                        </select>
                        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className={`${inputClass} w-auto`} aria-label="File format">
                            <option value="xlsx">Excel (.xlsx)</option>
                            <option value="csv">CSV</option>
                        </select>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                            <FiDownload size={14} className={exporting ? "animate-bounce" : ""} />
                            <span>{exporting ? "Generating..." : "Download Report"}</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <div>
                        <label className={labelClass}>Campaign</label>
                        <select value={filters.campaign_id} onChange={(e) => setFilter("campaign_id", e.target.value)} className={inputClass}>
                            <option value="">All Campaigns</option>
                            {options.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Sent From</label>
                        <div className="relative flex items-center">
                            <FiCalendar className="absolute left-3 text-slate-400" size={13} />
                            <input type="date" value={filters.from_date} onChange={(e) => setFilter("from_date", e.target.value)} className={`${inputClass} pl-9`} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Sent To</label>
                        <div className="relative flex items-center">
                            <FiCalendar className="absolute left-3 text-slate-400" size={13} />
                            <input type="date" value={filters.to_date} onChange={(e) => setFilter("to_date", e.target.value)} className={`${inputClass} pl-9`} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Template</label>
                        <select value={filters.template} onChange={(e) => setFilter("template", e.target.value)} className={inputClass}>
                            <option value="">All Templates</option>
                            {options.templates.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Button Name</label>
                        <select value={filters.button} onChange={(e) => setFilter("button", e.target.value)} className={inputClass}>
                            <option value="">All Buttons</option>
                            {buttons.map((b) => <option key={b.title} value={b.title}>{b.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Response Status</label>
                        <select value={filters.response_status} onChange={(e) => setFilter("response_status", e.target.value)} className={inputClass}>
                            <option value="">All Statuses</option>
                            <option value="responded">Responded</option>
                            <option value="no_response">No Response</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Button-wise analytics */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-800 font-display flex items-center justify-between">
                    <span>Button-wise Engagement</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">% of recipients reached</span>
                </h3>
                {buttons.length === 0 && !summary.messages_sent ? (
                    <p className="text-xs text-slate-400">No campaign messages match these filters.</p>
                ) : (
                    <div className="space-y-4">
                        {buttons.map((b) => <ButtonBar key={b.title} {...b} />)}
                        <ButtonBar title="No Response" contacts={summary.no_response} percentage={summary.no_response_rate || 0} muted />
                    </div>
                )}
            </div>

            {/* Per-campaign analytics */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Campaign Button Analytics</h3>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{fmt(report?.campaigns?.length)} Campaigns</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                <th className="py-3 px-4">Campaign & Template</th>
                                <th className="py-3 px-4 text-right">Recipients</th>
                                <th className="py-3 px-4 text-right">Sent</th>
                                <th className="py-3 px-4 text-right">Clicks</th>
                                <th className="py-3 px-4">Clicks per Button</th>
                                <th className="py-3 px-4 text-right">No Response</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(report?.campaigns || []).map((c) => (
                                <tr key={c.campaign_id} className="hover:bg-slate-50/80 transition duration-150 align-top">
                                    <td className="py-3 px-4">
                                        <div className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 mb-1">
                                            <FiTag size={10} />
                                            <span>{c.campaign_name}</span>
                                        </div>
                                        {c.template_name && (
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <FiFileText size={10} className="text-slate-400" />
                                                <span>{c.template_name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right tabular-nums">{fmt(c.total_recipients)}</td>
                                    <td className="py-3 px-4 text-right tabular-nums">{fmt(c.messages_sent)}</td>
                                    <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-800">{fmt(c.total_clicks)}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {c.buttons.length === 0 && <span className="text-slate-300 italic text-[11px]">No quick-reply buttons</span>}
                                            {c.buttons.map((b) => (
                                                <span key={b.title} title={b.ids.length ? `Button ID: ${b.ids.join(", ")}` : undefined}
                                                    className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                                    <span>{b.title}</span>
                                                    <span className="text-slate-400">·</span>
                                                    <span className="tabular-nums">{fmt(b.clicks)} ({b.percentage}%)</span>
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right tabular-nums text-amber-700 font-semibold">
                                        {fmt(c.no_response)} <span className="text-slate-400 font-normal">({c.no_response_rate}%)</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Contact-level responses */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Contact Responses</h3>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            {fmt(totalRows)} {totalRows === 1 ? "Record" : "Records"}
                        </span>
                    </div>
                    {pages > 1 && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer" aria-label="Previous page"><FiChevronLeft size={14} /></button>
                            <span>Page {page + 1} of {pages}</span>
                            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer" aria-label="Next page"><FiChevronRight size={14} /></button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 font-medium">
                        <FiRefreshCw className="animate-spin text-emerald-500" size={20} />
                        <span>Loading button engagement...</span>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                        <FiInbox size={28} className="text-slate-300" />
                        <span className="font-semibold text-slate-600">No button responses found matching filters</span>
                        <span className="text-[11px] text-slate-400">Try adjusting the campaign, date range or status filters.</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/70 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="py-3 px-4">Contact</th>
                                    <th className="py-3 px-4">Campaign & Template</th>
                                    <th className="py-3 px-4">Button</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Click Time (UTC)</th>
                                    <th className="py-3 px-4">Message ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map((r, i) => {
                                    const responded = r["Response Status"] === "Responded";
                                    return (
                                        <tr key={`${r["Message ID"]}-${r["Reply Message ID"] || i}`} className="hover:bg-slate-50/80 transition duration-150">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                    <FiUser size={12} className="text-slate-400 shrink-0" />
                                                    <span>{r["Contact Name"] || "-"}</span>
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-500 mt-0.5">{r["WhatsApp Number"] || "-"}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-slate-800">{r["Campaign Name"]}</div>
                                                <div className="text-[10px] text-slate-500">{r["Template Name"]}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {r["Button Name"] ? (
                                                    <>
                                                        <div className="inline-flex items-center gap-1 font-semibold text-slate-800">
                                                            <FiMousePointer size={11} className="text-emerald-500" />
                                                            <span>{r["Button Name"]}</span>
                                                        </div>
                                                        {r["Button ID"] && <div className="text-[10px] font-mono text-slate-400">ID: {r["Button ID"]}</div>}
                                                    </>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${responded ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                                    {r["Response Status"]}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-600 tabular-nums">{r["Click Timestamp (UTC)"] || "-"}</td>
                                            <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-[14rem] truncate" title={r["Message ID"]}>{r["Message ID"]}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ButtonEngagementReport;
