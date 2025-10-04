import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { getAiResponse } from '../../../../lib/ai';

interface SubmissionData {
  sessionId: string;
  problemText: string;
  userAnswer: string;
}

interface AiFeedbackResponse {
  feedback_text: string;
}

export async function POST(req: Request) {
  const submissionData: SubmissionData = await req.json();

  const { sessionId, problemText, userAnswer: userAnswerString } = submissionData;
  const userAnswer = parseFloat(userAnswerString) || 0;
  let finalAnswer: number | null = null;
  let isCorrect = false;

  const { data: sessionData, error: sessionError } = await supabase
    .from('math_problem_sessions')
    .select('correct_answer')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    return NextResponse.json({
      feedback_text: "An error occurred while retrieving the problem details. Please try again.",
      is_correct: false,
    }, { status: 500 });
  }

  if (sessionData && sessionData.correct_answer !== undefined) {
    finalAnswer = parseFloat(sessionData.correct_answer as string);
    if (!isNaN(finalAnswer)) {
      isCorrect = Math.round(userAnswer) === finalAnswer;
    }
  } else {
    console.warn(`No correct answer found for session ID: ${sessionId}`);
    return NextResponse.json({
      feedback_text: "Could not find the correct answer for this problem. Please contact support.",
      is_correct: false,
    }, { status: 404 });
  }


  const finalAnswerForPrompt = finalAnswer !== null ? finalAnswer : 0; 
  

  const feedbackPrompt = isCorrect
    ? `The user correctly answered the following math problem: "${problemText}". Their answer was ${userAnswer}. Generate a congratulatory and encouraging feedback message for a Primary 5 student. The response must be ONLY a JSON object with a 'feedback_text' field.`
    : `The user answered ${userAnswer} for the math problem: "${problemText}". The correct answer is ${finalAnswerForPrompt}. Generate an encouraging, corrective, and personalized feedback message for a Primary 5 student. Gently point out the error without giving the full solution immediately. The response must be ONLY a JSON object with a 'feedback_text' field.`;

  let feedbackText = '';

  let aiResponseText = '';

  try {
    aiResponseText = await getAiResponse(feedbackPrompt);

    const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonString = jsonMatch[0];

      const parsedAiResponse = JSON.parse(jsonString) as AiFeedbackResponse;
      feedbackText = parsedAiResponse.feedback_text.replace(/\\"/g, '"');
    } else {
      feedbackText = isCorrect
        ? "That's correct! Excellent work. (AI parsing failed, using default feedback)"
        : `Incorrect. The correct answer is ${finalAnswerForPrompt}. (AI parsing failed, using default feedback)`;
    }
  } catch (error) {
    console.log("AI Feedback Generation Error:", error);
    feedbackText = isCorrect
      ? "That's correct! Excellent work. (AI service error, using default feedback)"
      : `Incorrect. The correct answer is ${finalAnswerForPrompt}. (AI service error, using default feedback)`;
  }
  const submissionToInsert = {
    session_id: sessionId,
    user_answer: userAnswer,
    is_correct: isCorrect,
    feedback_text: feedbackText,
  };

  const { data, error } = await supabase
    .from('math_problem_submissions')
    .insert([submissionToInsert])
    .select();

  if (error) {
    console.error("Supabase Save Error:", error);
  } else {
    console.log("Supabase Save Success:", data);
  }

  return NextResponse.json({
    feedback_text: feedbackText,
    is_correct: isCorrect,
  });
}