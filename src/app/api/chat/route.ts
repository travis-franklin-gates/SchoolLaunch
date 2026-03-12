import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { messages, context } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response('ANTHROPIC_API_KEY not configured', { status: 500 })
  }

  const systemPrompt = `You are a financial planning assistant for a Washington State charter school applicant.

School: ${context.schoolName}
Grade Configuration: ${context.gradeConfig}
Target Enrollment (Year 1): ${context.enrollment} students
Region: ${context.region}
Planned Opening Year: ${context.plannedOpenYear}

Year 1 Budget Summary:
- Total Revenue: $${context.totalRevenue?.toLocaleString()}
- Total Expenses: $${context.totalExpenses?.toLocaleString()}
- Net Position: $${context.netPosition?.toLocaleString()}
- Staff Positions: ${context.positionCount}

Revenue Lines:
${context.revenueLines?.map((r: { item: string; amount: number }) => `  - ${r.item}: $${r.amount.toLocaleString()}`).join('\n') || 'None'}

Expense Lines:
${context.expenseLines?.map((r: { item: string; amount: number }) => `  - ${r.item}: $${r.amount.toLocaleString()}`).join('\n') || 'None'}

Answer questions about the school's financial plan, budget, staffing, and WA charter school finance. Be specific and reference actual numbers from the budget. Keep responses concise and practical.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.slice(-10),
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text()
    return new Response(`API error: ${errText}`, { status: response.status })
  }

  // Stream SSE events as plain text
  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                controller.enqueue(new TextEncoder().encode(parsed.delta.text))
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
