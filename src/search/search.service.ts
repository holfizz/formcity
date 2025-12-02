import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'

export interface SearchResult {
	title: string
	link: string
	snippet: string
}

@Injectable()
export class SearchService {
	private readonly logger = new Logger(SearchService.name)
	private readonly googleApiKey = process.env.GOOGLE_API_KEY
	private readonly googleCseId = process.env.GOOGLE_CSE_ID

	constructor(private readonly httpService: HttpService) {}

	async searchGoogle(
		query: string,
		numResults: number = 5
	): Promise<SearchResult[]> {
		try {
			if (!this.googleApiKey || !this.googleCseId) {
				this.logger.warn('Google API credentials not configured')
				return []
			}

			this.logger.log(`Searching Google for: ${query}`)

			const response = await firstValueFrom(
				this.httpService.get('https://www.googleapis.com/customsearch/v1', {
					params: {
						key: this.googleApiKey,
						cx: this.googleCseId,
						q: query,
						num: numResults,
					},
				})
			)

			const items = response.data.items || []
			return items.map((item: any) => ({
				title: item.title,
				link: item.link,
				snippet: item.snippet,
			}))
		} catch (error) {
			this.logger.error(`Google Search error: ${error.message}`)
			return []
		}
	}

	formatSearchResults(results: SearchResult[]): string {
		if (results.length === 0) {
			return 'Результаты поиска не найдены.'
		}

		return results
			.map((result, index) => {
				return `${index + 1}. ${result.title}\n${result.snippet}\nСсылка: ${
					result.link
				}`
			})
			.join('\n\n')
	}
}
