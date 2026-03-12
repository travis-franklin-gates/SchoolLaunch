'use client'

import { useState, useRef, useEffect } from 'react'
import { useSchoolData } from '@/lib/useSchoolData'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AskPage() {
  const { schoolName, profile, projections, positions, loading } = useSchoolData()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Build context summary
    const totalRevenue = projections.filter((p) => p.is_revenue).reduce((s, p) => s + p.amount, 0)
    const totalExpenses = projections.filter((p) => !p.is_revenue).reduce((s, p) => s + p.amount, 0)

    const context = {
      schoolName,
      gradeConfig: profile.grade_config,
      enrollment: profile.target_enrollment_y1,
      region: profile.region,
      plannedOpenYear: profile.planned_open_year,
      totalRevenue,
      totalExpenses,
      netPosition: totalRevenue - totalExpenses,
      positionCount: positions.length,
      revenueLines: projections.filter((p) => p.is_revenue).map((p) => ({ item: p.line_item, amount: p.amount })),
      expenseLines: projections.filter((p) => !p.is_revenue).map((p) => ({ item: p.line_item, amount: p.amount })),
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
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
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }

    setStreaming(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Ask SchoolLaunch</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask questions about your budget, revenue projections, staffing, or WA charter school finance.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            <p className="text-lg font-medium mb-2">No messages yet</p>
            <p className="text-sm">Try asking about your budget, staffing ratios, or cash flow projections.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {msg.content || (streaming && i === messages.length - 1 ? (
                <span className="text-slate-400 animate-pulse">Thinking...</span>
              ) : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your budget..."
          disabled={streaming}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
