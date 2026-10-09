import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { useToast } from "../../context/ToastContext";
import { contactsStorageKey, getActiveNumberId, LEGACY_CONTACTS_STORAGE_KEY } from "../services/whatsappApi";
import { useWhatsAppNumber } from "../context/WhatsAppNumberContext";
import {
    FiUploadCloud, FiFileText, FiCheckCircle, FiUsers, FiAlertTriangle,
    FiUserCheck, FiStar, FiClock, FiSearch, FiCheck, FiX, FiPlus, FiEye,
    FiEdit2, FiTrash2, FiPhone, FiMail, FiTag, FiDownload
} from "react-icons/fi";

const INITIAL_CONTACTS = [];

const DUMMY_PHONES = new Set([
    "+91-9876543210",
    "+91-9876543211",
    "+91-9876543212",
    "+91-9876543213",
    "+91-9876543214"
]);

const getInitialContacts = () => {
    try {
        // Contacts of the selected business number only (the page remounts when the number changes).
        const saved = localStorage.getItem(contactsStorageKey());
        if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed.filter(c => !DUMMY_PHONES.has(c.phone));
            }
        }
    } catch (err) {
        console.error("Failed to load contacts from localStorage", err);
    }
    return [];
};

const readLegacyContacts = () => {
    if (contactsStorageKey() === LEGACY_CONTACTS_STORAGE_KEY) return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(LEGACY_CONTACTS_STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter(c => !DUMMY_PHONES.has(c.phone)) : [];
    } catch {
        return [];
    }
};

