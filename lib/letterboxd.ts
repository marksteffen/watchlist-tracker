import axios from 'axios'
import * as cheerio from 'cheerio'

export interface WatchlistFilm {
  slug: string
  title: string
  year: number | null
}

const LETTERBOXD_BASE = 'https://letterboxd.com'
const FILMS_PER_PAGE = 28

function parseTitleAndYear(raw: string): { title: string; year: number | null } {
  // e.g. "The Act of Killing (2012)" → title: "The Act of Killing", year: 2012
  const match = raw.match(/^(.*)\s+\((\d{4})\)$/)
  if (match) {
    return { title: match[1].trim(), year: parseInt(match[2], 10) }
  }
  return { title: raw.trim(), year: null }
}

async function fetchWatchlistPage(username: string, page: number): Promise<WatchlistFilm[]> {
  const url = `${LETTERBOXD_BASE}/${username}/watchlist/page/${page}/`
  const { data: html } = await axios.get<string>(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
    timeout: 10000,
  })

  const $ = cheerio.load(html)
  const films: WatchlistFilm[] = []

  // Films are in div.react-component[data-component-class="LazyPoster"]
  $('div.react-component[data-component-class="LazyPoster"]').each((_, el) => {
    const slug = $(el).attr('data-item-slug')
    const rawName = $(el).attr('data-item-name') || ''
    const { title, year } = parseTitleAndYear(rawName)

    if (slug && title) {
      films.push({ slug, title, year })
    }
  })

  return films
}

export async function fetchWatchlist(username: string): Promise<WatchlistFilm[]> {
  const allFilms: WatchlistFilm[] = []
  let page = 1

  while (true) {
    const films = await fetchWatchlistPage(username, page)
    allFilms.push(...films)

    if (films.length < FILMS_PER_PAGE) break
    page++

    // Small delay to be polite
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return allFilms
}

export async function validateUsername(username: string): Promise<boolean> {
  try {
    const url = `${LETTERBOXD_BASE}/${username}/watchlist/`
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 8000,
      validateStatus: (status) => status < 500,
    })
    return response.status === 200
  } catch {
    return false
  }
}
