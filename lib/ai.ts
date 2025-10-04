export async function getAiResponse(prompt: string): Promise<string> {
    if (prompt.includes("correctly answered")) {
        return '{"feedback_text": "Fantastic work! You nailed that problem and showed great problem-solving skills! Keep challenging yourself!"}';
    } else {
        return '{"feedback_text": "That was a good try! Remember to check your multiplication/division steps, as your answer is close but not quite right. You can do this!"}';
    }
}