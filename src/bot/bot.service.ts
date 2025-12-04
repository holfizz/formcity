import { Injectable, Logger } from '@nestjs/common'
import { Ctx, Message, On, Start, Update } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { CsvService } from '../csv/csv.service'
import { ExcelService, PropertyData } from '../excel/excel.service'
import { OpenAiService } from '../openai/openai.service'
import { SearchService } from '../search/search.service'
import { WebScrapingService } from '../web-scraping/web-scraping.service'
import {
	apartmentRoomsKeyboard,
	areaRangeKeyboard,
	backToMainKeyboard,
	mainKeyboard,
	priceRangeKeyboard,
	searchKeyboard,
} from './keyboards'

@Update()
@Injectable()
export class BotService {
	private readonly logger = new Logger(BotService.name)

	constructor(
		private readonly excelService: ExcelService,
		private readonly webScrapingService: WebScrapingService,
		private readonly openAiService: OpenAiService,
		private readonly searchService: SearchService,
		private readonly csvService: CsvService
	) {}

	@Start()
	async start(@Ctx() ctx: Context) {
		const welcomeMessage = `🏢 Добро пожаловать в Formula City Bot!

Я – внутренний ИИ-помощник для сотрудников Formula City.

💬 Напишите мне любой вопрос, и я:
• Найду информацию о недвижимости из базы данных
• Получу данные о проектах Well и Евгеньевский
• Отвечу на вопросы о компании
• Проанализирую данные из таблиц
• Запущу поиск в интернете при необходимости

Просто напишите свой вопрос текстом! 💬`

		await ctx.reply(welcomeMessage, { reply_markup: mainKeyboard })
	}

	@On('callback_query')
	async handleCallback(@Ctx() ctx: Context) {
		const callbackQuery = ctx.callbackQuery
		if (!('data' in callbackQuery)) return

		const data = callbackQuery.data
		await ctx.answerCbQuery()

		try {
			await ctx.sendChatAction('typing')

			switch (data) {
				case 'main_menu':
					await this.showMainMenu(ctx)
					break
				case 'about':
					await this.showAboutFormCity(ctx)
					break
				case 'contacts':
					await this.showContacts(ctx)
					break
			}
		} catch (error) {
			this.logger.error(`Error handling callback: ${error.message}`)
			await ctx.reply('Произошла ошибка. Попробуйте еще раз.', {
				reply_markup: mainKeyboard,
			})
		}
	}

