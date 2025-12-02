export class AiService {
	private readonly apiKey = process.env.OPENAI_API_KEY
	private readonly baseUrl = 'https://api.openai.com/v1'

	async generateResponse(prompt: string, context?: string): Promise<string> {
		try {
			const systemPrompt = `Ты – внутренний ИИ-помощник для СОТРУДНИКОВ девелоперской компании Formula City (Санкт-Петербург).

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

ПРАВИЛА РАБОТЫ С ДАННЫМИ:
• Не выдумывай цифры. Используй только предоставленные данные
• Если чего-то нет в данных, честно сообщи об этом
• Всегда показывай ЛОГИКУ: объясняй, как интерпретировал данные
• Говори на "вы" уважительно, но дружелюбно
• Не используй личные мнения, только выводы на основе фактов

${context ? `\nКОНТЕКСТ ДАННЫХ:\n${context}` : ''}`

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

			const response = await fetch(`${this.baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: 'gpt-4o-search-preview',
					messages,
					max_tokens: 1000,
					web_search_options: {},
				}),
			})

			const data = await response.json()
			return (
				data.choices[0]?.message?.content ||
				'Извините, не смог сгенерировать ответ.'
			)
		} catch (error) {
			console.error(`OpenAI API error: ${error.message}`)
			return 'Извините, произошла ошибка при обработке запроса.'
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
			console.error(`Query analysis error: ${error.message}`)
			return {
				intent: 'search',
				parameters: {},
			}
		}
	}
}
