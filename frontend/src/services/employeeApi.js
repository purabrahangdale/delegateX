import axios from "axios";

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com",
});


// GET EMPLOYEES

export const getEmployees = async () => {

    try {

        const response = await API.get("/employees");

        return response.data;

    } catch (error) {

        console.log("GET ERROR", error);

        return [];
    }
};


// ADD EMPLOYEE

export const addEmployee = async (employeeData) => {

    try {

        const response = await API.post(
            "/employees",
            employeeData
        );

        return response.data;

    } catch (error) {

        console.log("POST ERROR", error);
    }
};


// DELETE EMPLOYEE

export const deleteEmployee = async (id) => {

    try {

        await API.delete(`/employees/${id}`);

    } catch (error) {

        console.log("DELETE ERROR", error);
    }
};


// UPDATE EMPLOYEE

export const updateEmployee = async (id, data) => {

    try {

        const response = await API.put(
            `/employees/${id}`,
            data
        );

        return response.data;

    } catch (error) {

        console.log("UPDATE ERROR", error);
    }
};