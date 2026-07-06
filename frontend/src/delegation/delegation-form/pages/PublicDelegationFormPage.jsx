import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FiCheckCircle, FiDownload, FiPrinter, FiSend } from "react-icons/fi";
import { getFormById, submitResponse } from "../api/delegationFormApi";
import DelegationFieldRenderer from "../components/DelegationFieldRenderer";
import { validateFormAnswers } from "../utils/formValidation";
import { downloadPDF, printPDF } from "../utils/pdfGenerator";
import { useToast } from "../../../context/ToastContext";

export default function PublicDelegationFormPage() {
    const { formId } = useParams();
    const { showToast } = useToast();
    const [form, setForm] = useState(null);
    const [answers, setAnswers] = useState({});
    const [fileValues, setFileValues] = useState({}); // Stores file blobs
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submittedResponse, setSubmittedResponse] = useState(null);

    useEffect(() => {
        if (formId) {
            loadForm();
        }
    }, [formId]);

    const loadForm = async () => {
        setLoading(true);
        let retries = 4;
        let delay = 2000;
        let loadedData = null;

        while (retries > 0) {
            try {
                const res = await getFormById(formId);
                const data = res.data && res.data.success !== undefined ? (res.data.success ? res.data.data : null) : res.data;
                if (data) {
                    loadedData = data;
                    break;
                }
            } catch (e) {
                console.warn(`Fetch attempt failed. Retries left: ${retries - 1}`, e);
                retries--;
                if (retries === 0) {
                    console.error("Failed to load public form after all retries:", e);
                    showToast("Failed to retrieve delegation form. It may not exist or might be inactive.", "error");
                } else {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay += 1500;
                }
            }
        }

        if (loadedData) {
            setForm(loadedData);
            
            // Pre-populate empty answers structure
            const initial = {};
            if (loadedData.fields && Array.isArray(loadedData.fields)) {
                loadedData.fields.forEach((f) => {
                    if (f.type === "checkbox") {
                        initial[f.id] = false;
                    } else {
                        initial[f.id] = "";
                    }
                });
            }
            setAnswers(initial);
        } else {
            setForm(null);
        }
        setLoading(false);
    };

    const handleFieldChange = (fieldId, type, val) => {
        if (type === "file") {
            setFileValues(prev => ({ ...prev, [fieldId]: val }));
            setAnswers(prev => ({ ...prev, [fieldId]: val ? val.name : "" }));
        } else {
            setAnswers(prev => ({ ...prev, [fieldId]: val }));
        }
        
        // Clear error as the user types
        if (errors[fieldId]) {
            setErrors(prev => ({ ...prev, [fieldId]: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form) return;

        // Perform validation
        const valErrors = validateFormAnswers(form.fields, answers);
        if (Object.keys(valErrors).length > 0) {
            setErrors(valErrors);
            showToast("Please correct the validation errors before submitting.", "error");
            return;
        }

        setSubmitting(true);
        try {
            // Gather uploaded files
            const filesList = Object.values(fileValues).filter(Boolean);
            
            const res = await submitResponse(formId, answers, filesList);
            const data = res.data && res.data.success !== undefined ? (res.data.success ? res.data.data : res.data) : res.data;
            setSubmittedResponse(data.response || data);
            showToast("Form details submitted successfully!");
        } catch (err) {
            console.error("Failed to submit form:", err);
            showToast("Failed to submit details. Please try again.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col gap-2 items-center justify-center text-slate-400 text-xs select-none">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-2" />
                <span className="font-semibold text-slate-350">Waking up secure client portal...</span>
                <span className="text-[10px] text-slate-500">Connecting to secure servers (this may take up to a minute)</span>
            </div>
        );
    }

    if (!form) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md text-center shadow-2xl space-y-4">
                    <h3 className="text-sm font-bold text-white font-display">Intake Form Not Found</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        The requested portal link is either expired, inactive, or invalid. Please check the URL and try again.
                    </p>
                </div>
            </div>
        );
    }

    // Success View
    if (submittedResponse) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-6 animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                        <FiCheckCircle size={24} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-white font-display tracking-tight">Submission Completed</h2>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                            Thank you for submitting your details for <strong>{form.title}</strong>. A copy of your response has been compiled into a professional document.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-4 border-t border-slate-800/60">
                        <button
                            onClick={() => downloadPDF(submittedResponse.pdfPath, `response_${submittedResponse.id}.pdf`)}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition cursor-pointer"
                        >
                            <FiDownload size={14} />
                            Get Document
                        </button>
                        <button
                            onClick={() => printPDF(submittedResponse.pdfPath)}
                            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                            <FiPrinter size={14} />
                            Print
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-12 px-4 select-none">
            {/* Branding Header */}
            <div className="flex items-center gap-2.5 mb-8">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-500/20">
                    D
                </div>
                <div>
                    <span className="font-display font-bold text-sm tracking-tight text-white leading-none block">DelegateX</span>
                    <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Client Intake Portal</p>
                </div>
            </div>

            {/* Main Form container */}
            <form
                onSubmit={handleSubmit}
                className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
            >
                {/* Simulated Portal Topbar */}
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center text-slate-500 text-[10px] font-bold select-none">
                    <span className="font-display tracking-tight text-slate-400">Secure Portal Submission</span>
                    <span className="bg-emerald-950/50 border border-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded text-[8px] tracking-wider uppercase font-semibold">
                        Encrypted Connection
                    </span>
                </div>

                {/* Form Fields */}
                <div className="p-6 md:p-8 space-y-6">
                    <div className="space-y-1">
                        <h1 className="text-base font-bold text-white font-display tracking-tight">{form.title}</h1>
                        {form.description && (
                            <p className="text-xs text-slate-400 leading-relaxed pt-0.5">{form.description}</p>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-800/60">
                        {form.fields && form.fields.map((field) => (
                            <DelegationFieldRenderer
                                key={field.id}
                                field={field}
                                value={field.type === "file" ? fileValues[field.id] : answers[field.id]}
                                onChange={(val) => handleFieldChange(field.id, field.type, val)}
                                error={errors[field.id]}
                            />
                        ))}
                    </div>
                </div>

                {/* Footer submit block */}
                <div className="p-6 bg-slate-950 border-t border-slate-850 flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/70 text-white px-6 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition cursor-pointer"
                    >
                        <FiSend size={13} />
                        {submitting ? "Submitting..." : "Submit Details"}
                    </button>
                </div>
            </form>
        </div>
    );
}
