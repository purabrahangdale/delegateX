import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import WhatsAppHeader from "../components/WhatsAppHeader";
import {
    getWhatsAppDNDList,
    addWhatsAppDNDNumber,
    addWhatsAppDNDBulk,
    deleteWhatsAppDNDNumber,
} from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import {
    FiSlash, FiPlus, FiUpload, FiSearch, FiX, FiCheckCircle,
    FiShieldOff, FiMessageSquare, FiUserX, FiFileText,
    FiTrash2, FiRefreshCw, FiChevronRight, FiFilter, FiCheck
} from "react-icons/fi";

const REASON_OPTIONS = [
    "User Opt-out",
    "Manual Block",
    "Invalid Number",
    "Spam Complaint",
];

const SOURCE_OPTIONS = [
    "Inbox Keyword",
    "Manual Entry",
    "CSV Upload",
];

function WhatsAppDND() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [dndData, setDndData] = useState({ items: [], total: 0, summary: {} });
    const [searchQuery, setSearchQuery] = useState("");
    const [filterReason, setFilterReason] = useState("all");
    const [filterSource, setFilterSource] = useState("all");

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCsvModal, setShowCsvModal] = useState(false);

    // Add Single Form State
    const [formData, setFormData] = useState({
        phone_number: "",
        country_code: "+91",
        reason: "Manual Block",
        source: "Manual Entry",
        notes: "",
    });

    // CSV Bulk Input State
    const [csvInput, setCsvInput] = useState("");
    const [csvReason, setCsvReason] = useState("Manual Block");

    const fetchDND = async () => {
        try {
            const data = await getWhatsAppDNDList({
                search: searchQuery,
                reason: filterReason,
                source: filterSource,
            });
            if (data) setDndData(data);
        } catch (err) {
            console.error("DND fetch error", err);
            showToast("Failed to load Global DND list", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDND();
    }, [searchQuery, filterReason, filterSource]);

    const handleAddSingle = async (e) => {
        e.preventDefault();
        if (!formData.phone_number.trim()) {
            showToast("Phone number is required", "warning");
            return;
        }

        try {
            await addWhatsAppDNDNumber(formData);
            showToast(`Added ${formData.phone_number} to Global DND list`, "success");
            setShowAddModal(false);
            setFormData({
                phone_number: "",
                country_code: "+91",
                reason: "Manual Block",
                source: "Manual Entry",
                notes: "",
            });
            fetchDND();
        } catch (err) {
            showToast("Failed to add phone number to DND list", "error");
        }
    };

    const handleAddBulk = async (e) => {
        e.preventDefault();
        if (!csvInput.trim()) {
            showToast("Please enter or paste phone numbers", "warning");
            return;
        }

        const lines = csvInput
            .split(/[\n,;]+/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (lines.length === 0) {
            showToast("No valid phone numbers found", "warning");
            return;
        }

        const items = lines.map((phone) => ({
            phone_number: phone,
            country_code: "+91",
            reason: csvReason,
            source: "CSV Upload",
        }));

        try {
            const res = await addWhatsAppDNDBulk(items);
            showToast(`Successfully imported ${res.added_count || lines.length} DND numbers`, "success");
            setShowCsvModal(false);
            setCsvInput("");
            fetchDND();
        } catch (err) {
            showToast("Failed to import bulk DND numbers", "error");
        }
    };

    const handleUnblock = async (phone) => {
        if (!confirm(`Are you sure you want to unblock ${phone} and remove it from Global DND?`)) return;

        try {
            await deleteWhatsAppDNDNumber(phone);
            showToast(`Unblocked ${phone} successfully`, "success");
            fetchDND();
        } catch (err) {
            showToast("Failed to unblock phone number", "error");
        }
    };

    const summary = dndData.summary || {};
    const items = dndData.items || [];

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
                    ))}
                </div>
                <div className="h-72 bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-2 pb-16 animate-fade-in font-sans">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Link to="/whatsapp/dashboard" className="hover:text-slate-600 transition">
                    WhatsApp Automation
                </Link>
                <FiChevronRight size={12} className="text-slate-300" />
                <span className="text-slate-700 font-semibold">Global DND List</span>
            </nav>

            {/* Header Navigation */}
            <WhatsAppHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            {/* Title & Action Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                        <FiSlash size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                            Global DND & Centralized Blocklist
                            <span className="text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Auto-Exclusion Active
                            </span>
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Centralized registry of blocked phone numbers automatically excluded before every campaign dispatch.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowCsvModal(true)}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                        <FiUpload size={13} />
                        <span>CSV Import</span>
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        <FiPlus size={14} />
                        <span>Add DND Number</span>
                    </button>
                </div>
            </div>

            {/* KPI Stat Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FiShieldOff size={12} className="text-rose-500" /> Total Blocked
                    </span>
                    <p className="text-2xl font-bold text-slate-900 font-display">{summary.total_dnd || 0}</p>
                    <p className="text-[10px] text-slate-400">Active numbers in blocklist</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FiMessageSquare size={12} className="text-amber-500" /> Inbox Opt-Outs
                    </span>
                    <p className="text-2xl font-bold text-slate-900 font-display">{summary.total_optouts || 0}</p>
                    <p className="text-[10px] text-slate-400">Triggered via STOP / DND text</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FiUserX size={12} className="text-indigo-500" /> Manual Blocks
                    </span>
                    <p className="text-2xl font-bold text-slate-900 font-display">{summary.total_manual || 0}</p>
                    <p className="text-[10px] text-slate-400">Added by team admins</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FiFileText size={12} className="text-emerald-500" /> CSV Imports
                    </span>
                    <p className="text-2xl font-bold text-slate-900 font-display">{summary.total_csv || 0}</p>
                    <p className="text-[10px] text-slate-400">Bulk imported numbers</p>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div className="relative flex-1 max-w-md">
                    <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={14} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search phone number or notes..."
                        className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                            <FiX size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={filterReason}
                        onChange={(e) => setFilterReason(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Reasons</option>
                        {REASON_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>

                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Sources</option>
                        {SOURCE_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* DND Numbers Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
                {items.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-5 py-3">Phone Number</th>
                                    <th className="px-4 py-3">Reason</th>
                                    <th className="px-4 py-3">Source</th>
                                    <th className="px-4 py-3">Date Added</th>
                                    <th className="px-4 py-3">Notes</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {items.map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/60 transition">
                                        <td className="px-5 py-3 font-semibold text-slate-900 font-mono">
                                            {item.phone_number}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100">
                                                {item.reason}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                {item.source}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-[11px] max-w-xs truncate">
                                            {item.notes || "—"}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => handleUnblock(item.phone_number)}
                                                className="text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                                                title="Unblock & Remove from DND"
                                            >
                                                Unblock
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                            <FiSlash size={22} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 font-display">No DND Numbers Found</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            No blocked numbers match the current search or filters.
                        </p>
                    </div>
                )}
            </div>

            {/* Add Single DND Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowAddModal(false)}></div>
                    <form
                        onSubmit={handleAddSingle}
                        className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                                <FiSlash className="text-rose-500" size={16} /> Add Phone Number to DND List
                            </h3>
                            <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Phone Number *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    placeholder="+91 98765 43210"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-mono"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Reason for Blocking</label>
                                <select
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                                >
                                    {REASON_OPTIONS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Notes / Reason Details</label>
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Optional notes explaining why this number is blocked..."
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition shadow-xs"
                            >
                                Add to DND
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* CSV Bulk Import Modal */}
            {showCsvModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowCsvModal(false)}></div>
                    <form
                        onSubmit={handleAddBulk}
                        className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                                <FiUpload className="text-rose-500" size={16} /> Bulk Import DND Numbers
                            </h3>
                            <button type="button" onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600">
                                <FiX size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Reason for Bulk Block</label>
                                <select
                                    value={csvReason}
                                    onChange={(e) => setCsvReason(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                                >
                                    {REASON_OPTIONS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Paste Phone Numbers (One per line or comma separated)
                                </label>
                                <textarea
                                    rows={8}
                                    required
                                    value={csvInput}
                                    onChange={(e) => setCsvInput(e.target.value)}
                                    placeholder="+919876543210&#10;+919876543211&#10;+919876543212"
                                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowCsvModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition shadow-xs"
                            >
                                Process Bulk Import
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default WhatsAppDND;
