import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// GET Forms
export const getForms = async () => {
    return await axios.get(`${API}/delegation/forms`);
};

// GET Form by ID
export const getFormById = async (id) => {
    return await axios.get(`${API}/delegation/forms/${id}`);
};

// CREATE or UPDATE Form
export const saveForm = async (formData) => {
    return await axios.post(`${API}/delegation/forms`, formData);
};

// SUBMIT Form Response
export const submitResponse = async (formId, answers, files = []) => {
    const data = new FormData();
    data.append("answers_str", JSON.stringify(answers));
    if (files && files.length > 0) {
        files.forEach((file) => {
            data.append("uploaded_files", file);
        });
    }
    return await axios.post(`${API}/delegation/forms/${formId}/submit`, data, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
};

// GET Responses
export const getResponses = async (formId = "") => {
    const url = formId ? `${API}/delegation/responses?formId=${formId}` : `${API}/delegation/responses`;
    return await axios.get(url);
};
