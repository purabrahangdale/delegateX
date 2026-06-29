import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com";

// GET Tasks
export const getTasks = async () => {
    return await axios.get(`${API}/tasks`);
};

// ADD Task
export const addTask = async (taskData) => {
    return await axios.post(`${API}/tasks`, taskData);
};

// UPDATE Task
export const updateTask = async (id, taskData) => {
    return await axios.put(`${API}/tasks/${id}`, taskData);
};

// DELETE Task
export const deleteTask = async (id) => {
    return await axios.delete(`${API}/tasks/${id}`);
};
