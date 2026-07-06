import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com";

// GET Forms
export const getForms = async () => {
    return await axios.get(`${API_BASE_URL}/delegation/forms`);
};

// GET Form by ID
export const getFormById = async (id) => {
    return await axios.get(`${API_BASE_URL}/delegation/forms/${id}`);
};

// CREATE or UPDATE Form
export const saveForm = async (formData) => {
    return await axios.post(`${API_BASE_URL}/delegation/forms`, formData);
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
    return await axios.post(`${API_BASE_URL}/delegation/forms/${formId}/submit`, data, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
};

// GET Responses
export const getResponses = async (formId = "") => {
    const url = formId ? `${API_BASE_URL}/delegation/responses?formId=${formId}` : `${API_BASE_URL}/delegation/responses`;
    return await axios.get(url);
};
