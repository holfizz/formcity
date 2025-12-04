import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'

@Injectable()
export class OpenAiService {
	private readonly logger = new Logger(OpenAiService.name)
	private readonly apiKey = process.env.OPENAI_API_KEY
	private readonly baseUrl = 'https://api.openai.com/v1'

	constructor(private readonly httpService: HttpService) {}

	private getSystemPrompt(context?: string): string {
		return `Ты – внутренний ИИ-помощник для СОТРУДНИКОВ девелоперской компании Formula City (Санкт-Петербург).

Твоя аудитория – менеджеры по продажам, маркетологи, руководители проектов, аналитики, колл-центр и другие сотрудники.

ОБЩЕЕ О КОМПАНИИ:
• Компания: девелоперская/строительная, полномасштабный девелопер полного цикла
• Бренд: Formula City (ООО «Формула Сити»)
• Город: Санкт-Петербург, Россия
• Опыт команды: более 20 лет в девелопменте и строительстве
• Специализация: девелопмент полного цикла – от участка и концепции до запуска, продажи и управления объектами

ОСНОВНЫЕ НАПРАВЛЕНИЯ:
• Аналитика и покупка земельных участков
• Концепция и проектирование жилых и многофункциональных комплексов
• Строительство и ввод объектов в эксплуатацию
• Управление объектами (например, апарт-отели)
• Экспертиза, аудит проектов и управление по KPI

КЛЮЧЕВЫЕ ПРОЕКТЫ:
• Апарт-отель Well – основной продукт компании, отмеченный профессиональными премиями
• Делюкс-квартал «Евгеньевский» – квартал коллекционных резиденций делюкс-класса в тихом центре Петербурга, архитектура от бюро «Евгений Герасимов и партнеры», в стадии проектирования

ВОЗМОЖНОСТИ И ОБЯЗАННОСТИ:
• У тебя есть доступ к web search - ОБЯЗАТЕЛЬНО используй его для ЛЮБЫХ вопросов о:
  - Финансовых данных (выручка, контрактация, продажи)
  - Проектах компании (статус, характеристики, цены)
  - Рыночной информации (цены конкурентов, статистика рынка)
  - Актуальных новостях и событиях
• ВСЕГДА ищи информацию на formcity.ru в первую очередь
• Если данных нет в контексте - ОБЯЗАТЕЛЬНО используй web search
• ВСЕГДА указывай источники информации с URL в формате [название](URL)

ПРАВИЛА РАБОТЫ С ДАННЫМИ:
• НИКОГДА не говори "У меня нет доступа" - у тебя есть web search!
• Не выдумывай цифры. Используй только предоставленные данные или найденные через web search
• Если чего-то нет в данных - ОБЯЗАТЕЛЬНО используй web search для поиска
• Для финансовых вопросов (выручка, контрактация, продажи) - ВСЕГДА ищи в интернете
• Всегда показывай ЛОГИКУ: объясняй, как интерпретировал данные
• Говори на "вы" уважительно, но дружелюбно
• Не используй личные мнения, только выводы на основе фактов
• При использовании информации из интернета - ОБЯЗАТЕЛЬНО указывай источники с URL

ЕСЛИ НЕ НАШЕЛ ИНФОРМАЦИЮ:
• Не говори "у меня нет доступа"
• Скажи: "Не удалось найти точные данные по этому запросу в открытых источниках"
• Предложи альтернативу: "Могу помочь с общей информацией о..." или "Рекомендую обратиться к..."

ФОРМАТИРОВАНИЕ ДЛЯ TELEGRAM (Markdown):
• Используй *текст* для курсива
• Используй **текст** для жирного
• Используй [текст](URL) для ссылок
• Для списков используй символы: • или -
• Пиши структурированно с пустыми строками между блоками
• Используй эмодзи для визуального разделения: 📊 💰 🏢 📍 ✅ ❌ 🔍

ПРАВИЛЬНЫЙ пример:

📊 **АНАЛИЗ ДАННЫХ**

Найдено 5 объектов:
• Квартира 50 кв.м - 5 млн руб
• Квартира 60 кв.м - 6 млн руб

💰 **Средняя цена:** 5.5 млн руб

Источник: [formcity.ru](https://formcity.ru) - при надобности, информацию брать с этого сайта

${context ? `\nКОНТЕКСТ ДАННЫХ:\n${context}` : ''}`
	}