	@On('message')
	async handleMessage(@Message('text') message: string, @Ctx() ctx: Context) {
		if (!message) return

		try {
			this.logger.log(`=== NEW MESSAGE: "${message}" ===`)
			await ctx.sendChatAction('typing')

			// ВСЕГДА загружаем CSV данные для контекста
			this.logger.log('Loading CSV data for context...')
			const csvData = await this.csvService.getAllDataAsText()
			this.logger.log(`CSV data loaded, length: ${csvData.length}`)

			const analysis = await this.openAiService.analyzePropertyQuery(message)
			let context = csvData // Всегда начинаем с CSV данных
			let prompt = ''

			if (analysis.intent === 'search' || this.isPropertyQuery(message)) {
				const properties = await this.searchProperties(message)
				const propertiesContext = this.formatPropertiesForAI(properties)
				context = csvData + '\n\n' + propertiesContext // Объединяем CSV и данные недвижимости

				if (properties.length > 0) {
					prompt = `Сотрудник спрашивает: "${message}". 

В контексте есть внутренние данные компании о недвижимости.

Проанализируй данные и предоставь:
• Краткую сводку по найденным объектам
• Ключевые цифры (количество, средняя цена, диапазон площадей)
• Выводы и рекомендации

Используй ТОЛЬКО данные из контекста. НЕ указывай источник данных.`

					await this.streamResponse(ctx, prompt, context, false)

					// Добавляем список объектов после streaming ответа
					if (properties.length <= 5) {
						await ctx.reply(
							'📋 Найденные объекты:\n' +
								this.formatPropertiesForUser(properties)
						)
					} else {
						await ctx.reply(
							`📋 Найдено ${properties.length} объектов. Показываю первые 5:\n` +
								this.formatPropertiesForUser(properties.slice(0, 5))
						)
					}
				} else {
					prompt = `Сотрудник спрашивает: "${message}". 
					
В базе данных недвижимости ничего не найдено по этому запросу. 
Предложи уточнить запрос или попробовать другие параметры поиска.`

					await this.streamResponse(ctx, prompt, context, false)
				}
			} else {
				// Для всех остальных вопросов используем OpenAI с web search
				const isFinancial = this.isFinancialQuery(message)

				if (isFinancial) {
					prompt = `Сотрудник компании Formula City спрашивает о финансах: "${message}". 

📊 В КОНТЕКСТЕ ЕСТЬ ВНУТРЕННИЕ ДАННЫЕ КОМПАНИИ - используй их для ответа!

ВАЖНО:
1. Сначала проверь данные в контексте (внутренние данные компании)
2. Если данных недостаточно - используй web search
3. Предоставь конкретные цифры из контекста
4. НЕ указывай источник для внутренних данных
5. Указывай источник ТОЛЬКО для данных из интернета

Формат ответа:
💰 **ФИНАНСОВАЯ ИНФОРМАЦИЯ**

[Данные из внутренних источников или web search]

🔍 **Источники из интернета** (если использовались):
• [Название](URL)`
				} else {
					prompt = `Сотрудник компании Formula City спрашивает: "${message}". 

В контексте есть внутренние данные компании.

ВАЖНО:
1. Сначала проверь данные в контексте
2. Если нужна дополнительная информация - используй web search
3. НЕ указывай источник для внутренних данных
4. Указывай источник ТОЛЬКО для данных из интернета

Формат ответа:
📊 Краткий ответ с данными
🔍 Источники из интернета (если использовались): [название](URL)`
				}

				await this.streamResponse(ctx, prompt, context, true)
			}

			// Убрали лишнее сообщение - пользователь и так может писать
		} catch (error) {
			this.logger.error(`Error handling message: ${error.message}`)
			await ctx.reply(
				'Извините, произошла ошибка при обработке вашего запроса.',
				{ reply_markup: mainKeyboard }
			)
		}
	}

	private async streamResponse(
		ctx: Context,
		prompt: string,
		context: string,
		useWebSearch: boolean = true
	): Promise<void> {
		let fullResponse = ''
		let sentMessage: any = null
		let lastUpdate = Date.now()
		const updateInterval = 3000 // Обновляем каждые 3 секунды

		try {
			this.logger.log(
				`Generating response (streaming, web search: ${useWebSearch})...`
			)

			for await (const chunk of this.openAiService.generateResponseStream(
				prompt,
				context,
				useWebSearch
			)) {
				fullResponse += chunk

				const now = Date.now()
				// Обновляем только если прошло достаточно времени
				if (now - lastUpdate > updateInterval) {
					if (!sentMessage) {
						// Первое сообщение - отправляем с Markdown
						sentMessage = await ctx.reply(fullResponse, {
							parse_mode: 'Markdown',
						})
					} else {
						try {
							// Обновляем существующее сообщение
							await ctx.telegram.editMessageText(
								ctx.chat.id,
								sentMessage.message_id,
								undefined,
								fullResponse,
								{ parse_mode: 'Markdown' }
							)
						} catch (e) {
							// Игнорируем ошибки редактирования
							if (e.message && e.message.includes('429')) {
								this.logger.warn('Rate limit during streaming, slowing down...')
								await new Promise(resolve => setTimeout(resolve, 2000))
							}
						}
					}
					lastUpdate = now
				}
			}

			// Финальное обновление с полным ответом
			if (sentMessage && fullResponse !== sentMessage.text) {
				try {
					await ctx.telegram.editMessageText(
						ctx.chat.id,
						sentMessage.message_id,
						undefined,
						fullResponse,
						{ parse_mode: 'Markdown' }
					)
				} catch (e) {
					this.logger.error(`Final update error: ${e.message}`)
				}
			} else if (!sentMessage && fullResponse) {
				// Если не было промежуточных обновлений - отправляем финальный ответ
				await ctx.reply(fullResponse, { parse_mode: 'Markdown' })
			}

			this.logger.log('Response sent successfully')
		} catch (error) {
			this.logger.error(`Error in streamResponse: ${error.message}`)
			try {
				await ctx.reply('Извините, произошла ошибка при генерации ответа.')
			} catch (e) {
				this.logger.error(`Failed to send error message: ${e.message}`)
			}
		}
	}

