import { useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createWhatsAppTemplate } from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import WhatsAppAiAssistant from "../components/WhatsAppAiAssistant";
import {
    FiArrowLeft, FiSave, FiFileText, FiPlus, FiSmile, FiBold, FiItalic,
    FiCornerDownLeft, FiPaperclip, FiImage, FiFile, FiVideo, FiMapPin,
    FiLink, FiCheck, FiInfo, FiUpload, FiX, FiCheckCircle, FiEdit3, FiEye,
    FiChevronRight
} from "react-icons/fi";

// Sample Demo Data for Live Preview
const SAMPLE_DATA = {
    client_name: "John Smith",
    first_name: "John",
    last_name: "Smith",
    phone: "+91 98765 43210",
    email: "john.smith@example.com",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    project_type: "Residential Villa",
    lead_source: "Website Enquiry",
    sales: "Sarah Jenkins",
    meeting_date: "25 July 2026",
    followup_date: "28 July 2026",
    assigned_to: "Sarah Jenkins",
    proposal_number: "PROP-2026-089",
    proposal_amount: "₹12,50,000",
    proposal_status: "Approved",
    project_name: "Skyline Apartments",
    project_phase: "Design Approval",
    project_progress: "65%",
    milestone: "Phase 2 Sign-off",
    company_name: "DelegateX Corp",
    branch: "Headquarters",
    address: "Tech Park, Suite 402",
};

// Variable Categories
const VARIABLE_GROUPS = [
    {
        name: "Customer",
        variables: [
            { label: "Client Name", key: "client_name" },
            { label: "First Name", key: "first_name" },
            { label: "Last Name", key: "last_name" },
            { label: "Phone", key: "phone" },
            { label: "Email", key: "email" },
            { label: "City", key: "city" },
            { label: "State", key: "state" },
            { label: "Country", key: "country" },
            { label: "Project Type", key: "project_type" },
            { label: "Lead Source", key: "lead_source" },
        ]
    },
    {
        name: "Sales & Meeting",
        variables: [
            { label: "Sales Rep", key: "sales" },
            { label: "Meeting Date", key: "meeting_date" },
            { label: "Follow-up Date", key: "followup_date" },
            { label: "Assigned Employee", key: "assigned_to" },
        ]
    },
    {
        name: "Proposal",
        variables: [
            { label: "Proposal Number", key: "proposal_number" },
            { label: "Proposal Amount", key: "proposal_amount" },
            { label: "Proposal Status", key: "proposal_status" },
        ]
    },
    {
        name: "Project",
        variables: [
            { label: "Project Name", key: "project_name" },
            { label: "Project Phase", key: "project_phase" },
            { label: "Project Progress", key: "project_progress" },
            { label: "Milestone", key: "milestone" },
        ]
    },
    {
        name: "Company",
        variables: [
            { label: "Company Name", key: "company_name" },
            { label: "Branch", key: "branch" },
            { label: "Address", key: "address" },
        ]
    }
];

const EMOJI_LIST = ["😊", "👋", "📅", "📋", "📌", "✅", "🚀", "💬", "🏢", "✉️", "🎉", "⭐", "🔹", "📍", "👤"];

