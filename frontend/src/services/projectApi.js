import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com";

// GET Projects
export const getProjects = async () => {
    return await axios.get(`${API}/projects`);
};

// ADD Project
export const addProject = async (projectData) => {
    return await axios.post(`${API}/projects`, projectData);
};

// UPDATE Project
export const updateProject = async (id, projectData) => {
    return await axios.put(`${API}/projects/${id}`, projectData);
};

// DELETE Project
export const deleteProject = async (id) => {
    return await axios.delete(`${API}/projects/${id}`);
};