	private async showMainMenu(ctx: Context) {
		await ctx.editMessageText(
			'🏢 Formula City Bot - Главное меню\n\nВыберите действие или напишите свой вопрос:',
			{ reply_markup: mainKeyboard }
		)
	}

	private async showSearchMenu(ctx: Context) {
		await ctx.editMessageText(
			'🔍 Поиск недвижимости\n\nВыберите категорию для поиска:',
			{ reply_markup: searchKeyboard }
		)
	}

	private async showApartmentRooms(ctx: Context) {
		await ctx.editMessageText(
			'🏠 Поиск квартир\n\nВыберите количество комнат:',
			{ reply_markup: apartmentRoomsKeyboard }
		)
	}

	private async showPriceRanges(ctx: Context) {
		await ctx.editMessageText(
			'💰 Поиск по цене\n\nВыберите ценовой диапазон:',
			{ reply_markup: priceRangeKeyboard }
		)
	}

	private async showAreaRanges(ctx: Context) {
		await ctx.editMessageText(
			'📐 Поиск по площади\n\nВыберите диапазон площади:',
			{ reply_markup: areaRangeKeyboard }
		)
	}

	private async showPropertyTypes(ctx: Context) {
		try {
			const types = await this.excelService.getPropertyTypes()
			const columns = await this.excelService.getAvailableColumns()

			const message = `📊 Доступные типы недвижимости:\n${types
				.map(type => `• ${type}`)
				.join('\n')}\n\n📋 Доступные поля:\n${columns
				.map(col => `• ${col}`)
				.join('\n')}`

			await ctx.editMessageText(message, { reply_markup: backToMainKeyboard })
		} catch (error) {
			await ctx.editMessageText('Ошибка при получении типов недвижимости.', {
				reply_markup: backToMainKeyboard,
			})
		}
	}

	private async showAboutFormCity(ctx: Context) {
		try {
			const aboutText = `🏢 О Formula City

Formula City (ООО «Формула Сити») - это девелоперская компания в Санкт-Петербурге с более чем 20-летним опытом в девелопменте и строительстве. 

Компания специализируется на девелопменте полного цикла, начиная с аналитики и покупки земельных участков, затем разработки концепций и проектирования жилых и многофункциональных комплексов, строительства и ввода объектов в эксплуатацию, управления объектами (включая апарт-отели) и проведения экспертизы проектов, а также управления по KPI.

🏗️ Ключевые проекты:

• Апарт-отель Well - один из основных продуктов Formula City. Этот объект представляет собой апарт-отель или многофункциональный комплекс в Санкт-Петербурге и был отмечен профессиональными премиями.

• Делюкс-квартал «Евгеньевский» - квартал включает в себя коллекционные резиденции делюкс-класса в тихом центре Петербурга, с жилыми корпусами, бизнес-центром, коммерческими помещениями и подземным паркингом. Проект разрабатывается с участием архитектурного бюро «Евгений Герасимов и партнеры» и находится в стадии проектирования. На данный момент официальной информации о начале продаж пока нет.

В целом, Formula City известна своими высококачественными проектами, опытным руководством и командой, которые получили отраслевые награды и признание в профессиональных кругах. Компания активно работает над созданием инновационных и комфортных объектов недвижимости, предлагая клиентам высокий уровень сервиса и качества.`

			await ctx.editMessageText(aboutText, {
				reply_markup: backToMainKeyboard,
			})
		} catch (error) {
			this.logger.error(`Error in showAboutFormCity: ${error.message}`)
			await ctx.editMessageText(
				'Ошибка при получении информации о Formula City.',
				{
					reply_markup: backToMainKeyboard,
				}
			)
		}
	}

	private async showContacts(ctx: Context) {
		try {
			const contactsText = `📞 Контакты Formula City

📍 АДРЕС:
196084, г. Санкт-Петербург, Измайловский бульвар, дом 1, корпус 2, строение 1

📞 ТЕЛЕФОН:
+7 (812) 627 77 76

📧 ПОЧТА:
info@formcity.ru

🕒 ГРАФИК РАБОТЫ:
ПН-ПТ с 9.00 до 19.00
СБ И ВС - выходные

🌐 Сайт: https://formcity.ru`

			await ctx.editMessageText(contactsText, {
				reply_markup: backToMainKeyboard,
			})
		} catch (error) {
			this.logger.error(`Error in showContacts: ${error.message}`)
			await ctx.editMessageText('Ошибка при получении контактной информации.', {
				reply_markup: backToMainKeyboard,
			})
		}
	}

