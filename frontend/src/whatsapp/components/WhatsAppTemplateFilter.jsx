import { useState, useRef, useEffect } from "react";
import { FiFilter, FiSearch, FiX, FiCheck, FiChevronDown, FiChevronUp, FiRotateCcw } from "react-icons/fi";

const CONTENT_TYPES = [
    "Text",
    "Image",
    "Video",
    "Document",
    "Audio",
    "Location",
    "Contact",
    "Interactive Buttons",
    "List Message",
    "Carousel",
    "Product",
    "Product List",
];

const TEMPLATE_TYPES = [
    "Notification",
    "Reminder",
    "Marketing",
    "Authentication",
    "Utility",
    "Promotional",
    "Transactional",
];

function WhatsAppTemplateFilter({
    availableTemplateNames = [],
    selectedContentTypes = [],
    setSelectedContentTypes,
    selectedTemplateNames = [],
    setSelectedTemplateNames,
    selectedTemplateTypes = [],
    setSelectedTemplateTypes,
    onReset,
    onApply,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);

    // Accordion / Collapsible state
    const [openCategory, setOpenCategory] = useState("content_type"); // 'content_type' | 'template_name' | 'template_type'

    // Internal search queries for each filter section
    const [contentTypeSearch, setContentTypeSearch] = useState("");
    const [templateNameSearch, setTemplateNameSearch] = useState("");
    const [templateTypeSearch, setTemplateTypeSearch] = useState("");

    // Active filters total count
    const totalActiveCount =
        selectedContentTypes.length +
        selectedTemplateNames.length +
        selectedTemplateTypes.length;

    // Handle click outside to close popover
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Checkbox toggles
    const toggleContentType = (type) => {
        if (selectedContentTypes.includes(type)) {
            setSelectedContentTypes(selectedContentTypes.filter((item) => item !== type));
        } else {
            setSelectedContentTypes([...selectedContentTypes, type]);
        }
    };

    const toggleTemplateName = (name) => {
        if (selectedTemplateNames.includes(name)) {
            setSelectedTemplateNames(selectedTemplateNames.filter((item) => item !== name));
        } else {
            setSelectedTemplateNames([...selectedTemplateNames, name]);
        }
    };

    const toggleTemplateType = (type) => {
        if (selectedTemplateTypes.includes(type)) {
            setSelectedTemplateTypes(selectedTemplateTypes.filter((item) => item !== type));
        } else {
            setSelectedTemplateTypes([...selectedTemplateTypes, type]);
        }
    };

    // Filter lists by inner search inputs
    const filteredContentTypes = CONTENT_TYPES.filter((item) =>
        item.toLowerCase().includes(contentTypeSearch.toLowerCase())
    );

    const filteredTemplateNames = availableTemplateNames.filter((name) =>
        name.toLowerCase().includes(templateNameSearch.toLowerCase())
    );

    const filteredTemplateTypes = TEMPLATE_TYPES.filter((type) =>
        type.toLowerCase().includes(templateTypeSearch.toLowerCase())
    );

    const handleReset = () => {
        if (onReset) onReset();
        setContentTypeSearch("");
        setTemplateNameSearch("");
        setTemplateTypeSearch("");
    };

    const handleApply = () => {
        if (onApply) onApply();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={popoverRef}>
            {/* Filter Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-semibold border transition-all duration-200 shadow-xs cursor-pointer ${
                    isOpen || totalActiveCount > 0
                        ? "bg-emerald-50/90 border-emerald-300 text-emerald-700 shadow-emerald-500/10"
                        : "bg-white/80 border-slate-200/80 text-slate-700 hover:bg-slate-50"
                }`}
                title="Filter Templates"
            >
                <FiFilter size={15} className={totalActiveCount > 0 ? "text-emerald-600" : "text-slate-500"} />
                <span>Filter</span>
                {totalActiveCount > 0 && (
                    <span className="bg-[#25D366] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono shadow-2xs">
                        {totalActiveCount}
                    </span>
                )}
            </button>

            {/* Popover Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[340px] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 z-40 space-y-3 font-sans animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <FiFilter size={14} className="text-emerald-600" />
                            <h3 className="text-xs font-bold text-slate-800 font-display">Filter Templates</h3>
                            {totalActiveCount > 0 && (
                                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    {totalActiveCount} active
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        >
                            <FiX size={14} />
                        </button>
                    </div>

                    {/* Filter Categories Container */}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">

                        {/* CATEGORY 1: Content Type */}
                        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/40">
                            <button
                                onClick={() => setOpenCategory(openCategory === "content_type" ? null : "content_type")}
                                className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100/70 transition cursor-pointer"
                            >
                                <span className="flex items-center gap-2">
                                    1. Content Type
                                    {selectedContentTypes.length > 0 && (
                                        <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-mono">
                                            {selectedContentTypes.length}
                                        </span>
                                    )}
                                </span>
                                {openCategory === "content_type" ? <FiChevronUp size={14} className="text-slate-400" /> : <FiChevronDown size={14} className="text-slate-400" />}
                            </button>

                            {openCategory === "content_type" && (
                                <div className="p-2.5 pt-0 space-y-2 border-t border-slate-100 bg-white">
                                    {/* Search input inside Content Type */}
                                    <div className="relative mt-2">
                                        <FiSearch className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
                                        <input
                                            type="text"
                                            value={contentTypeSearch}
                                            onChange={(e) => setContentTypeSearch(e.target.value)}
                                            placeholder="Search content type..."
                                            className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                                        />
                                        {contentTypeSearch && (
                                            <button onClick={() => setContentTypeSearch("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                                                <FiX size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Checkboxes List */}
                                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                        {filteredContentTypes.length > 0 ? (
                                            filteredContentTypes.map((type) => {
                                                const isSelected = selectedContentTypes.includes(type);
                                                return (
                                                    <label
                                                        key={type}
                                                        onClick={() => toggleContentType(type)}
                                                        className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] cursor-pointer transition ${
                                                            isSelected ? "bg-emerald-50/80 text-emerald-800 font-semibold border border-emerald-200/70" : "hover:bg-slate-50 text-slate-700 font-medium"
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => {}}
                                                                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                                            />
                                                            <span>{type}</span>
                                                        </span>
                                                        {isSelected && <FiCheck size={12} className="text-emerald-600" />}
                                                    </label>
                                                );
                                            })
                                        ) : (
                                            <p className="text-[10px] text-slate-400 py-2 text-center">No content types found</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CATEGORY 2: Template Name */}
                        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/40">
                            <button
                                onClick={() => setOpenCategory(openCategory === "template_name" ? null : "template_name")}
                                className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100/70 transition cursor-pointer"
                            >
                                <span className="flex items-center gap-2">
                                    2. Template Name
                                    {selectedTemplateNames.length > 0 && (
                                        <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-mono">
                                            {selectedTemplateNames.length}
                                        </span>
                                    )}
                                </span>
                                {openCategory === "template_name" ? <FiChevronUp size={14} className="text-slate-400" /> : <FiChevronDown size={14} className="text-slate-400" />}
                            </button>

                            {openCategory === "template_name" && (
                                <div className="p-2.5 pt-0 space-y-2 border-t border-slate-100 bg-white">
                                    {/* Search input inside Template Name */}
                                    <div className="relative mt-2">
                                        <FiSearch className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
                                        <input
                                            type="text"
                                            value={templateNameSearch}
                                            onChange={(e) => setTemplateNameSearch(e.target.value)}
                                            placeholder="Search template name..."
                                            className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                                        />
                                        {templateNameSearch && (
                                            <button onClick={() => setTemplateNameSearch("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                                                <FiX size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Checkboxes List */}
                                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                        {filteredTemplateNames.length > 0 ? (
                                            filteredTemplateNames.map((name) => {
                                                const isSelected = selectedTemplateNames.includes(name);
                                                return (
                                                    <label
                                                        key={name}
                                                        onClick={() => toggleTemplateName(name)}
                                                        className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] cursor-pointer transition ${
                                                            isSelected ? "bg-emerald-50/80 text-emerald-800 font-semibold border border-emerald-200/70" : "hover:bg-slate-50 text-slate-700 font-medium"
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2 truncate pr-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => {}}
                                                                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                                                            />
                                                            <span className="truncate">{name}</span>
                                                        </span>
                                                        {isSelected && <FiCheck size={12} className="text-emerald-600 shrink-0" />}
                                                    </label>
                                                );
                                            })
                                        ) : (
                                            <p className="text-[10px] text-slate-400 py-2 text-center">No template names found</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CATEGORY 3: Template Type */}
                        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/40">
                            <button
                                onClick={() => setOpenCategory(openCategory === "template_type" ? null : "template_type")}
                                className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100/70 transition cursor-pointer"
                            >
                                <span className="flex items-center gap-2">
                                    3. Template Type
                                    {selectedTemplateTypes.length > 0 && (
                                        <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-mono">
                                            {selectedTemplateTypes.length}
                                        </span>
                                    )}
                                </span>
                                {openCategory === "template_type" ? <FiChevronUp size={14} className="text-slate-400" /> : <FiChevronDown size={14} className="text-slate-400" />}
                            </button>

                            {openCategory === "template_type" && (
                                <div className="p-2.5 pt-0 space-y-2 border-t border-slate-100 bg-white">
                                    {/* Search input inside Template Type */}
                                    <div className="relative mt-2">
                                        <FiSearch className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
                                        <input
                                            type="text"
                                            value={templateTypeSearch}
                                            onChange={(e) => setTemplateTypeSearch(e.target.value)}
                                            placeholder="Search template type..."
                                            className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                                        />
                                        {templateTypeSearch && (
                                            <button onClick={() => setTemplateTypeSearch("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                                                <FiX size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Checkboxes List */}
                                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                        {filteredTemplateTypes.length > 0 ? (
                                            filteredTemplateTypes.map((type) => {
                                                const isSelected = selectedTemplateTypes.includes(type);
                                                return (
                                                    <label
                                                        key={type}
                                                        onClick={() => toggleTemplateType(type)}
                                                        className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] cursor-pointer transition ${
                                                            isSelected ? "bg-emerald-50/80 text-emerald-800 font-semibold border border-emerald-200/70" : "hover:bg-slate-50 text-slate-700 font-medium"
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => {}}
                                                                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                                            />
                                                            <span>{type}</span>
                                                        </span>
                                                        {isSelected && <FiCheck size={12} className="text-emerald-600" />}
                                                    </label>
                                                );
                                            })
                                        ) : (
                                            <p className="text-[10px] text-slate-400 py-2 text-center">No template types found</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Actions Footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                            <FiRotateCcw size={12} />
                            <span>Reset Filters</span>
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-1 bg-[#25D366] hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer text-center"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppTemplateFilter;
