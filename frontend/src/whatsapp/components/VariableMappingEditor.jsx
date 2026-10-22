import { useState, useRef } from "react";
import {
    FiInfo, FiUploadCloud, FiImage, FiEdit2, FiTrash2,
    FiExternalLink, FiCheck, FiRefreshCw, FiCrop, FiFileText, FiVideo
} from "react-icons/fi";
import { uploadWhatsAppMedia } from "../services/whatsappApi";
import { useToast } from "../../context/ToastContext";
import ImageEditorModal from "./ImageEditorModal";

// Maps every parameter slot of a Meta template to a recipient field or a fixed value (helpers in ./variableMapping).

const KIND_HINT = {
    media: "Public HTTPS link to the image/video/document shown in the header.",
    url_suffix: "Text appended to the button's base URL.",
    coupon: "Code copied when the customer taps the button.",
};

const getFileNameFromUrl = (url) => {
    if (!url) return "";
    try {
        const clean = url.split("?")[0].split("#")[0];
        const parts = clean.split("/");
        return decodeURIComponent(parts[parts.length - 1]) || url;
    } catch {
        return url;
    }
};

function VariableMappingEditor({ slots, mapping, onChange, fieldOptions }) {
    const { showToast } = useToast();
    const [uploadingSlots, setUploadingSlots] = useState({});
    const [dragOverSlot, setDragOverSlot] = useState(null);
    const [editorState, setEditorState] = useState({
        isOpen: false,
        slotKey: "",
        imageSrc: "",
        title: "",
    });

    const fileInputRefs = useRef({});

    if (!slots?.length) {
        return (
            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">
                This template has no variables — every recipient receives the same message.
            </p>
        );
    }

    const update = (key, patch) =>
        onChange({
            ...mapping,
            [key]: { ...(mapping[key] || { source: "field", value: "" }), ...patch },
        });

    const triggerFileInput = (key) => {
        if (fileInputRefs.current[key]) {
            fileInputRefs.current[key].click();
        }
    };

    const handleFileUpload = async (slotKey, file) => {
        if (!file) return;

        // 15MB size limit check
        if (file.size > 15 * 1024 * 1024) {
            showToast("File size exceeds 15MB limit. Please choose a smaller file.", "error");
            return;
        }

        setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));
        try {
            const res = await uploadWhatsAppMedia(file);
            if (res?.url) {
                update(slotKey, { source: "static", value: res.url });
                showToast("Media attached successfully!", "success");
            } else {
                throw new Error("Upload did not return a valid media URL");
            }
        } catch (err) {
            console.error("Failed to upload media:", err);
            const msg = err?.response?.data?.detail || err?.message || "Failed to upload file";
            showToast(`Upload failed: ${msg}`, "error");
        } finally {
            setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
        }
    };

    const openImageEditor = (slot, currentUrl) => {
        setEditorState({
            isOpen: true,
            slotKey: slot.key,
            imageSrc: currentUrl || slot.example || "",
            title: `Edit ${slot.label || "Header Image"}`,
        });
    };

    const handleEditorSave = (newUrl) => {
        if (editorState.slotKey && newUrl) {
            update(editorState.slotKey, { source: "static", value: newUrl });
            showToast("Edited image saved & attached successfully!", "success");
        }
    };

    return (
        <div className="space-y-3">
            {slots.map((slot) => {
                const rule = mapping[slot.key] || { source: "field", value: "" };
                const missing = !(rule.value || "").toString().trim();
                const isMedia = slot.kind === "media";
                const isUploading = Boolean(uploadingSlots[slot.key]);
                const mediaFmt = (slot.media_format || "").toUpperCase();
                const isImage = !mediaFmt || mediaFmt === "IMAGE" || slot.label?.toLowerCase().includes("image") || slot.key.includes("image");
                const isVideo = mediaFmt === "VIDEO" || slot.label?.toLowerCase().includes("video");
                const isDocument = mediaFmt === "DOCUMENT" || slot.label?.toLowerCase().includes("document");

                return (
                    <div
                        key={slot.key}
                        className={`p-3 rounded-xl border transition-all ${missing ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"
                            }`}
                    >
                        {/* Slot Header */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                    <span className="font-mono text-indigo-600 mr-1">{slot.key}</span> {slot.label}
                                </p>
                                {(slot.example || KIND_HINT[slot.kind]) && (
                                    <p className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                                        <FiInfo size={9} className="shrink-0" />
                                        <span>
                                            {KIND_HINT[slot.kind] || ""}{" "}
                                            {slot.example ? `Example: ${slot.example}` : ""}
                                        </span>
                                    </p>
                                )}
                            </div>

                            {!isMedia && (
                                <select
                                    value={rule.source}
                                    onChange={(e) => update(slot.key, { source: e.target.value, value: "" })}
                                    className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white shrink-0 cursor-pointer"
                                >
                                    <option value="field">Recipient field</option>
                                    <option value="static">Same text for everyone</option>
                                </select>
                            )}
                        </div>

                        {/* Media Slot Handler */}
                        {isMedia ? (
                            <div className="space-y-2">
                                {/* Hidden file input for attachment */}
                                <input
                                    type="file"
                                    ref={(el) => (fileInputRefs.current[slot.key] = el)}
                                    accept={isImage ? "image/*" : isVideo ? "video/*" : isDocument ? ".pdf,.doc,.docx,.xls,.xlsx" : "*/*"}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(slot.key, file);
                                        e.target.value = "";
                                    }}
                                    className="hidden"
                                />

                                {rule.value ? (
                                    /* Image / Media Attached View */
                                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 space-y-2">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {/* Visual Thumbnail */}
                                                {isImage ? (
                                                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs group">
                                                        <img
                                                            src={rule.value}
                                                            alt="Attached preview"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.target.style.display = "none";
                                                                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                                            }}
                                                        />
                                                        <div className="hidden absolute inset-0 items-center justify-center bg-slate-100 text-slate-400">
                                                            <FiImage size={18} />
                                                        </div>
                                                    </div>
                                                ) : isVideo ? (
                                                    <div className="w-14 h-14 rounded-lg border border-slate-200 bg-indigo-50/50 flex items-center justify-center text-indigo-600 shrink-0">
                                                        <FiVideo size={20} />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-lg border border-slate-200 bg-amber-50/50 flex items-center justify-center text-amber-600 shrink-0">
                                                        <FiFileText size={20} />
                                                    </div>
                                                )}

                                                {/* File Details */}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                                            <FiCheck size={10} /> Attached
                                                        </span>
                                                        {isUploading && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded animate-pulse">
                                                                <FiRefreshCw size={9} className="animate-spin" /> Uploading...
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] font-mono text-slate-700 truncate max-w-[240px] sm:max-w-[320px] mt-0.5" title={rule.value}>
                                                        {getFileNameFromUrl(rule.value)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Buttons: Attach/Change, Edit, View, Remove */}
                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                <button
                                                    type="button"
                                                    onClick={() => triggerFileInput(slot.key)}
                                                    disabled={isUploading}
                                                    title="Upload and attach a different image file"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-[11px] font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
                                                >
                                                    <FiUploadCloud size={12} className="text-indigo-600" />
                                                    <span>Change</span>
                                                </button>

                                                {isImage && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openImageEditor(slot, rule.value)}
                                                        disabled={isUploading}
                                                        title="Crop, rotate, and adjust image"
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[11px] font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
                                                    >
                                                        <FiCrop size={12} />
                                                        <span>Edit Image</span>
                                                    </button>
                                                )}

                                                <a
                                                    href={rule.value}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Open full media in new tab"
                                                    className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg text-[11px] hover:bg-slate-100 transition"
                                                >
                                                    <FiExternalLink size={12} />
                                                </a>

                                                <button
                                                    type="button"
                                                    onClick={() => update(slot.key, { source: "static", value: "" })}
                                                    title="Remove media attachment"
                                                    className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-lg text-[11px] hover:bg-rose-50 transition cursor-pointer"
                                                >
                                                    <FiTrash2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Direct URL Input (Always available for viewing / editing) */}
                                        <div className="pt-1.5 border-t border-slate-200/60">
                                            <input
                                                value={rule.value}
                                                onChange={(e) => update(slot.key, { source: "static", value: e.target.value })}
                                                placeholder={slot.example || "Public HTTPS media URL"}
                                                className="w-full text-xs font-mono text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Empty State: Attach / Drag & Drop Dropzone */
                                    <div className="space-y-2">
                                        <div
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOverSlot(slot.key);
                                            }}
                                            onDragLeave={() => setDragOverSlot(null)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragOverSlot(null);
                                                const file = e.dataTransfer.files?.[0];
                                                if (file) handleFileUpload(slot.key, file);
                                            }}
                                            onClick={() => triggerFileInput(slot.key)}
                                            className={`p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition cursor-pointer ${dragOverSlot === slot.key
                                                    ? "border-emerald-500 bg-emerald-50/60"
                                                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300"
                                                }`}
                                        >
                                            {isUploading ? (
                                                <div className="flex flex-col items-center gap-1.5 py-2 text-indigo-600">
                                                    <FiRefreshCw size={20} className="animate-spin" />
                                                    <span className="text-xs font-semibold">Uploading {isImage ? "image" : "media"}...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 shadow-2xs">
                                                        <FiUploadCloud size={16} />
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-700">
                                                        Attach or drag & drop {isImage ? "an image" : "a media file"}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        {isImage ? "JPG, PNG, WebP up to 15MB" : "Supported media format up to 15MB"}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            triggerFileInput(slot.key);
                                                        }}
                                                        className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs hover:bg-slate-100 transition cursor-pointer"
                                                    >
                                                        <FiUploadCloud size={12} className="text-indigo-600" />
                                                        <span>Choose {isImage ? "Image" : "File"}</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Alternative Direct URL Input */}
                                        <input
                                            value={rule.value}
                                            onChange={(e) => update(slot.key, { source: "static", value: e.target.value })}
                                            placeholder={slot.example || "Or paste public HTTPS image URL..."}
                                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : rule.source === "field" ? (
                            /* Field Mapping Selector */
                            <select
                                value={rule.value}
                                onChange={(e) => update(slot.key, { value: e.target.value })}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white cursor-pointer"
                            >
                                <option value="">— choose a field —</option>
                                {fieldOptions.map((f) => (
                                    <option key={f.value} value={f.value}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            /* Static Text Input */
                            <input
                                value={rule.value}
                                onChange={(e) => update(slot.key, { source: "static", value: e.target.value })}
                                placeholder={slot.example || "Enter value"}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                            />
                        )}

                        {missing && (
                            <p className="text-[9px] text-amber-700 font-semibold mt-1">
                                Required — the message cannot be sent without this value.
                            </p>
                        )}
                    </div>
                );
            })}

            {/* Interactive Image Editor Modal */}
            <ImageEditorModal
                isOpen={editorState.isOpen}
                onClose={() => setEditorState((prev) => ({ ...prev, isOpen: false }))}
                imageSrc={editorState.imageSrc}
                title={editorState.title}
                onSave={handleEditorSave}
            />
        </div>
    );
}

export default VariableMappingEditor;