	private async showHelp(ctx: Context) {
		const helpMessage = `❓ Справка по боту Formula City

🔍 Поиск недвижимости - найти объекты по параметрам из базы данных
📊 Типы недвижимости - посмотреть доступные типы и поля
🏢 О Formula City - информация о компании и проектах
📞 Контакты - контактная информация
🔄 Обновить данные - обновить базу данных Excel

💬 Вы можете написать свой вопрос текстом, и ИИ поможет найти ответ!

Примеры вопросов:
• "Покажи квартиры в проекте Well"
• "Какие есть коммерческие помещения?"
• "Расскажи о проекте Евгеньевский"
• "Сколько доступных квартир с 2 комнатами?"
• "Какая средняя цена квартир в 1 очереди?"
• "Покажи все объекты со статусом Доступна"

Бот использует ИИ для анализа данных и поиска информации на сайте formcity.ru`

		await ctx.editMessageText(helpMessage, { reply_markup: backToMainKeyboard })
	}

	private async refreshData(ctx: Context) {
		try {
			await ctx.editMessageText('🔄 Обновляю данные...', {
				reply_markup: undefined,
			})
			await this.excelService.refreshCache()
			this.webScrapingService.clearCache()
			await ctx.editMessageText('✅ Данные успешно обновлены!', {
				reply_markup: backToMainKeyboard,
			})
		} catch (error) {
			await ctx.editMessageText('❌ Ошибка при обновлении данных.', {
				reply_markup: backToMainKeyboard,
			})
		}
	}

	private async searchCommercial(ctx: Context) {
		const allProperties = await this.excelService.loadExcelData()
		const properties = allProperties.filter(prop => prop.тип === 'Коммерческое')
		await this.showSearchResults(ctx, properties, 'Коммерческая недвижимость')
	}

	private async searchByPhase(ctx: Context, phase: string) {
		const allProperties = await this.excelService.loadExcelData()
		const properties = allProperties.filter(
			prop =>
				prop.очередь &&
				String(prop.очередь).toLowerCase() === phase.toLowerCase()
		)
		await this.showSearchResults(ctx, properties, `Недвижимость - ${phase}`)
	}

	private async searchByRooms(ctx: Context, rooms: string) {
		const allProperties = await this.excelService.loadExcelData()
		let properties: PropertyData[] = []

		if (rooms === '4') {
			properties = allProperties.filter(
				prop => prop.тип === 'Квартира' && Number(prop.комнаты) >= 4
			)
		} else {
			properties = allProperties.filter(
				prop =>
					prop.тип === 'Квартира' && Number(prop.комнаты) === Number(rooms)
			)
		}

		await this.showSearchResults(
			ctx,
			properties,
			`Квартиры ${rooms === '4' ? '4+' : rooms} ${
				rooms === '1' ? 'комната' : 'комнаты'
			}`
		)
	}

	private async searchByPriceRange(ctx: Context, range: string) {
		const [min, max] = range.split('_').map(Number)
		const properties = await this.searchPropertiesByPrice(min, max)
		const rangeText =
			max === 999999999
				? `от ${(min / 1000000).toFixed(0)} млн`
				: `${(min / 1000000).toFixed(0)}-${(max / 1000000).toFixed(0)} млн`
		await this.showSearchResults(ctx, properties, `Недвижимость ${rangeText}`)
	}

	private async searchByAreaRange(ctx: Context, range: string) {
		const [min, max] = range.split('_').map(Number)
		const properties = await this.searchPropertiesByArea(min, max)
		const rangeText = max === 999 ? `от ${min} м²` : `${min}-${max} м²`
		await this.showSearchResults(ctx, properties, `Недвижимость ${rangeText}`)
	}

