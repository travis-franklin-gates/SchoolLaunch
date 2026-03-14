import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

export async function POST(request: NextRequest) {
  try {
    const { base64 } = await request.json()
    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json({ error: 'Missing base64 PDF data' }, { status: 400 })
    }

    const buffer = Buffer.from(base64, 'base64')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()

    return NextResponse.json({ text: result.text })
  } catch (err) {
    console.error('PDF extraction failed:', err)
    return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 500 })
  }
}
