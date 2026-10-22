import { useState, useEffect, useRef, useCallback } from "react";
import {
    FiX, FiRotateCw, FiRotateCcw, FiZoomIn, FiZoomOut,
    FiCheck, FiRefreshCw, FiCrop, FiSun, FiSliders,
    FiUploadCloud, FiAlertCircle
} from "react-icons/fi";
import { uploadWhatsAppMedia } from "../services/whatsappApi";

/**
 * ImageEditorModal - A lightweight, interactive in-browser image editor
 * Allows cropping (with preset WhatsApp ratios like 16:9, 1:1, 4:3), zooming, panning,
 * rotating (90° steps), horizontal flipping, brightness/contrast adjustments,
 * and saving/uploading directly to WhatsApp media storage.
 */
export default function ImageEditorModal({
    isOpen,
    onClose,
    imageSrc,
    onSave,
    title = "Edit Header Image",
}) {
    const [currentSrc, setCurrentSrc] = useState(imageSrc || "");
    const [imageLoaded, setImageLoaded] = useState(false);
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
    const [aspectRatio, setAspectRatio] = useState("16:9"); // "16:9", "1:1", "4:3", "original", "free"
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
    const [flipH, setFlipH] = useState(false);
    const [brightness, setBrightness] = useState(100); // 50 - 150%
    const [contrast, setContrast] = useState(100); // 50 - 150%
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [saving, setSaving] = useState(false);
    const [corsError, setCorsError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const fileInputRef = useRef(null);
    const viewportRef = useRef(null);
    const imgRef = useRef(null);

    // Reset or initialize state when modal opens or imageSrc changes
    useEffect(() => {
        if (isOpen) {
            setCurrentSrc(imageSrc || "");
            setZoom(1);
            setRotation(0);
            setFlipH(false);
            setBrightness(100);
            setContrast(100);
            setPan({ x: 0, y: 0 });
            setCorsError(false);
            setErrorMessage("");
            setImageLoaded(false);
        }
    }, [isOpen, imageSrc]);

    // Handle escape key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !saving) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, saving, onClose]);

    if (!isOpen) return null;

    const handleImageLoad = (e) => {
        const { naturalWidth, naturalHeight } = e.target;
        setNaturalSize({ width: naturalWidth, height: naturalHeight });
        setImageLoaded(true);
        setCorsError(false);
    };

    const handleImageError = () => {
        setCorsError(true);
        setErrorMessage("Could not load image preview. You can upload an image file directly from your computer.");
    };

    // Replace image with a local file
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setErrorMessage("Please select a valid image file (JPG, PNG, WebP).");
            return;
        }
        const localUrl = URL.createObjectURL(file);
        setCurrentSrc(localUrl);
        setZoom(1);
        setRotation(0);
        setFlipH(false);
        setPan({ x: 0, y: 0 });
        setBrightness(100);
        setContrast(100);
        setCorsError(false);
        setErrorMessage("");
    };

    // Rotate 90 degrees clockwise
    const handleRotateCw = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    // Rotate 90 degrees counter-clockwise
    const handleRotateCcw = () => {
        setRotation((prev) => (prev + 270) % 360);
    };

    // Reset all adjustments
    const handleReset = () => {
        setZoom(1);
        setRotation(0);
        setFlipH(false);
        setBrightness(100);
        setContrast(100);
        setPan({ x: 0, y: 0 });
        setAspectRatio("16:9");
    };

    // Mouse drag / Pan handlers
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch handlers for mobile / touchpads
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - pan.x,
                y: e.touches[0].clientY - pan.y,
            });
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        setPan({
            x: e.touches[0].clientX - dragStart.x,
            y: e.touches[0].clientY - dragStart.y,
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    // Compute aspect ratio in numeric terms
    const getRatioValue = () => {
        if (aspectRatio === "16:9") return 16 / 9;
        if (aspectRatio === "1:1") return 1;
        if (aspectRatio === "4:3") return 4 / 3;
        if (aspectRatio === "original" && naturalSize.width && naturalSize.height) {
            return naturalSize.width / naturalSize.height;
        }
        return 16 / 9; // default fallback
    };

    // Save and export edited image to canvas, upload to server, and return URL
    const handleSave = async () => {
        if (!currentSrc) return;
        setSaving(true);
        setErrorMessage("");

        try {
            // Load image into an HTML Image element with crossOrigin
            const img = new Image();
            img.crossOrigin = "anonymous";

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error("Image failed to load for export"));
                img.src = currentSrc;
            });

            // Calculate output canvas dimensions
            const ratio = getRatioValue();
            const outWidth = 1280; // High resolution standard WhatsApp header
            const outHeight = Math.round(outWidth / ratio);

            const canvas = document.createElement("canvas");
            canvas.width = outWidth;
            canvas.height = outHeight;
            const ctx = canvas.getContext("2d");

            if (!ctx) throw new Error("Could not initialize 2D canvas context");

            // Background fill
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, outWidth, outHeight);

            // Apply filter adjustments
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

            // Transform origin: center of output canvas
            ctx.translate(outWidth / 2, outHeight / 2);

            // Scale factor between viewport and output canvas
            const viewport = viewportRef.current;
            const boxWidth = viewport ? viewport.clientWidth : 500;
            const scaleFactor = outWidth / boxWidth;

            // Apply Pan
            ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

            // Apply Rotation
            ctx.rotate((rotation * Math.PI) / 180);

            // Apply Flip
            ctx.scale(flipH ? -1 : 1, 1);

            // Determine base drawing dimensions (cover)
            const isRotated90 = rotation === 90 || rotation === 270;
            const imgW = isRotated90 ? img.naturalHeight : img.naturalWidth;
            const imgH = isRotated90 ? img.naturalWidth : img.naturalHeight;

            const scaleCover = Math.max(outWidth / imgW, outHeight / imgH) * zoom;
            const drawW = img.naturalWidth * scaleCover;
            const drawH = img.naturalHeight * scaleCover;

            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

            // Convert canvas to Blob
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    (b) => {
                        if (b) resolve(b);
                        else reject(new Error("Canvas export failed (tainted canvas or memory error)"));
                    },
                    "image/jpeg",
                    0.92
                );
            });

            // Convert to File and upload
            const filename = `edited_header_${Date.now()}.jpg`;
            const file = new File([blob], filename, { type: "image/jpeg" });

            const uploadRes = await uploadWhatsAppMedia(file);
            if (!uploadRes?.url) throw new Error("Upload response did not return a valid URL");

            onSave(uploadRes.url);
            onClose();
        } catch (err) {
            console.error("Save edited image error:", err);
            const msg = String(err?.message || "");
            if (msg.includes("tainted") || msg.includes("SecurityError") || msg.includes("crossOrigin")) {
                setCorsError(true);
                setErrorMessage(
                    "The current image is hosted on an external server that prevents canvas editing. Please click 'Choose File from Computer' below to upload and edit your image locally without restrictions."
                );
            } else {
                setErrorMessage(err.message || "Failed to process and upload edited image.");
            }
        } finally {
            setSaving(false);
        }
    };

    const ratio = getRatioValue();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <FiCrop size={15} />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-800 font-display">{title}</h3>
                            <p className="text-[10px] text-slate-400">Crop, zoom, rotate and adjust before attaching to template</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    >
                        <FiX size={16} />
                    </button>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                    <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] flex items-start gap-2 shrink-0">
                        <FiAlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                        <div className="flex-1">
                            <p>{errorMessage}</p>
                            {corsError && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-1 inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                >
                                    <FiUploadCloud size={12} /> Choose Image from Computer
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Editor Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Viewport & Interactive Image Area */}
                    <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl p-3 min-h-[260px] relative select-none">
                        {currentSrc ? (
                            <div
                                ref={viewportRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                style={{
                                    width: "100%",
                                    maxWidth: "480px",
                                    aspectRatio: `${ratio}`,
                                    cursor: isDragging ? "grabbing" : "grab",
                                }}
                                className="relative overflow-hidden rounded-lg border-2 border-white/20 bg-slate-950 shadow-inner flex items-center justify-center"
                            >
                                {/* Rule of thirds grid overlay */}
                                <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 opacity-30">
                                    <div className="border-r border-b border-white/50" />
                                    <div className="border-r border-b border-white/50" />
                                    <div className="border-b border-white/50" />
                                    <div className="border-r border-b border-white/50" />
                                    <div className="border-r border-b border-white/50" />
                                    <div className="border-b border-white/50" />
                                    <div className="border-r border-white/50" />
                                    <div className="border-r border-white/50" />
                                    <div />
                                </div>

                                {/* Transformed Image Preview */}
                                <img
                                    ref={imgRef}
                                    src={currentSrc}
                                    alt="Editor preview"
                                    crossOrigin="anonymous"
                                    onLoad={handleImageLoad}
                                    onError={handleImageError}
                                    draggable={false}
                                    style={{
                                        position: "absolute",
                                        left: "50%",
                                        top: "50%",
                                        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${flipH ? -zoom : zoom}, ${zoom})`,
                                        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                                        transition: isDragging ? "none" : "transform 0.1s ease-out",
                                        maxWidth: "none",
                                        maxHeight: "none",
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                    }}
                                />

                                {/* Drag hint */}
                                <div className="absolute bottom-1.5 right-2 z-10 pointer-events-none text-[9px] text-white/60 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded">
                                    Drag to reposition · Scroll to zoom
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-white/50 text-xs">
                                <p>No image loaded</p>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
                                >
                                    <FiUploadCloud size={13} /> Select Image
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Toolbar Controls */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-3 text-xs">
                        {/* Aspect Ratio Presets */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aspect Ratio</span>
                            <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-lg text-[11px]">
                                {[
                                    { key: "16:9", label: "16:9 (Header)" },
                                    { key: "1:1", label: "1:1 (Square)" },
                                    { key: "4:3", label: "4:3" },
                                    { key: "original", label: "Original" },
                                ].map((opt) => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setAspectRatio(opt.key)}
                                        className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${aspectRatio === opt.key
                                                ? "bg-slate-900 text-white shadow-2xs"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Zoom & Rotation Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                            {/* Zoom Slider */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                    <span className="flex items-center gap-1"><FiZoomIn size={12} /> Zoom ({zoom.toFixed(1)}x)</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(1))))}
                                            className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        >
                                            <FiZoomOut size={10} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.2).toFixed(1))))}
                                            className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        >
                                            <FiZoomIn size={10} />
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.05"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>

                            {/* Rotation & Flip */}
                            <div className="space-y-1">
                                <span className="text-[11px] text-slate-600 block">Orientation ({rotation}°)</span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleRotateCcw}
                                        title="Rotate 90° CCW"
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer text-[11px]"
                                    >
                                        <FiRotateCcw size={12} /> -90°
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRotateCw}
                                        title="Rotate 90° CW"
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer text-[11px]"
                                    >
                                        <FiRotateCw size={12} /> +90°
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFlipH((f) => !f)}
                                        title="Flip Horizontal"
                                        className={`px-2.5 py-1.5 border rounded-lg font-semibold transition cursor-pointer text-[11px] ${flipH ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                            }`}
                                    >
                                        Flip
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Brightness & Contrast Adjustments */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                    <span className="flex items-center gap-1"><FiSun size={12} /> Brightness ({brightness}%)</span>
                                </div>
                                <input
                                    type="range"
                                    min="60"
                                    max="140"
                                    step="5"
                                    value={brightness}
                                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                    <span className="flex items-center gap-1"><FiSliders size={12} /> Contrast ({contrast}%)</span>
                                </div>
                                <input
                                    type="range"
                                    min="60"
                                    max="140"
                                    step="5"
                                    value={contrast}
                                    onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Reset & Replace File */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                            >
                                <FiUploadCloud size={13} /> Choose different file
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                                <FiRefreshCw size={11} /> Reset adjustments
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/70 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !currentSrc}
                        className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#25D366] hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-40"
                    >
                        {saving ? (
                            <>
                                <FiRefreshCw size={13} className="animate-spin" /> Saving & Uploading...
                            </>
                        ) : (
                            <>
                                <FiCheck size={14} /> Apply & Save Image
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