	private async showSearchResults(
		ctx: Context,
		properties: PropertyData[],
		title: string
	) {
		if (properties.length === 0) {
			await ctx.editMessageText(
				`${title}\n\n❌ По вашему запросу ничего не найдено.`,
				{ reply_markup: backToMainKeyboard }
			)
			return
		}

		try {
			await ctx.sendChatAction('typing')

			const context = this.formatPropertiesForAI(properties)
			const aiSummary = await this.openAiService.generateResponse(
				`Проанализируй найденные объекты недвижимости и предоставь краткую сводку:
- Количество объектов
- Диапазон цен (мин-макс)
- Диапазон площадей (мин-макс)
- Распределение по типам/проектам
- Средняя цена

Будь кратким и конкретным, используй только данные из контекста.`,
				context
			)

			const displayCount = properties.length > 10 ? 10 : properties.length
			const message = `${title}\n\n📊 Аналитика:\n${aiSummary}\n\n📋 Объекты (показано ${displayCount} из ${
				properties.length
			}):\n\n${this.formatPropertiesForUser(properties.slice(0, displayCount))}`

			if (message.length > 4000) {
				await ctx.editMessageText(`${title}\n\n📊 Аналитика:\n${aiSummary}`, {
					reply_markup: undefined,
				})
				await this.sendLongMessage(
					ctx,
					`📋 Объекты (показано 5 из ${
						properties.length
					}):\n\n${this.formatPropertiesForUser(properties.slice(0, 5))}`
				)
				await ctx.reply('Выберите действие:', {
					reply_markup: backToMainKeyboard,
				})
			} else {
				await ctx.editMessageText(message, { reply_markup: backToMainKeyboard })
			}
		} catch (error) {
			this.logger.error(`Error in showSearchResults: ${error.message}`)
			const message = `${title}\n\n✅ Найдено ${
				properties.length
			} объектов:\n\n${this.formatPropertiesForUser(properties.slice(0, 10))}`
			await ctx.editMessageText(message, { reply_markup: backToMainKeyboard })
		}
	}

	private async searchProperties(query: string): Promise<PropertyData[]> {
		return await this.excelService.searchProperties(query)
	}

	private async searchPropertiesByPrice(
		min: number,
		max: number
	): Promise<PropertyData[]> {
		const allProperties = await this.excelService.loadExcelData()
		return allProperties.filter(prop => {
			const price = Number(prop.цена)
			return price >= min && (max === 999999999 || price <= max)
		})
	}

	private async searchPropertiesByArea(
		min: number,
		max: number
	): Promise<PropertyData[]> {
		const allProperties = await this.excelService.loadExcelData()
		return allProperties.filter(prop => {
			const area = Number(prop.площадь)
			return area >= min && (max === 999 || area <= max)
		})
	}

	private needsGoogleSearch(message: string): boolean {
		const searchKeywords = [
			'найди в интернете',
			'поищи в интернете',
			'загугли',
			'погугли',
			'найди информацию',
			'поищи информацию',
			'что говорят в интернете',
			'что пишут в интернете',
			'найди в гугле',
			'поищи в гугле',
			'найди в google',
			'поищи в google',
			'найди статью',
			'найди новость',
			'последние новости',
			'актуальная информация',
		]

		const messageLower = message.toLowerCase()
		return searchKeywords.some(keyword => messageLower.includes(keyword))
	}

	private isCsvQuery(message: string): boolean {
		const csvKeywords = [
			'посчитай',
			'рассчитай',
			'сколько за',
			'продажи за',
			'выручка за',
			'доход за',
			'поступления за',
			'за год',
			'за квартал',
			'за период',
			'с 20',
			'по 20',
			'в 202',
			'кв. 202',
			'квартал',
			'финансы',
			'денежные средства',
			'законтрактован',
			'машиноместа',
			'кладовки',
		]

		return csvKeywords.some(keyword => message.toLowerCase().includes(keyword))
	}

	private isPropertyQuery(message: string): boolean {
		const propertyKeywords = [
			'квартира',
			'комната',
			'площадь',
			'этаж',
			'цена',
			'стоимость',
			'коммерческое',
			'офис',
			'помещение',
			'недвижимость',
			'очередь',
			'строительство',
			'дом',
			'здание',
			'метр',
			'кв.м',
		]

		return propertyKeywords.some(keyword =>
			message.toLowerCase().includes(keyword)
		)
	}

	private isFinancialQuery(message: string): boolean {
		const financialKeywords = [
			'выручка',
			'контрактация',
			'продажи',
			'доход',
			'прибыль',
			'финанс',
			'бюджет',
			'инвестиц',
			'расход',
			'оборот',
			'рентабельность',
			'окупаемость',
		]

		return financialKeywords.some(keyword =>
			message.toLowerCase().includes(keyword)
		)
	}

