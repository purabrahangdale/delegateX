export const validateFormAnswers = (fields, answers) => {
    const errors = {};

    fields.forEach((field) => {
        const val = answers[field.id];
        
        // Required validation
        if (field.required) {
            if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0) || (typeof val === "boolean" && !val)) {
                errors[field.id] = `${field.label} is required`;
                return;
            }
        }

        // Format checks
        if (val) {
            if (field.type === "email") {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(val)) {
                    errors[field.id] = "Invalid email format";
                }
            } else if (field.type === "phone") {
                const phoneRegex = /^\+?[0-9\s-]{7,15}$/;
                if (!phoneRegex.test(val)) {
                    errors[field.id] = "Invalid phone number format";
                }
            } else if (field.type === "number") {
                if (isNaN(Number(val))) {
                    errors[field.id] = "Must be a valid number";
                }
            }
        }
    });

    return errors;
};