function WhatsAppContacts() {
    const { showToast } = useToast();
    const location = useLocation();
    const numberCtx = useWhatsAppNumber();
    const [contacts, setContacts] = useState(getInitialContacts);
    const [storageKey] = useState(contactsStorageKey);
    const legacyFlagKey = `${LEGACY_CONTACTS_STORAGE_KEY}:imported:${getActiveNumberId()}`;
    const [legacyContacts, setLegacyContacts] = useState(() => (localStorage.getItem(legacyFlagKey) ? [] : readLegacyContacts()));

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(contacts));
        } catch (err) {
            console.error("Failed to save contacts to localStorage", err);
        }
    }, [contacts, storageKey]);

    // Contacts saved before multi-number support are copied into this number only on request.
    const importLegacyContacts = () => {
        const phones = new Set(contacts.map(c => c.phone));
        const added = legacyContacts.filter(c => !phones.has(c.phone));
        setContacts(prev => [...prev, ...added]);
        localStorage.setItem(legacyFlagKey, new Date().toISOString());
        setLegacyContacts([]);
        showToast(`${added.length} earlier contact(s) added to ${numberCtx?.selected?.display_name || "this number"}.`, "success");
    };
    const dismissLegacyContacts = () => {
        localStorage.setItem(legacyFlagKey, "dismissed");
        setLegacyContacts([]);
    };

    const [duplicatesCount, setDuplicatesCount] = useState(45);
    const [importedCount, setImportedCount] = useState(0);

    // Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importModalDragActive, setImportModalDragActive] = useState(false);
    const [parsedBatch, setParsedBatch] = useState(null);
    const [isParsing, setIsParsing] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get("openImport") === "true" || params.get("import") === "true") {
            setShowImportModal(true);
        }
    }, [location.search]);

    const [searchQuery, setSearchQuery] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [editingContact, setEditingContact] = useState(null);

    // Form Fields
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [category, setCategory] = useState("Regular Contact");
    const [status, setStatus] = useState("Valid");
    const [notes, setNotes] = useState("");
    const [formErrors, setFormErrors] = useState({});

    const resetForm = () => {
        setName("");
        setPhone("");
        setEmail("");
        setCategory("Regular Contact");
        setStatus("Valid");
        setNotes("");
        setFormErrors({});
        setEditingContact(null);
    };

    const validateForm = () => {
        const errors = {};
        const cleanName = name.trim();
        const cleanPhone = phone.trim();

        if (!cleanName) {
            errors.name = "Contact Name is required.";
        }

        if (!cleanPhone) {
            errors.phone = "Phone Number is required.";
        } else {
            // E.164 / International Phone Regex validation
            const phoneRegex = /^(\+?\d{1,4}[\s-]?)?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,9}$/;
            if (!phoneRegex.test(cleanPhone)) {
                errors.phone = "Please enter a valid phone number (e.g. +91 98765 43210).";
            } else {
                // Check duplicate phone number
                const isDuplicate = contacts.some(c => 
                    c.phone.replace(/[\s-]/g, "") === cleanPhone.replace(/[\s-]/g, "") &&
                    (!editingContact || c.id !== editingContact.id)
                );
                if (isDuplicate) {
                    errors.phone = "This phone number already exists in your contacts.";
                }
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveContact = (e) => {
        e?.preventDefault();
        if (!validateForm()) {
            const firstErr = Object.values(formErrors)[0] || "Please fix validation errors.";
            if (showToast) showToast(firstErr, "error");
            return;
        }

        if (editingContact) {
            // Update existing contact
            setContacts(prev => prev.map(c => c.id === editingContact.id ? {
                ...c,
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                category,
                status,
                notes: notes.trim()
            } : c));
            if (showToast) showToast("Contact updated successfully", "success");
        } else {
            // Create new contact at top of directory
            const newContact = {
                id: Date.now(),
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                category,
                status,
                notes: notes.trim(),
                lastContact: "Just Now"
            };
            setContacts(prev => [newContact, ...prev]);
            if (showToast) showToast("Contact added successfully", "success");
        }

        setShowAddModal(false);
        resetForm();
    };

    const handleEdit = (c) => {
        setEditingContact(c);
        setName(c.name);
        setPhone(c.phone);
        setEmail(c.email || "");
        setCategory(c.category || "Regular Contact");
        setStatus(c.status || "Valid");
        setNotes(c.notes || "");
        setShowAddModal(true);
    };

    const handleDelete = (id) => {
        if (window.confirm("Are you sure you want to delete this contact?")) {
            setContacts(prev => prev.filter(c => c.id !== id));
            if (showToast) showToast("Contact deleted", "info");
        }
    };

    const downloadSampleCSV = () => {
        const sampleHeaders = "Name,Phone,Email,Category,Status,Notes\n";
        const sampleRows = [
            "Aarav Patel,+91 98765 43210,aarav@example.com,VIP Client,Valid,Interested in real estate investment",
            "Priya Sharma,+91 91234 56789,priya@example.com,Recently Contacted,Valid,Scheduled consultation",
            "Rohan Mehta,+91 99887 76655,rohan@example.com,Regular Contact,Valid,Enquiry regarding project timeline",
            "Neha Gupta,+91 97654 32109,neha@example.com,VIP Client,Valid,High priority client",
            "Vikram Singh,+91 96543 21098,vikram@example.com,Regular Contact,DND,Requested DND on weekends"
        ].join("\n");

        const blob = new Blob([sampleHeaders + sampleRows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "sample_whatsapp_contacts.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        if (showToast) showToast("Sample CSV template downloaded", "success");
    };

    const parseContactsFromFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const firstSheetName = workbook.SheetNames[0];
                    if (!firstSheetName) {
                        throw new Error("No sheet found in file.");
                    }
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                    if (!rawRows || rawRows.length === 0) {
                        throw new Error("The uploaded file contains no data rows.");
                    }

                    const parsed = [];
                    let duplicateCount = 0;
                    let invalidCount = 0;
                    const seenPhones = new Set(contacts.map(c => c.phone.replace(/[\s-]/g, "")));

                    for (let i = 0; i < rawRows.length; i++) {
                        const row = rawRows[i];
                        const nameKey = Object.keys(row).find(k => /^(name|full\s*name|contact\s*name|customer\s*name|client\s*name)/i.test(k.trim()));
                        const phoneKey = Object.keys(row).find(k => /^(phone|phone\s*number|mobile|mobile\s*number|contact\s*number|wa\s*number|whatsapp)/i.test(k.trim()));
                        const emailKey = Object.keys(row).find(k => /^(email|e-mail|mail)/i.test(k.trim()));
                        const categoryKey = Object.keys(row).find(k => /^(category|group|type|tag)/i.test(k.trim()));
                        const statusKey = Object.keys(row).find(k => /^(status|wa\s*status|whatsapp\s*status)/i.test(k.trim()));
                        const notesKey = Object.keys(row).find(k => /^(notes|note|remark|remarks|comments)/i.test(k.trim()));

                        const rawName = (nameKey ? row[nameKey] : Object.values(row)[0] || "").toString().trim();
                        const rawPhone = (phoneKey ? row[phoneKey] : Object.values(row)[1] || "").toString().trim();
                        const rawEmail = (emailKey ? row[emailKey] : "").toString().trim();
                        const rawCategory = (categoryKey ? row[categoryKey] : "Recently Imported").toString().trim() || "Recently Imported";
                        const rawStatus = (statusKey ? row[statusKey] : "Valid").toString().trim() || "Valid";
                        const rawNotes = (notesKey ? row[notesKey] : "").toString().trim();

                        if (!rawName && !rawPhone) {
                            continue;
                        }

                        let cleanPhone = rawPhone.replace(/[^\d+]/g, "");
                        if (!cleanPhone.startsWith("+") && cleanPhone.length === 10) {
                            cleanPhone = `+91${cleanPhone}`;
                        } else if (!cleanPhone.startsWith("+") && cleanPhone.length > 10) {
                            cleanPhone = `+${cleanPhone}`;
                        }

                        if (cleanPhone.length < 8) {
                            invalidCount++;
                            continue;
                        }

                        const normalizedPhoneKey = cleanPhone.replace(/[\s-]/g, "");
                        if (seenPhones.has(normalizedPhoneKey)) {
                            duplicateCount++;
                            continue;
                        }

                        seenPhones.add(normalizedPhoneKey);

                        parsed.push({
                            id: Date.now() + i + Math.floor(Math.random() * 1000),
                            name: rawName || `Contact ${parsed.length + 1}`,
                            phone: cleanPhone,
                            email: rawEmail || "",
                            category: ["VIP Client", "Recently Contacted", "Recently Imported", "Regular Contact"].includes(rawCategory) ? rawCategory : "Recently Imported",
                            status: /dnd/i.test(rawStatus) ? "DND" : "Valid",
                            notes: rawNotes || "Imported via file",
                            lastContact: "Just Now"
                        });
                    }

                    resolve({
                        fileName: file.name,
                        validContacts: parsed,
                        duplicateCount,
                        invalidCount,
                        totalRows: rawRows.length
                    });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    };

    const handleModalFileSelect = async (e) => {
        const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
        if (!file) return;

        setIsParsing(true);
        try {
            const result = await parseContactsFromFile(file);
            setParsedBatch(result);
        } catch (err) {
            console.error("Error parsing contacts:", err);
            if (showToast) showToast(err.message || "Failed to parse file. Please upload a valid CSV or Excel file.", "error");
        } finally {
            setIsParsing(false);
        }
    };

    const handleConfirmImport = () => {
        if (!parsedBatch || parsedBatch.validContacts.length === 0) {
            if (showToast) showToast("No valid contacts to import", "error");
            return;
        }

        const count = parsedBatch.validContacts.length;
        setContacts(prev => [...parsedBatch.validContacts, ...prev]);
        setDuplicatesCount(prev => prev + (parsedBatch.duplicateCount || 0));
        setImportedCount(count);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 4000);

        if (showToast) {
            showToast(`Successfully imported ${count} contact${count > 1 ? "s" : ""}!`, "success");
        }

        setShowImportModal(false);
        setParsedBatch(null);
    };

    const handleFileUpload = async (e) => {
        const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const result = await parseContactsFromFile(file);
            if (result.validContacts.length === 0) {
                if (showToast) {
                    showToast(`No new valid contacts found (${result.duplicateCount} duplicates, ${result.invalidCount} invalid rows)`, "error");
                }
                return;
            }

            const count = result.validContacts.length;
            setContacts(prev => [...result.validContacts, ...prev]);
            setDuplicatesCount(prev => prev + (result.duplicateCount || 0));
            setImportedCount(count);
            setUploadSuccess(true);
            setTimeout(() => setUploadSuccess(false), 4000);

            if (showToast) {
                showToast(`Successfully imported ${count} contact${count > 1 ? "s" : ""}!`, "success");
            }
        } catch (err) {
            console.error("Upload error:", err);
            if (showToast) {
                showToast(err.message || "Failed to process file.", "error");
            }
        } finally {
            setUploading(false);
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="contacts" searchQuery={searchQuery} onSearchChange={setSearchQuery} onImportContacts={() => setShowImportModal(true)} />

            {legacyContacts.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-900">
                    <FiUsers className="shrink-0 text-amber-600" size={16} />
                    <p className="flex-1">
                        <strong>{legacyContacts.length} contact(s)</strong> were saved in this browser before multi-number support.
                        Contacts are now kept separately for each WhatsApp number — add them to <strong>{numberCtx?.selected?.display_name || "this number"}</strong> only if they belong to it.
                    </p>
                    <button type="button" onClick={importLegacyContacts} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer">Add to this number</button>
                    <button type="button" onClick={dismissLegacyContacts} className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-300 font-semibold cursor-pointer">Not for this number</button>
                </div>
            )}

            {/* Stat Counters Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: "Total Contacts", val: contacts.length, color: "text-slate-800 bg-white" },
                    { label: "Valid WhatsApp", val: contacts.filter(c => c.status === "Valid").length, color: "text-emerald-600 bg-emerald-50/60 border-emerald-100" },
                    { label: "VIP Contacts", val: contacts.filter(c => c.category === "VIP Client").length, color: "text-indigo-600 bg-indigo-50/60 border-indigo-100" },
                    { label: "Recently Contacted", val: contacts.filter(c => c.category === "Recently Contacted").length, color: "text-blue-600 bg-blue-50/60 border-blue-100" },
                    { label: "Duplicates Filtered", val: duplicatesCount, color: "text-amber-600 bg-amber-50/60 border-amber-100" },
                    { label: "DND Excluded", val: contacts.filter(c => c.status === "DND").length, color: "text-rose-600 bg-rose-50/60 border-rose-100" },
                ].map((stat, i) => (
                    <div key={i} className={`p-4 border rounded-2xl shadow-2xs hover:shadow-xs transition ${stat.color}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{stat.label}</span>
                        <span className="text-xl font-extrabold font-display block mt-1">{stat.val}</span>
                    </div>
                ))}
            </div>

            {/* Top Toolbar Actions */}
            <div className="flex items-center justify-between bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 font-display">Contact Management</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Manage VIP clients, imported contacts, and WhatsApp engagement status.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowAddModal(true); }}
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                    <FiPlus size={14} /> Add Contact
                </button>
            </div>

            {/* Contact Directory Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900 font-display">Contact Directory ({filteredContacts.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Name</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Status</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Activity</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContacts.length > 0 ? filteredContacts.map((c) => (
                                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 text-xs font-bold text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                                                {c.name[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <span>{c.name}</span>
                                                {c.email && <span className="text-[9px] text-slate-400 block font-normal">{c.email}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">{c.phone}</td>
                                    <td className="px-4 py-3 text-xs">
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">{c.category}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${c.status === "Valid" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] text-slate-400">{c.lastContact}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button onClick={() => setShowDetailModal(c)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer" title="View Details">
                                                <FiEye size={13} />
                                            </button>
                                            <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition cursor-pointer" title="Edit Contact">
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Delete Contact">
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                                        No contacts matching your search criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drag & Drop Enterprise Importer Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                    <FiUploadCloud className="text-emerald-500" size={18} />
                    Enterprise Contact Importer (CSV / Excel)
                </h3>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e); }}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${dragActive ? "border-emerald-500 bg-emerald-50/30" : "border-slate-200 bg-slate-50/40 hover:bg-slate-50"}`}
                >
                    {uploading ? (
                        <div className="space-y-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
                                <FiUploadCloud size={24} />
                            </div>
                            <p className="text-xs font-bold text-slate-700">Validating phone numbers & cleaning DND contacts...</p>
                        </div>
                    ) : uploadSuccess ? (
                        <div className="space-y-2">
                            <FiCheckCircle className="text-emerald-500 mx-auto" size={36} />
                            <p className="text-xs font-bold text-emerald-700">Successfully Imported {importedCount > 0 ? importedCount : 150} Contacts!</p>
                        </div>
                    ) : (
                        <>
                            <FiUploadCloud size={36} className="text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-700">Drag & Drop your CSV or XLSX file here</p>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Automatic phone format normalization, duplicate filtering & DND detection.</p>
                            <label className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer">
                                Browse Files
                                <input type="file" onChange={handleFileUpload} accept=".csv, .xlsx" className="hidden" />
                            </label>
                        </>
                    )}
                </div>
            </div>

            {/* ADD / EDIT CONTACT MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowAddModal(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200/90 animate-slide-up space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display">
                                {editingContact ? "Edit Contact" : "Add New WhatsApp Contact"}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
                        </div>

                        <form onSubmit={handleSaveContact} className="space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Contact Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Full Name (e.g. Rahul Sharma)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${formErrors.name ? "border-rose-300" : "border-slate-200"}`}
                                />
                                {formErrors.name && <p className="text-[10px] text-rose-500 font-semibold mt-1">{formErrors.name}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        Phone Number <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. +91 98765 43210"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 border rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${formErrors.phone ? "border-rose-300" : "border-slate-200"}`}
                                    />
                                    {formErrors.phone && <p className="text-[10px] text-rose-500 font-semibold mt-1">{formErrors.phone}</p>}
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        Email (Optional)
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="rahul@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                                    >
                                        <option value="VIP Client">VIP Client</option>
                                        <option value="Recently Contacted">Recently Contacted</option>
                                        <option value="Recently Imported">Recently Imported</option>
                                        <option value="Regular Contact">Regular Contact</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">WhatsApp Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                                    >
                                        <option value="Valid">Valid WhatsApp Number</option>
                                        <option value="DND">DND (Do Not Disturb)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes (Optional)</label>
                                <textarea
                                    placeholder="Add any specific context or notes..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl resize-none font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#25D366] hover:bg-emerald-600 rounded-xl shadow-xs transition cursor-pointer">
                                    {editingContact ? "Update Contact" : "Save Contact"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {showDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowDetailModal(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display">Contact Details</h3>
                            <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p><span className="text-slate-400 font-medium">Name:</span> <strong className="text-slate-800">{showDetailModal.name}</strong></p>
                            <p><span className="text-slate-400 font-medium">Phone:</span> <strong className="text-slate-800 font-mono">{showDetailModal.phone}</strong></p>
                            <p><span className="text-slate-400 font-medium">Email:</span> <strong className="text-slate-800">{showDetailModal.email || "N/A"}</strong></p>
                            <p><span className="text-slate-400 font-medium">Category:</span> <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold">{showDetailModal.category}</span></p>
                            <p><span className="text-slate-400 font-medium">WhatsApp Status:</span> <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">{showDetailModal.status}</span></p>
                            {showDetailModal.notes && <p><span className="text-slate-400 font-medium">Notes:</span> <span className="text-slate-700 italic block mt-0.5 p-2 bg-slate-50 rounded-lg">{showDetailModal.notes}</span></p>}
                        </div>
                        <button onClick={() => setShowDetailModal(null)} className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold">Close</button>
                    </div>
                </div>
            )}

            {/* IMPORT CONTACTS MODAL */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => { setShowImportModal(false); setParsedBatch(null); }}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl border border-slate-200/90 animate-slide-up space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <FiUsers size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 font-display">Import Contacts</h3>
                                    <p className="text-[11px] text-slate-400">Upload CSV or Excel file to batch import WhatsApp contacts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowImportModal(false); setParsedBatch(null); }}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Download Sample Template bar */}
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                            <div>
                                <p className="text-xs font-semibold text-slate-700">Need a format guide?</p>
                                <p className="text-[10px] text-slate-400">Supports headers: Name, Phone, Email, Category, Notes</p>
                            </div>
                            <button
                                type="button"
                                onClick={downloadSampleCSV}
                                className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                            >
                                <FiDownload size={13} className="text-emerald-600" />
                                <span>Sample Template</span>
                            </button>
                        </div>

                        {/* Parsing Spinner */}
                        {isParsing ? (
                            <div className="py-12 flex flex-col items-center justify-center space-y-3">
                                <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                                <p className="text-xs font-semibold text-slate-600">Reading and validating contacts...</p>
                            </div>
                        ) : parsedBatch ? (
                            /* Preview & Confirmation state */
                            <div className="space-y-3.5">
                                <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FiCheckCircle className="text-emerald-600" size={18} />
                                        <div>
                                            <p className="text-xs font-bold text-emerald-900">{parsedBatch.fileName}</p>
                                            <p className="text-[10px] text-emerald-700">Found {parsedBatch.totalRows} row(s) in file</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setParsedBatch(null)}
                                        className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                    >
                                        Change File
                                    </button>
                                </div>

                                {/* Stats badges */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2.5 bg-emerald-50 border border-emerald-200/70 rounded-xl text-center">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase block">Valid Contacts</span>
                                        <span className="text-lg font-extrabold text-emerald-700">{parsedBatch.validContacts.length}</span>
                                    </div>
                                    <div className="p-2.5 bg-amber-50 border border-amber-200/70 rounded-xl text-center">
                                        <span className="text-[10px] font-bold text-amber-600 uppercase block">Duplicates</span>
                                        <span className="text-lg font-extrabold text-amber-700">{parsedBatch.duplicateCount}</span>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Invalid / Empty</span>
                                        <span className="text-lg font-extrabold text-slate-700">{parsedBatch.invalidCount}</span>
                                    </div>
                                </div>

                                {/* Preview table */}
                                {parsedBatch.validContacts.length > 0 ? (
                                    <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase">
                                            Preview (first {Math.min(parsedBatch.validContacts.length, 5)} rows)
                                        </div>
                                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
                                            {parsedBatch.validContacts.slice(0, 5).map((c, idx) => (
                                                <div key={idx} className="p-2.5 flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-slate-800">{c.name}</p>
                                                        <p className="text-[11px] text-slate-400 font-mono">{c.phone}</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                        {c.category}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                                        No new valid contacts found in this file (all were either duplicates or missing valid phone numbers).
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setShowImportModal(false); setParsedBatch(null); }}
                                        className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmImport}
                                        disabled={parsedBatch.validContacts.length === 0}
                                        className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#25D366] hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition cursor-pointer"
                                    >
                                        Import {parsedBatch.validContacts.length} Contacts
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* File Drop Zone */
                            <div className="space-y-4">
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setImportModalDragActive(true); }}
                                    onDragLeave={() => setImportModalDragActive(false)}
                                    onDrop={(e) => { e.preventDefault(); setImportModalDragActive(false); handleModalFileSelect(e); }}
                                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                                        importModalDragActive ? "border-emerald-500 bg-emerald-50/40" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                                    }`}
                                >
                                    <FiUploadCloud size={40} className="text-slate-300 mb-2" />
                                    <p className="text-xs font-bold text-slate-800">Drag & Drop your CSV or XLSX file here</p>
                                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Supports Excel (.xlsx, .xls) and CSV (.csv) formats</p>
                                    <label className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-1.5">
                                        <FiUploadCloud size={14} />
                                        <span>Browse Files</span>
                                        <input
                                            type="file"
                                            onChange={handleModalFileSelect}
                                            accept=".csv, .xlsx, .xls"
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowImportModal(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppContacts;
