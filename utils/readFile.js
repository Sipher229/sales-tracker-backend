import fs from "fs/promises";

export async function readFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return data;
    } catch (error) {
        console.error("Error reading file:", filePath, error);
        throw error;
    }
}