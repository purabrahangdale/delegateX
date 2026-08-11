import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiSearch, FiPlus, FiSend, FiFileText, FiUsers, FiDownload,
    FiMessageCircle, FiX, FiCheckCircle
} from "react-icons/fi";

function WhatsAppHeader({ activeTab = "dashboard", onSearchChange, searchQuery = "", filterComponent = null }) {
    const navigate = useNavigate();
    const [localSearch, setLocalSearch] = useState(searchQuery);

    const handleSearch = (e) => {
        const val = e.target.value;
        setLocalSearch(val);
        if (onSearchChange) onSearchChange(val);
    };

    return (
        <div className="space-y-4 mb-6 animate-fade-in">
            {/* Main Header Bar */}
            <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_12px_rgba(15,23,42,0.02)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sticky top-0 z-20">
                {/* Left: Branding & Subtitle */}
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-[#25D366] to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center shrink-0">
                        <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-white">
                            <FiMessageCircle size={22} className="text-[#25D366] animate-pulse-subtle" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                            WhatsApp Automation
                        </h1>
                    </div>
                </div>

                {/* Right: Quick Action Toolbar */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
                    <button
                        onClick={() => navigate("/whatsapp/campaigns")}
                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        <FiSend size={13} />
                        <span>New Campaign</span>
                    </button>

                    <button
                        onClick={() => navigate("/whatsapp/bulk-send")}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-slate-900/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        <FiPlus size={13} />
                        <span>Bulk Send</span>
                    </button>

                    <button
                        onClick={() => navigate("/whatsapp/templates/create")}
                        className="flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition duration-200 cursor-pointer"
                    >
                        <FiFileText size={13} className="text-emerald-600" />
                        <span>Create Template</span>
                    </button>

                    <button
                        onClick={() => navigate("/whatsapp/contacts")}
                        className="flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition duration-200 cursor-pointer hidden sm:flex"
                    >
                        <FiUsers size={13} className="text-slate-500" />
                        <span>Import Contacts</span>
                    </button>

                    <button
                        onClick={() => navigate("/whatsapp/reports")}
                        className="flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition duration-200 cursor-pointer hidden sm:flex"
                    >
                        <FiDownload size={13} className="text-slate-500" />
                        <span>Export Report</span>
                    </button>
                </div>
            </div>

            {/* Global Instant Search Bar & Optional Filter Slot */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 flex items-center">
                    <FiSearch className="absolute left-4 text-slate-400" size={15} />
                    <input
                        type="text"
                        value={localSearch}
                        onChange={handleSearch}
                        placeholder="Global Search across Campaigns, Templates, Contacts, Inbox, Logs & Automations..."
                        className="w-full pl-11 pr-10 py-3 text-xs bg-white/80 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 font-sans transition-all shadow-xs"
                    />
                    {localSearch && (
                        <button
                            onClick={() => { setLocalSearch(""); if (onSearchChange) onSearchChange(""); }}
                            className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <FiX size={14} />
                        </button>
                    )}
                </div>
                {filterComponent}
            </div>
        </div>
    );
}

export default WhatsAppHeader;
