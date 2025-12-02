import { companyInfo } from '@/data/company-info'
import { ScrapedContent } from '../types'

export class ScrapingService {
	private readonly baseUrl =
		process.env.FORMCITY_BASE_URL || 'https://formcity.ru'
	private cache = new Map<string, ScrapedContent>()
	private cacheExpiry = 60 * 60 * 1000

	async scrapeFormCityPage(path: string = ''): Promise<ScrapedContent | null> {
		try {
			const url = `${this.baseUrl}${path}`
			const cacheKey = url

			const cached = this.cache.get(cacheKey)
			if (
				cached &&
				Date.now() - cached.lastUpdated.getTime() < this.cacheExpiry
			) {
				return cached
			}

			console.log(`Scraping FormCity page: ${url}`)

			const response = await fetch(url, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				},
			})

			const html = await response.text()

			const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
			const title = titleMatch ? titleMatch[1].trim() : ''

			const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
			let content = bodyMatch ? bodyMatch[1] : html

			content = content
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
				.substring(0, 5000)

			const scrapedContent: ScrapedContent = {
				title,
				content,
				url,
				lastUpdated: new Date(),
			}

			this.cache.set(cacheKey, scrapedContent)

			return scrapedContent
		} catch (error) {
			console.error(`Error scraping ${path}: ${error.message}`)
			return null
		}
	}

	async searchFormCityContent(query: string): Promise<ScrapedContent[]> {
		try {
			const pagesToSearch = ['', '/company', '/team', '/contacts']

			const results: ScrapedContent[] = []
			const searchTerm = query.toLowerCase()

			for (const page of pagesToSearch) {
				const content = await this.scrapeFormCityPage(page)
				if (content && content.content.toLowerCase().includes(searchTerm)) {
					results.push(content)
				}
			}

			return results
		} catch (error) {
			console.error(`Error searching FormCity content: ${error.message}`)
			return []
		}
	}

	async getFormCityInfo(topic: string): Promise<string> {
		try {
			const searchResults = await this.searchFormCityContent(topic)

			if (searchResults.length === 0) {
				return this.getFallbackInfo(topic)
			}

			return searchResults
				.map(result => `${result.title}: ${result.content}`)
				.join('\n\n')
				.substring(0, 3000)
		} catch (error) {
			console.error(`Error getting FormCity info: ${error.message}`)
			return this.getFallbackInfo(topic)
		}
	}

	private getFallbackInfo(topic: string): string {
		const topicLower = topic.toLowerCase()

		if (
			topicLower.includes('команд') ||
			topicLower.includes('сотрудник') ||
			topicLower.includes('руководств')
		) {
			return companyInfo.team
		}

		if (
			topicLower.includes('контакт') ||
			topicLower.includes('телефон') ||
			topicLower.includes('адрес') ||
			topicLower.includes('email')
		) {
			return companyInfo.contacts
		}

		if (
			topicLower.includes('компани') ||
			topicLower.includes('о нас') ||
			topicLower.includes('проект')
		) {
			return companyInfo.about
		}

		return companyInfo.about
	}

	clearCache(): void {
		this.cache.clear()
		console.log('Web scraping cache cleared')
	}
}