function CreateWhatsAppTemplate() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const textareaRef = useRef(null);

    // Form State
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Welcome Message");
    const [content, setContent] = useState("");
    const [description, setDescription] = useState("");
    const [attachmentType, setAttachmentType] = useState("none");
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Settings Checkboxes
    const [isActive, setIsActive] = useState(true);
    const [allowAi, setAllowAi] = useState(true);
    const [enableValidation, setEnableValidation] = useState(true);
    const [previewBeforeSend, setPreviewBeforeSend] = useState(true);

    // UI & Validation State
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Category Options
    const categories = [
        "Welcome Message",
        "Follow-up Reminder",
        "Meeting Reminder",
        "Task Assignment",
        "Auto Reply",
        "Status Update",
        "Custom"
    ];

    // Helper: Insert text at cursor position in textarea
    const insertTextAtCursor = (textToInsert) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = content.substring(0, start);
        const textAfter = content.substring(end);

        const newContent = textBefore + textToInsert + textAfter;
        setContent(newContent);

        // Reset cursor position after insertion
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + textToInsert.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    // Helper: Wrap selected text or insert formatting tag
    const applyFormatting = (prefix, suffix = prefix) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = content.substring(start, end);

        if (selected) {
            const newText = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
            setContent(newText);
        } else {
            insertTextAtCursor(`${prefix}text${suffix}`);
        }
    };

    // Insert variable chip
    const insertVariable = (varKey) => {
        insertTextAtCursor(`{{${varKey}}}`);
    };

    // Real-Time Preview Generator (Memoized)
    const resolvedPreview = useMemo(() => {
        if (!content.trim()) return "";

        let rendered = content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
            return SAMPLE_DATA[key] !== undefined ? SAMPLE_DATA[key] : "[Not Available]";
        });

        return rendered;
    }, [content]);

    // Format WhatsApp preview text (*bold* -> <strong>, _italic_ -> <em>)
    const formatPreviewHtml = (text) => {
        if (!text) return "";
        let formatted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Format *bold*
        formatted = formatted.replace(/\*([^\*]+)\*/g, "<strong>$1</strong>");
        // Format _italic_
        formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");
        // Newlines
        formatted = formatted.replace(/\n/g, "<br/>");

        return formatted;
    };

    // Validate form
    const validate = () => {
        const newErrors = {};
        if (!name.trim()) {
            newErrors.name = "Template name is required";
        } else if (name.trim().length < 3) {
            newErrors.name = "Template name must be at least 3 characters";
        } else if (name.trim().length > 100) {
            newErrors.name = "Template name cannot exceed 100 characters";
        }

        if (!category) {
            newErrors.category = "Category is required";
        }

        if (!content.trim()) {
            newErrors.content = "Message content is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle Save
    const handleSave = async (e) => {
        e?.preventDefault();
        if (!validate()) {
            showToast("Please fix the errors before saving", "error");
            return;
        }

        setSaving(true);

        const variableMatches = content.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
        const extractedVars = [...new Set(variableMatches.map(v => v.replace(/[\{\}\s]/g, "")))];

        try {
            await createWhatsAppTemplate({
                name: name.trim(),
                category: category.toLowerCase().replace(/\s+/g, "_"),
                content: content.trim(),
                variables: extractedVars,
                description: description.trim(),
                is_active: isActive,
            });

            showToast("WhatsApp Template Created Successfully", "success");
            navigate("/whatsapp/templates");
        } catch (err) {
            console.error("Failed to save WhatsApp template", err);
            showToast("Failed to create WhatsApp template. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setAttachmentFile({
                name: file.name,
                size: (file.size / 1024).toFixed(1) + " KB",
                type: file.type,
            });
        }
    };

    return (
        <div className="space-y-6 mt-2 max-w-7xl mx-auto pb-12 animate-fade-in">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Link to="/whatsapp/dashboard" className="hover:text-slate-600 transition">
                    WhatsApp Automation
                </Link>
                <FiChevronRight size={12} className="text-slate-300" />
                <Link to="/whatsapp/templates" className="hover:text-slate-600 transition">
                    Templates
                </Link>
                <FiChevronRight size={12} className="text-slate-300" />
                <span className="text-slate-700 font-semibold">Create Template</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/whatsapp/templates")}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-sm"
                        title="Back to Templates"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                            Create WhatsApp Template
                            <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2.5 py-0.5 rounded-md border border-green-100 uppercase tracking-wider">
                                WhatsApp
                            </span>
                        </h1>
                        <p className="text-slate-500 text-xs mt-0.5">
                            Create reusable WhatsApp templates with dynamic CRM variables and real-time preview.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/whatsapp/templates")}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-green-500/20 transition duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                    >
                        {saving ? (
                            <FiCheckCircle className="animate-spin" size={15} />
                        ) : (
                            <FiSave size={15} />
                        )}
                        {saving ? "Saving..." : "Save Template"}
                    </button>
                </div>
            </div>

            {/* Layout Grid (70% Left, 30% Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT PANEL — 70% */}
                <div className="lg:col-span-7 space-y-6">

                    {/* Section 1: Basic Information */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <span className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100">
                                <FiFileText size={15} />
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 font-display">Basic Information</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Channel */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Channel
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value="WhatsApp"
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Category <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 font-medium cursor-pointer"
                                >
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                                {errors.category && (
                                    <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.category}</p>
                                )}
                            </div>
                        </div>

                        {/* Template Name */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Template Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors({ ...errors, name: null });
                                }}
                                placeholder="Enter template name (e.g. Lead Welcome Message)"
                                className={`w-full px-3.5 py-2.5 text-xs bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 transition ${errors.name ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-green-400"
                                    }`}
                            />
                            {errors.name ? (
                                <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.name}</p>
                            ) : (
                                <p className="text-[10px] text-slate-400 mt-1">Unique template identifier for automation triggers.</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Short Description
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description explaining when this template is sent..."
                                className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition"
                            />
                        </div>
                    </div>

                    {/* Section 2: Message Builder */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100">
                                    <FiEdit3 size={15} />
                                </span>
                                <h3 className="text-sm font-bold text-slate-900 font-display">Message Builder</h3>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                                {content.length} characters
                            </span>
                        </div>

                        {/* Editor Toolbar */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <button
                                type="button"
                                onClick={() => applyFormatting("*")}
                                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                title="Bold (*text*)"
                            >
                                <FiBold size={13} />
                                <span className="text-[10px]">Bold</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => applyFormatting("_")}
                                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 text-xs italic transition cursor-pointer flex items-center gap-1"
                                title="Italic (_text_)"
                            >
                                <FiItalic size={13} />
                                <span className="text-[10px]">Italic</span>
                            </button>

                            <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>

                            <button
                                type="button"
                                onClick={() => insertTextAtCursor("\n")}
                                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 text-xs transition cursor-pointer flex items-center gap-1"
                                title="Insert Line Break"
                            >
                                <FiCornerDownLeft size={13} />
                                <span className="text-[10px]">Line Break</span>
                            </button>

                            {/* Emoji Popover Button */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                    <FiSmile size={13} className="text-amber-500" />
                                    <span className="text-[10px]">Emoji</span>
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute left-0 top-full mt-2 z-20 bg-white border border-slate-200 rounded-xl p-2 shadow-xl grid grid-cols-5 gap-1.5 animate-slide-up w-44">
                                        {EMOJI_LIST.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => {
                                                    insertTextAtCursor(emoji);
                                                    setShowEmojiPicker(false);
                                                }}
                                                className="p-1.5 hover:bg-slate-100 rounded text-sm cursor-pointer text-center"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>

                            <span className="text-[10px] text-slate-400 font-medium ml-auto hidden sm:inline">
                                Use <code className="bg-slate-200/60 px-1 py-0.5 rounded text-[9px] text-slate-700">{"{{var}}"}</code> for dynamic CRM variables
                            </span>
                        </div>

                        {/* Textarea Editor */}
                        <div>
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => {
                                    setContent(e.target.value);
                                    if (errors.content) setErrors({ ...errors, content: null });
                                }}
                                placeholder={`Hi {{client_name}},\n\nThank you for reaching out regarding your {{project_type}} project. Your assigned consultant is {{assigned_to}}.\n\nWe look forward to connecting with you!\n\n— Team DelegateX`}
                                rows={12}
                                className={`w-full p-4 text-xs font-mono leading-relaxed bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 transition resize-y min-h-[300px] ${errors.content ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-green-400"
                                    }`}
                            />
                            {errors.content && (
                                <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.content}</p>
                            )}
                        </div>
                    </div>

                    {/* Section 2.5: AI Writing Assistant */}
                    <WhatsAppAiAssistant
                        content={content}
                        onApplySuggestion={(suggested) => setContent(suggested)}
                    />

                    {/* Section 3: Attachments */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <span className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100">
                                <FiPaperclip size={15} />
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 font-display">Attachments</h3>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: "none", label: "No Attachment", icon: FiX },
                                { id: "image", label: "Image", icon: FiImage },
                                { id: "pdf", label: "PDF Document", icon: FiFile },
                                { id: "video", label: "Video", icon: FiVideo },
                                { id: "location", label: "Location", icon: FiMapPin },
                                { id: "link", label: "Link Card", icon: FiLink },
                            ].map((item) => {
                                const Icon = item.icon;
                                const selected = attachmentType === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setAttachmentType(item.id)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer border ${selected
                                            ? "bg-green-50 border-green-300 text-green-700 font-semibold shadow-sm"
                                            : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-slate-100"
                                            }`}
                                    >
                                        <Icon size={13} className={selected ? "text-green-600" : "text-slate-400"} />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {attachmentType !== "none" && (
                            <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center gap-2">
                                <FiUpload className="text-slate-400" size={20} />
                                <div>
                                    <p className="text-xs font-semibold text-slate-700">
                                        Upload {attachmentType.toUpperCase()} File
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        Drag and drop or click to attach media for this template
                                    </p>
                                </div>
                                <label className="mt-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition cursor-pointer">
                                    Choose File
                                    <input type="file" onChange={handleFileSelect} className="hidden" />
                                </label>
                                {attachmentFile && (
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs mt-2">
                                        <span className="font-medium text-slate-700">{attachmentFile.name}</span>
                                        <span className="text-[9px] text-slate-400 font-mono">({attachmentFile.size})</span>
                                        <button type="button" onClick={() => setAttachmentFile(null)} className="text-slate-400 hover:text-rose-500 ml-1">
                                            <FiX size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section 4: Template Settings */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <span className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100">
                                <FiInfo size={15} />
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 font-display">Template Settings</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="w-4 h-4 text-green-500 rounded border-slate-300 focus:ring-green-500"
                                />
                                <div>
                                    <span className="text-xs font-semibold text-slate-800 block">Active Template</span>
                                    <span className="text-[10px] text-slate-400 block">Ready for automation triggers</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                                <input
                                    type="checkbox"
                                    checked={allowAi}
                                    onChange={(e) => setAllowAi(e.target.checked)}
                                    className="w-4 h-4 text-green-500 rounded border-slate-300 focus:ring-green-500"
                                />
                                <div>
                                    <span className="text-xs font-semibold text-slate-800 block">Allow AI Personalization</span>
                                    <span className="text-[10px] text-slate-400 block">Gemini AI can tune tone per lead</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                                <input
                                    type="checkbox"
                                    checked={enableValidation}
                                    onChange={(e) => setEnableValidation(e.target.checked)}
                                    className="w-4 h-4 text-green-500 rounded border-slate-300 focus:ring-green-500"
                                />
                                <div>
                                    <span className="text-xs font-semibold text-slate-800 block">Enable Variable Validation</span>
                                    <span className="text-[10px] text-slate-400 block">Verify all variables before dispatch</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                                <input
                                    type="checkbox"
                                    checked={previewBeforeSend}
                                    onChange={(e) => setPreviewBeforeSend(e.target.checked)}
                                    className="w-4 h-4 text-green-500 rounded border-slate-300 focus:ring-green-500"
                                />
                                <div>
                                    <span className="text-xs font-semibold text-slate-800 block">Preview Before Sending</span>
                                    <span className="text-[10px] text-slate-400 block">Require manual confirmation</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL — 30% */}
                <div className="lg:col-span-5 space-y-6">

                    {/* CARD 1: Dynamic Variables */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 font-display">Variables</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Click any variable chip to insert at your cursor position in the message editor.
                            </p>
                        </div>

                        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                            {VARIABLE_GROUPS.map((group) => (
                                <div key={group.name} className="space-y-1.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                        {group.name}
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.variables.map((item) => (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => insertVariable(item.key)}
                                                className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-indigo-50/70 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-100 transition duration-150 cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                                                title={`Insert {{${item.key}}}`}
                                            >
                                                <FiPlus size={10} className="text-indigo-400 group-hover:text-white" />
                                                <span>{`{{${item.key}}}`}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CARD 2: Live Preview (Sticky) */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] sticky top-6 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100">
                                    <FiEye size={14} />
                                </span>
                                <h3 className="text-sm font-bold text-slate-900 font-display">LIVE PREVIEW</h3>
                            </div>
                            <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                                Real-time
                            </span>
                        </div>

                        {/* Authentic WhatsApp Message Bubble Frame */}
                        <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-md">
                            {/* WhatsApp Header */}
                            <div className="bg-[#075e54] text-white px-3.5 py-2.5 flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                                    D
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate leading-none">DelegateX Client</p>
                                    <p className="text-[9px] text-green-200 leading-none mt-0.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                                        online
                                    </p>
                                </div>
                            </div>

                            {/* Chat Body Wallpaper */}
                            <div
                                className="bg-[#e5ddd5] p-3.5 min-h-[220px] max-h-[360px] overflow-y-auto flex flex-col justify-end"
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.04'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
                                }}
                            >
                                {resolvedPreview ? (
                                    <div className="bg-[#dcf8c6] text-slate-800 p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[92%] ml-auto animate-fade-in border border-emerald-200/50">
                                        {/* Optional Attachment Card */}
                                        {attachmentType !== "none" && (
                                            <div className="mb-2 p-2 bg-emerald-100/80 rounded-xl border border-emerald-200 flex items-center gap-2">
                                                <FiPaperclip size={14} className="text-emerald-700" />
                                                <span className="text-[10px] font-bold text-emerald-800 uppercase">
                                                    [{attachmentType} Attachment]
                                                </span>
                                            </div>
                                        )}

                                        {/* Rendered HTML */}
                                        <div
                                            className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans text-slate-900"
                                            dangerouslySetInnerHTML={{ __html: formatPreviewHtml(resolvedPreview) }}
                                        />

                                        {/* Meta info / Double tick */}
                                        <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-slate-400">
                                            <span>10:42 AM</span>
                                            <span className="flex -space-x-1.5 text-blue-500">
                                                <FiCheck size={11} />
                                                <FiCheck size={11} />
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl text-center shadow-xs border border-white/50">
                                        <p className="text-[11px] text-slate-400 italic">
                                            Start typing in the editor to see your WhatsApp message live preview...
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default CreateWhatsAppTemplate;
