import { companyInfo } from '@/data/company-info'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import * as cheerio from 'cheerio'
import { firstValueFrom } from 'rxjs'

export interface ScrapedContent {
	title: string
	content: string
	url: string
	lastUpdated: Date
}

@Injectable()
export class WebScrapingService {
	private readonly logger = new Logger(WebScrapingService.name)
	private readonly baseUrl =
		process.env.FORMCITY_BASE_URL || 'https://formcity.ru'
	private cache = new Map<string, ScrapedContent>()
	private cacheExpiry = 60 * 60 * 1000

	constructor(private readonly httpService: HttpService) {}

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

			this.logger.log(`Scraping FormCity page: ${url}`)

			const response = await firstValueFrom(
				this.httpService.get(url, {
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					},
					timeout: 10000,
				})
			)

			const $ = cheerio.load(response.data)

			const title = $('title').text().trim() || $('h1').first().text().trim()

			$('script, style, nav, header, footer, .menu, .navigation').remove()

			const content = $('body')
				.text()
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
			this.logger.error(`Error scraping ${path}: ${error.message}`)
			return null
		}
	}

	async searchFormCityContent(query: string): Promise<ScrapedContent[]> {
		try {
			// Основные страницы, которые точно существуют
			const pagesToSearch = ['', '/contacts', '/company', '/team']

			const results: ScrapedContent[] = []
			const searchTerm = query.toLowerCase()

			for (const page of pagesToSearch) {
				try {
					const content = await this.scrapeFormCityPage(page)
					if (content && content.content.toLowerCase().includes(searchTerm)) {
						results.push(content)
					}
				} catch (error) {
					// Тихо игнорируем ошибки 404, используем fallback
				}
			}

			return results
		} catch (error) {
			this.logger.error(`Error searching FormCity content: ${error.message}`)
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
			this.logger.error(`Error getting FormCity info: ${error.message}`)
			return this.getFallbackInfo(topic)
		}
	}

	private getFallbackInfo(topic: string): string {
		const topicLower = topic.toLowerCase()

		if (
			topicLower.includes('well') ||
			topicLower.includes('велл') ||
			topicLower.includes('апарт')
		) {
			return `Апарт-отель Well – один из основных продуктов компании Formula City в формате апарт-отеля/многофункционального комплекса в Санкт-Петербурге, отмеченный профессиональными премиями. Доступны квартиры различных типов и коммерческие помещения.`
		}

		if (
			topicLower.includes('евгеньев') ||
			topicLower.includes('делюкс') ||
			topicLower.includes('квартал')
		) {
			return `Делюкс-квартал «Евгеньевский» – квартал коллекционных резиденций делюкс-класса в тихом центре Петербурга, с жилыми корпусами, бизнес-центром, коммерцией и подземным паркингом. Архитектура от бюро «Евгений Герасимов и партнеры». Сейчас в стадии проектирования, по официальной информации открытых продаж пока нет.`
		}

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
		this.logger.log('Web scraping cache cleared')
	}
}