	private formatPropertiesForUser(properties: PropertyData[]): string {
		return properties
			.map((prop, index) => {
				const details = []
				if (prop.тип) details.push(`Тип: ${prop.тип}`)
				if (prop.подтип) details.push(`${prop.подтип}`)
				if (prop.площадь) details.push(`Площадь: ${prop.площадь} кв.м`)
				if (prop.цена)
					details.push(`Цена: ${Number(prop.цена).toLocaleString('ru-RU')} ₽`)
				if (prop.этаж) details.push(`Этаж: ${prop.этаж}`)
				if (prop.комнаты) details.push(`Комнат: ${prop.комнаты}`)
				if (prop.очередь) details.push(`Очередь: ${prop.очередь}`)
				if (prop.статус) details.push(`Статус: ${prop.статус}`)

				return `${index + 1}. ${details.join(', ')}`
			})
			.join('\n\n')
	}

	private formatPropertiesForAI(properties: PropertyData[]): string {
		if (properties.length === 0) {
			return 'Данные CSV не загружены'
		}

		const formatted = properties
			.map((prop, index) => {
				const details = []
				if (prop.тип) details.push(`Тип: ${prop.тип}`)
				if (prop.подтип) details.push(`Подтип: ${prop.подтип}`)
				if (prop.площадь) details.push(`Площадь: ${prop.площадь} кв.м`)
				if (prop.цена)
					details.push(`Цена: ${Number(prop.цена).toLocaleString('ru-RU')} руб`)
				if (prop.этаж) details.push(`Этаж: ${prop.этаж}`)
				if (prop.комнаты) details.push(`Комнат: ${prop.комнаты}`)
				if (prop.очередь) details.push(`Очередь: ${prop.очередь}`)
				if (prop.статус) details.push(`Статус: ${prop.статус}`)

				return `${index + 1}. ${details.join(', ')}`
			})
			.join('\n')

		const totalPrice = properties.reduce(
			(sum, prop) => sum + Number(prop.цена || 0),
			0
		)
		const avgPrice = totalPrice / properties.length
		const totalArea = properties.reduce(
			(sum, prop) => sum + Number(prop.площадь || 0),
			0
		)
		const avgArea = totalArea / properties.length

		return `📊 ДАННЫЕ ИЗ CSV ФАЙЛА (${properties.length} объектов):

${formatted}

📈 СТАТИСТИКА:
• Средняя цена: ${avgPrice.toLocaleString('ru-RU')} руб
• Средняя площадь: ${avgArea.toFixed(1)} кв.м
• Общая стоимость: ${totalPrice.toLocaleString('ru-RU')} руб

Источник данных: /Users/holfizz/Developer/fromcity/data.csv`
	}

	private async sendMessageWithRetry(
		ctx: Context,
		text: string,
		maxRetries: number = 3
	): Promise<void> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				await ctx.reply(text)
				return
			} catch (error) {
				if (error.message && error.message.includes('429')) {
					const match = error.message.match(/retry after (\d+)/)
					const retryAfter = match ? parseInt(match[1]) : 5

					this.logger.warn(
						`Rate limit hit (attempt ${attempt}/${maxRetries}), waiting ${retryAfter} seconds...`
					)

					if (attempt < maxRetries) {
						await new Promise(resolve =>
							setTimeout(resolve, (retryAfter + 1) * 1000)
						)
					} else {
						throw new Error(
							`Слишком много запросов. Подождите ${retryAfter} секунд перед отправкой новых сообщений.`
						)
					}
				} else {
					throw error
				}
			}
		}
	}

	private async sendLongMessage(ctx: Context, message: string) {
		const maxLength = 4000

		if (message.length <= maxLength) {
			await this.sendMessageWithRetry(ctx, message)
			return
		}

		const parts = []
		let currentPart = ''

		const lines = message.split('\n')
		for (const line of lines) {
			if (currentPart.length + line.length + 1 > maxLength) {
				if (currentPart) {
					parts.push(currentPart)
					currentPart = line
				} else {
					parts.push(line.substring(0, maxLength))
				}
			} else {
				currentPart += (currentPart ? '\n' : '') + line
			}
		}

		if (currentPart) {
			parts.push(currentPart)
		}

		for (const part of parts) {
			await this.sendMessageWithRetry(ctx, part)
			await new Promise(resolve => setTimeout(resolve, 1000))
		}
	}
}
