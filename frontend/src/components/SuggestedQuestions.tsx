import { Sparkles } from 'lucide-react'

interface SuggestedQuestionsProps {
    questions: string[]
    onSelectQuestion: (question: string) => void
    isLoading?: boolean
}

/**
 * SuggestedQuestions Component
 * 
 * Displays a 2x3 grid of suggested questions from the self-retriever API.
 * Shown when chat is empty and user clicks New Conversation with self-retriever enabled.
 */
export function SuggestedQuestions({
    questions,
    onSelectQuestion,
    isLoading = false
}: SuggestedQuestionsProps) {
    if (isLoading) {
        return (
            <div className="suggested-questions-container">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    <span>Generating suggestions...</span>
                </div>
            </div>
        )
    }

    if (!questions || questions.length === 0) {
        return null
    }

    return (
        <div className="suggested-questions-container">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                <Sparkles className="h-4 w-4" />
                <span>Try asking:</span>
            </div>
            <div className="suggested-questions-grid">
                {questions.slice(0, 6).map((question, index) => (
                    <button
                        key={index}
                        className="question-box"
                        onClick={() => onSelectQuestion(question)}
                        title={question}
                    >
                        {question}
                    </button>
                ))}
            </div>
        </div>
    )
}
