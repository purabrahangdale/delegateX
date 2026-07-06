import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
    FiMail, FiLayers, FiFileText, FiUsers, FiSliders, FiSearch, 
    FiPlus, FiEdit3, FiEye, FiCopy
} from "react-icons/fi";
import { useToast } from "../context/ToastContext";

// Card helper component
function TemplateCard({ title, description, lastUpdated, category, type, onCopy }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] hover:shadow-[0_8px_16px_rgba(15,23,42,0.02)] transition duration-200 flex flex-col justify-between h-48">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg">
                        {category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{type}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 font-display mb-1.5">{title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{description}</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                <span className="text-[10px] text-slate-400">Updated {lastUpdated}</span>
                <div className="flex items-center gap-1.5">
                    <button 
                        onClick={() => onCopy(title)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                        title="Copy Template Name"
                    >
                        <FiCopy size={13} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer" title="Edit Template">
                        <FiEdit3 size={13} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer" title="Preview Template">
                        <FiEye size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TemplatesView() {
    const { view } = useParams();
    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");

    // Sync tab with URL view parameter if appropriate
    useEffect(() => {
        if (view) {
            setActiveTab(view);
        } else {
            setActiveTab("all");
        }
    }, [view]);

    const handleCopy = (title) => {
        navigator.clipboard.writeText(title);
        showToast(`Template name "${title}" copied to clipboard!`);
    };

    const templatesData = [
        {
            title: "Client Welcome Email",
            description: "Sent to newly registered leads/clients to welcome them and details enquiry acknowledgment.",
            category: "client",
            type: "Python Module",
            lastUpdated: "2 hours ago",
        },
        {
            title: "Employee Task Assigned",
            description: "Notification containing task descriptions, deadlines, and project details sent to employees.",
            category: "employee",
            type: "Python Module",
            lastUpdated: "1 day ago",
        },
        {
            title: "Project Update Email",
            description: "Updates customers on project milestones, deadlines, and assigned expert statuses.",
            category: "client",
            type: "Python Module",
            lastUpdated: "3 days ago",
        },
        {
            title: "Base Email wrapper",
            description: "A dark/light mode responsive layout wrapper providing consistent header, footer, and brand styles.",
            category: "layouts",
            type: "Layout Template",
            lastUpdated: "1 week ago",
        },
        {
            title: "Lead Created Notification",
            description: "Internal team alert triggered whenever a new lead details register into the CRM dashboard.",
            category: "crm",
            type: "CRM Template",
            lastUpdated: "Just now",
        },
        {
            title: "Meeting Rescheduled Alert",
            description: "Notifies clients and employees dynamically when an existing CRM meeting is updated.",
            category: "crm",
            type: "CRM Template",
            lastUpdated: "2 weeks ago",
        },
        {
            title: "Client Feedback Survey",
            description: "A dynamic feedback form sent to clients after project delivery to capture ratings and reviews.",
            category: "form",
            type: "Form Template",
            lastUpdated: "3 hours ago",
        },
        {
            title: "Employee Onboarding Form",
            description: "Information collection form for new hires to submit personal and bank details.",
            category: "form",
            type: "Form Template",
            lastUpdated: "2 days ago",
        },
        {
            title: "Lead Follow-up Ping",
            description: "Quick follow-up WhatsApp message layout for prospects who recently inquired.",
            category: "whatsapp",
            type: "WhatsApp Template",
            lastUpdated: "5 hours ago",
        },
        {
            title: "Meeting Reminder Ping",
            description: "Automated WhatsApp notification sent 15 minutes before a scheduled meeting.",
            category: "whatsapp",
            type: "WhatsApp Template",
            lastUpdated: "1 day ago",
        }
    ];

    // Filter logic
    const filteredTemplates = templatesData.filter(template => {
        const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             template.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeTab === "all" || template.category === activeTab || 
                               (activeTab === "email" && (template.category === "client" || template.category === "employee"));
        return matchesSearch && matchesCategory;
    });

    const getHeaderDetails = () => {
        switch (activeTab) {
            case "email":
                return {
                    title: "Email Templates",
                    subtitle: "Manage all structured outgoing emails and system notifications."
                };
            case "layouts":
                return {
                    title: "Reusable Layouts",
                    subtitle: "Design and maintain responsive wrappers, header/footer shells, and color schemes."
                };
            case "crm":
                return {
                    title: "CRM Notification Templates",
                    subtitle: "Automation email triggers for leads, deals, meetings, and CRM operations."
                };
            case "client":
                return {
                    title: "Client Emails",
                    subtitle: "Templates optimized for client onboarding, updates, and communications."
                };
            case "employee":
                return {
                    title: "Employee Emails",
                    subtitle: "Internal notifications regarding task schedules, assignments, and announcements."
                };
            case "form":
                return {
                    title: "Form Templates",
                    subtitle: "Manage all structured input and interactive forms."
                };
            case "whatsapp":
                return {
                    title: "WhatsApp Templates",
                    subtitle: "Manage automated WhatsApp message layouts and notification templates."
                };
            default:
                return {
                    title: "Templates Registry",
                    subtitle: "Modular email system containing base structures, reusable layouts, and notification builders."
                };
        }
    };

    const header = getHeaderDetails();

    return (
        <div className="space-y-8 mt-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">{header.title}</h1>
                    <p className="text-slate-500 text-xs mt-1">{header.subtitle}</p>
                </div>
                <button
                    onClick={() => showToast("Adding new template placeholder initialized.")}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                    <FiPlus size={14} />
                    New Template
                </button>
            </div>

            {/* Quick Navigation / Filtering */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-md">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <FiSearch size={14} />
                        </span>
                        <input
                            type="text"
                            placeholder="Search templates by title or keywords..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                        />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                        <FiSliders size={12} className="text-slate-400 mr-1 flex-shrink-0" />
                        {[
                            { id: "all", label: "All Items" },
                            { id: "email", label: "Emails" },
                            { id: "layouts", label: "Layouts" },
                            { id: "crm", label: "CRM" },
                            { id: "client", label: "Clients" },
                            { id: "employee", label: "Employees" },
                            { id: "form", label: "Forms" },
                            { id: "whatsapp", label: "WhatsApp" }
                        ].map((tab) => (
                            <Link
                                key={tab.id}
                                to={tab.id === "all" ? "/templates" : `/templates/${tab.id}`}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-500"
                                }`}
                            >
                                {tab.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grid Container */}
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template, idx) => (
                        <TemplateCard
                            key={idx}
                            title={template.title}
                            description={template.description}
                            category={template.category}
                            type={template.type}
                            lastUpdated={template.lastUpdated}
                            onCopy={handleCopy}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <FiMail size={32} className="text-slate-300" />
                        <span className="text-xs text-slate-400 font-semibold">No templates found matching your search or filters.</span>
                    </div>
                </div>
            )}
        </div>
    );
}
