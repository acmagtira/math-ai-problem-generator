'use client'

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

interface MathProblem {
  problem_text: string
  correct_answer: number 
}
const FIXED_PROMPT = "Generate a single math word problem suitable for a Primary 5 student. The answer must be a whole number, and the problem must be parsable as a JSON object with 'problem_text' (string) and 'final_answer' (number) keys."

export default function Home() {
  const [problem, setProblem] = useState<MathProblem | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const parseProblemFromResponse = (text: string): MathProblem | null => {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        const cleanedString = jsonString.replace(/(\r\n|\n|\r)/gm, "");

        const parsedData = JSON.parse(cleanedString);
        return {
          problem_text: parsedData.problem_text,
          correct_answer: parsedData.final_answer || parsedData.correct_answer,
        } as MathProblem;
      }
      console.error("Could not find parsable JSON in response text:", text);
      return null;
    } catch (error) {
      console.error("Error parsing problem JSON:", error);
      return null;
    }
  }

  const generateProblem = async () => {
    setIsLoading(true)
    setProblem(null)
    setUserAnswer('')
    setFeedback('')
    setIsCorrect(null)
    try {
      const response = await fetch('/api/math-problem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: FIXED_PROMPT }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      const parsedProblem = parseProblemFromResponse(data.text);

      if (parsedProblem) {
        setProblem(parsedProblem);
        const newSessionId = uuidv4();
        setSessionId(newSessionId);
        const { data: insertData, error: insertError } = await supabase
          .from('math_problem_sessions')
          .insert([
            {
              id: newSessionId,
              problem_text: parsedProblem.problem_text,
              correct_answer: Number(parsedProblem.correct_answer),
            }
          ])
          .select();

        if (insertError) {
          console.error("Supabase Insert Error:", insertError);
        } else {
          console.log("Supabase Insert Success:", insertData);
        }
      } else {
        setFeedback("Error: Could not parse the problem from the AI response. Try again.");
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setFeedback("Error generating response.");
    } finally {
      setIsLoading(false);
    }

  }

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!problem || isLoading) return;

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/math-problem/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          problemText: problem.problem_text,
          correctAnswer: problem.correct_answer,
          userAnswer: userAnswer,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const { feedback_text, is_correct } = data;

      if (feedback_text !== undefined) {
        setFeedback(feedback_text);
        setIsCorrect(is_correct);
      } else {
        setFeedback("Error: Could not retrieve feedback from the server.");
        setIsCorrect(null);
      }

    } catch (error) {
      console.error("Fetch Error during feedback submission:", error);
      setFeedback(`An error occurred. Please try generating a new problem.`);
      setIsCorrect(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Math Problem Generator
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <button
            onClick={generateProblem}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
          >
            {isLoading ? 'Generating...' : 'Generate New Problem'}
          </button>
        </div>

        {problem && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Problem:</h2>
            <p className="text-lg text-gray-800 leading-relaxed mb-6">
              {problem.problem_text}
            </p>

            <form onSubmit={submitAnswer} className="space-y-4">
              <div>
                <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Answer:
                </label>
                <input
                  type="number"
                  id="answer"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your answer"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!userAnswer.trim() || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
              >
                Submit Answer
              </button>
            </form>
          </div>
        )}

        {feedback && (
          <div className={`rounded-lg shadow-lg p-6 ${isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              {isCorrect ? '✅ Correct!' : '❌ Not quite right'}
            </h2>
            <p className="text-gray-800 leading-relaxed">{feedback}</p>
          </div>
        )}
      </main>
    </div>
  )
}