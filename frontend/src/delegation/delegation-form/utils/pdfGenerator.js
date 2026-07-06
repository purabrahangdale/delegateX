const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const downloadPDF = (pdfPath, fileName = "delegation_response.pdf") => {
    if (!pdfPath) return;
    const fullUrl = pdfPath.startsWith("http") ? pdfPath : `${API}${pdfPath}`;
    
    const link = document.createElement("a");
    link.href = fullUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const printPDF = (pdfPath) => {
    if (!pdfPath) return;
    const fullUrl = pdfPath.startsWith("http") ? pdfPath : `${API}${pdfPath}`;
    
    const w = window.open(fullUrl);
    if (w) {
        w.focus();
        w.print();
    }
};
