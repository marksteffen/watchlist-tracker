import { NextRequest, NextResponse } from 'next/server'
import { validateUsername } from '@/lib/letterboxd'

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username')

  if (!username || username.trim().length === 0) {
    return NextResponse.json({ valid: false })
  }

  const valid = await validateUsername(username.trim())
  return NextResponse.json({ valid })
}
