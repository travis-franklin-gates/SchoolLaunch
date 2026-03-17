'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { buildSchoolContextString } from '@/lib/buildSchoolContext'
import { computeMultiYearDetailed, computeFPFScorecard, computeCarryForward } from '@/lib/budgetEngine'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const SUGGESTED_QUESTIONS = [
  'What enrollment do I need to break even in Year 1?',
  'Can I afford a full-time principal at this enrollment level?',
  'How does our personnel ratio compare to healthy WA charters?',
  'What happens to our reserve days if we lose 15 students?',
  'Are there braiding opportunities with our grants?',
  'What are the biggest risks in our financial model?',
]

export default function AskPage() {
  const { schoolData, assumptions } = useScenario()
  const { schoolName, profile, positions, allPositions, projections, gradeExpansionPlan, loading } = schoolData

  const preOpenCash = useMemo(() => computeCarryForward(profile), [profile])
  const multiYear = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, preOpenCash, gradeExpansionPlan, allPositions, profile.startup_funding),
    [profile, positions, allPositions, projections, assumptions, gradeExpansionPlan, preOpenCash]
  )
  const scorecard = useMemo(
    () => computeFPFScorecard(multiYear, preOpenCash, false),
    [multiYear, preOpenCash]
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming || cooldown) return

      const userMsg: Message = { role: 'user', content: text.trim() }
      const updatedMessages = [...messages, userMsg]
      setMessages(updatedMessages)
      setInput('')
      setStreaming(true)
      setCooldown(true)
      setTimeout(() => setCooldown(false), 2000)

      const schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages
              .filter((m) => m.role !== 'system')
              .slice(-20)
              .map((m) => ({ role: m.role, content: m.content })),
            schoolContext,
          }),
        })

        if (!res.ok || !res.body) {
          const errText = await res.text()
          let errorContent = 'Sorry, something went wrong. Please try again.'
          try {
            const errJson = JSON.parse(errText)
            if (errJson.error?.includes('ANTHROPIC_API_KEY')) {
              errorContent =
                'AI assistant is not configured. Please set the ANTHROPIC_API_KEY environment variable.'
            }
          } catch {
            // not JSON
          }
          setMessages((prev) => [...prev, { role: 'system', content: errorContent }])
          setStreaming(false)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let assistantText = ''

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          assistantText += decoder.decode(value, { stream: true })
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: assistantText }
            return updated
          })
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: 'Connection error. Please check your network and try again.' },
        ])
      }

      setStreaming(false)
    },
    [messages, streaming, cooldown, schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard]
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading school data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">
      {/* Messages */}
      <div data-tour="chat-area" className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-4 sl-scroll">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-teal-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
            </div>
            <h2 className="text-[24px] font-semibold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-heading-var)' }}>Ask SchoolLaunch</h2>
            <p className="text-[15px] text-slate-400 mb-8">
              Ask questions about your financial model in plain English
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full px-4">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={streaming || cooldown}
                  className="text-left text-sm text-slate-600 bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white rounded-2xl rounded-br-sm'
                    : msg.role === 'system'
                      ? 'bg-red-50 text-red-700 border border-red-200 rounded-2xl'
                      : 'bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-bl-sm'
                }`}
              >
                {msg.content ||
                  (streaming && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1 items-center text-slate-400">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : null)}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form data-tour="chat-input" onSubmit={handleSubmit} className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your budget, staffing, cash flow, or WA charter finance..."
          disabled={streaming}
          className="flex-1 border border-slate-200 rounded-full bg-slate-50 px-4 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || cooldown || !input.trim()}
          className={`w-11 h-11 rounded-full text-white flex items-center justify-center transition-colors ${
            streaming || cooldown || !input.trim() ? 'bg-slate-300' : 'bg-teal-600 hover:bg-teal-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
    </div>
  )
}
