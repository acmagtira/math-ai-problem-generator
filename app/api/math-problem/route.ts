import { GoogleGenAI } from "@google/genai";
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({});
export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();
        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                { role: "user", parts: [{ text: prompt }] }
            ],
        });
        return NextResponse.json(
            {
                text: response.text,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: 'Failed to generate content from Gemini API.' },
            { status: 500 }
        );
    }
}