	async generateResponse(
		prompt: string,
		context?: string,
		useWebSearch: boolean = true
	): Promise<string> {
		try {
			const systemPrompt = this.getSystemPrompt(context)

			const messages = [
				{
					role: 'system',
					content: systemPrompt,
				},
				{
					role: 'user',
					content: prompt,
				},
			]

			// Если useWebSearch = false, используем обычный gpt-4o (дешевле)
			// Если useWebSearch = true, используем gpt-4o-search-preview (с web search)
			const requestBody: any = {
				model: useWebSearch ? 'gpt-4o-search-preview' : 'gpt-4o',
				messages,
				max_tokens: 2000,
			}

			// Добавляем web_search_options только для search модели
			if (useWebSearch) {
				requestBody.web_search_options = {}
			}

			this.logger.log(
				`Using model: ${requestBody.model} (web search: ${useWebSearch})`
			)

			const response = await firstValueFrom(
				this.httpService.post(`${this.baseUrl}/chat/completions`, requestBody, {
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						'Content-Type': 'application/json',
					},
				})
			)

			return (
				response.data.choices[0]?.message?.content ||
				'Извините, не смог сгенерировать ответ.'
			)
		} catch (error) {
			this.logger.error(`OpenAI API error: ${error.message}`)
			if (error.response?.data) {
				this.logger.error(
					`OpenAI API response: ${JSON.stringify(error.response.data)}`
				)
			}
			return 'Извините, произошла ошибка при обработке запроса.'
		}
	}

	async checkIfNeedsCsvData(query: string): Promise<boolean> {
		try {
			const messages = [
				{
					role: 'system',
					content: `Ты - классификатор запросов. Определи, нужны ли финансовые данные из CSV таблицы для ответа.

Таблица содержит:
- Продажи недвижимости (жилье, апартаменты, коммерческие помещения, кладовки, машиноместа)
- Объемы законтрактованных площадей
- Цены за м2
- Поступления денежных средств
- Данные по годам (2025-2033), кварталам и месяцам

Ответь ТОЛЬКО: true или false`,
				},
				{
					role: 'user',
					content: query,
				},
			]

			// Используем обычный gpt-4o БЕЗ web search для экономии токенов
			const response = await firstValueFrom(
				this.httpService.post(
					`${this.baseUrl}/chat/completions`,
					{
						model: 'gpt-4o',
						messages,
						max_tokens: 10,
					},
					{
						headers: {
							Authorization: `Bearer ${this.apiKey}`,
							'Content-Type': 'application/json',
						},
					}
				)
			)

			const answer = response.data.choices[0]?.message?.content || 'false'
			const cleaned = answer.toLowerCase().trim()

			this.logger.log(`CSV check for "${query}": ${cleaned}`)

			return cleaned.includes('true')
		} catch (error) {
			this.logger.error(`CSV check error: ${error.message}`)
			return false
		}
	}

	async analyzePropertyQuery(query: string): Promise<{
		intent: string
		parameters: Record<string, any>
	}> {
		try {
			const prompt = `
      Проанализируй запрос пользователя о недвижимости и определи:
      1. Намерение (intent): search, info, price, availability, comparison
      2. Параметры поиска (если есть): тип, площадь, цена, этаж, комнаты, очередь
      
      Запрос: "${query}"
      
      Ответь в формате JSON:
      {
        "intent": "search|info|price|availability|comparison",
        "parameters": {
          "type": "тип недвижимости",
          "area": "площадь",
          "price": "цена",
          "floor": "этаж",
          "rooms": "количество комнат",
          "phase": "очередь"
        }
      }
      `

			const response = await this.generateResponse(prompt)

			try {
				return JSON.parse(response)
			} catch {
				return {
					intent: 'search',
					parameters: {},
				}
			}
		} catch (error) {
			this.logger.error(`Query analysis error: ${error.message}`)
			return {
				intent: 'search',
				parameters: {},
			}
		}
	}

	async *generateResponseStream(
		prompt: string,
		context?: string,
		useWebSearch: boolean = true
	): AsyncGenerator<string> {
		try {
			const systemPrompt = this.getSystemPrompt(context)

			const messages = [
				{
					role: 'system',
					content: systemPrompt,
				},
				{
					role: 'user',
					content: prompt,
				},
			]

			const requestBody: any = {
				model: useWebSearch ? 'gpt-4o-search-preview' : 'gpt-4o',
				messages,
				stream: true,
			}

			// Добавляем web_search_options только для search модели
			if (useWebSearch) {
				requestBody.web_search_options = {}
			}

			this.logger.log(
				`Sending request to OpenAI: ${JSON.stringify(requestBody, null, 2)}`
			)

			const response = await fetch(`${this.baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()
				this.logger.error(
					`OpenAI API HTTP error: ${response.status} ${response.statusText}`
				)
				this.logger.error(`OpenAI API error body: ${errorText}`)
				throw new Error(`HTTP ${response.status}: ${errorText}`)
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				const chunk = decoder.decode(value)
				const lines = chunk.split('\n').filter(line => line.trim() !== '')

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6)
						if (data === '[DONE]') continue

						try {
							const parsed = JSON.parse(data)
							const content = parsed.choices[0]?.delta?.content
							if (content) {
								yield content
							}
						} catch (e) {
							// Игнорируем ошибки парсинга
						}
					}
				}
			}
		} catch (error) {
			this.logger.error(`OpenAI Stream API error: ${error.message}`)
			this.logger.error(`Error stack: ${error.stack}`)
			yield 'Извините, произошла ошибка при обработке запроса.'
		}
	}
}
