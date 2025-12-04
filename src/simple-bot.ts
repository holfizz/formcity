import { AiService } from './services/ai.service'
import { DataService } from './services/data.service'
import { ScrapingService } from './services/scraping.service'
import { PropertyData } from './types'

interface BotContext {
	reply: (text: string, options?: any) => Promise<void>
	editMessageText: (text: string, options?: any) => Promise<void>
	answerCbQuery: () => Promise<void>
	sendChatAction: (action: string) => Promise<void>
	callbackQuery?: { data: string }
}

const mainKeyboard = {
	inline_keyboard: [
		[
			{ text: '🔍 Поиск недвижимости', callback_data: 'search' },
			{ text: '📊 Типы недвижимости', callback_data: 'types' },
		],
		[
			{ text: '🏢 О FormCity', callback_data: 'about' },
			{ text: '📞 Контакты', callback_data: 'contacts' },
		],
		[
			{ text: '🔄 Обновить данные', callback_data: 'refresh' },
			{ text: '❓ Помощь', callback_data: 'help' },
		],
	],
}

const searchKeyboard = {
	inline_keyboard: [
		[
			{ text: '🏠 Квартиры', callback_data: 'search_apartments' },
			{ text: '🏢 Коммерческое', callback_data: 'search_commercial' },
		],
		[
			{ text: '1️⃣ 1 очередь', callback_data: 'search_phase_1' },
			{ text: '2️⃣ 2 очередь', callback_data: 'search_phase_2' },
		],
		[
			{ text: '💰 По цене', callback_data: 'search_price' },
			{ text: '📐 По площади', callback_data: 'search_area' },
		],
		[{ text: '⬅️ Назад', callback_data: 'main_menu' }],
	],
}

const apartmentRoomsKeyboard = {
	inline_keyboard: [
		[
			{ text: '1 комната', callback_data: 'rooms_1' },
			{ text: '2 комнаты', callback_data: 'rooms_2' },
		],
		[
			{ text: '3 комнаты', callback_data: 'rooms_3' },
			{ text: '4+ комнат', callback_data: 'rooms_4' },
		],
		[{ text: '⬅️ Назад к поиску', callback_data: 'search' }],
	],
}

const priceRangeKeyboard = {
	inline_keyboard: [
		[
			{ text: 'До 3 млн', callback_data: 'price_0_3000000' },
			{ text: '3-5 млн', callback_data: 'price_3000000_5000000' },
		],
		[
			{ text: '5-7 млн', callback_data: 'price_5000000_7000000' },
			{ text: '7+ млн', callback_data: 'price_7000000_999999999' },
		],
		[{ text: '⬅️ Назад к поиску', callback_data: 'search' }],
	],
}

const areaRangeKeyboard = {
	inline_keyboard: [
		[
			{ text: 'До 50 м²', callback_data: 'area_0_50' },
			{ text: '50-70 м²', callback_data: 'area_50_70' },
		],
		[
			{ text: '70-100 м²', callback_data: 'area_70_100' },
			{ text: '100+ м²', callback_data: 'area_100_999' },
		],
		[{ text: '⬅️ Назад к поиску', callback_data: 'search' }],
	],
}

const backToMainKeyboard = {
	inline_keyboard: [[{ text: '⬅️ Главное меню', callback_data: 'main_menu' }]],
}

export class SimpleTelegramBot {
	private dataService = new DataService()
	private aiService = new AiService()
	private scrapingService = new ScrapingService()

	async handleStart(ctx: BotContext) {
		const welcomeMessage = `🏢 Добро пожаловать в FormCity Bot!

Я помогу вам найти информацию о недвижимости и ответить на вопросы.

Выберите действие:`

		await ctx.reply(welcomeMessage, { reply_markup: mainKeyboard })
	}

	async handleCallback(ctx: BotContext) {
		const data = ctx.callbackQuery?.data
		if (!data) return

		await ctx.answerCbQuery()
		await ctx.sendChatAction('typing')

		switch (data) {
			case 'main_menu':
				await this.showMainMenu(ctx)
				break
			case 'search':
				await this.showSearchMenu(ctx)
				break
			case 'types':
				await this.showPropertyTypes(ctx)
				break
			case 'about':
				await this.showAboutFormCity(ctx)
				break
			case 'contacts':
				await this.showContacts(ctx)
				break
			case 'refresh':
				await this.refreshData(ctx)
				break
			case 'help':
				await this.showHelp(ctx)
				break
			case 'search_apartments':
				await this.showApartmentRooms(ctx)
				break
			case 'search_commercial':
				await this.searchCommercial(ctx)
				break
			case 'search_phase_1':
				await this.searchByPhase(ctx, '1 очередь')
				break
			case 'search_phase_2':
				await this.searchByPhase(ctx, '2 очередь')
				break
			case 'search_price':
				await this.showPriceRanges(ctx)
				break
			case 'search_area':
				await this.showAreaRanges(ctx)
				break
			default:
				if (data.startsWith('rooms_')) {
					await this.searchByRooms(ctx, data.replace('rooms_', ''))
				} else if (data.startsWith('price_')) {
					await this.searchByPriceRange(ctx, data.replace('price_', ''))
				} else if (data.startsWith('area_')) {
					await this.searchByAreaRange(ctx, data.replace('area_', ''))
				}
				break
		}
	}

	async handleMessage(ctx: BotContext, message: string) {
		await ctx.sendChatAction('typing')

		const analysis = await this.aiService.analyzePropertyQuery(message)
		let response = ''
		let context = ''

		if (analysis.intent === 'search' || this.isPropertyQuery(message)) {
			const properties = await this.dataService.searchProperties(message)
			context = this.formatPropertiesForAI(properties)

			if (properties.length > 0) {
				response = await this.aiService.generateResponse(
					`Пользователь спрашивает: "${message}". Предоставь информацию на основе найденных объектов недвижимости.`,
					context
				)

				if (properties.length <= 5) {
					response +=
						'\n\n📋 Найденные объекты:\n' +
						this.formatPropertiesForUser(properties)
				} else {
					response +=
						`\n\n📋 Найдено ${properties.length} объектов. Показываю первые 5:\n` +
						this.formatPropertiesForUser(properties.slice(0, 5))
				}
			} else {
				response =
					'К сожалению, по вашему запросу ничего не найдено в базе данных недвижимости.'
			}
		} else {
			const webInfo = await this.scrapingService.getFormCityInfo(message)
			context = webInfo

			response = await this.aiService.generateResponse(
				`Пользователь спрашивает: "${message}". Используй информацию с сайта FormCity для ответа.`,
				context
			)
		}

		await this.sendLongMessage(ctx, response)
		await ctx.reply('Выберите действие:', { reply_markup: mainKeyboard })
	}

	private async showMainMenu(ctx: BotContext) {
		await ctx.editMessageText(
			'🏢 FormCity Bot - Главное меню\n\nВыберите действие:',
			{ reply_markup: mainKeyboard }
		)
	}

	private async showSearchMenu(ctx: BotContext) {
		await ctx.editMessageText(
			'🔍 Поиск недвижимости\n\nВыберите категорию для поиска:',
			{ reply_markup: searchKeyboard }
		)
	}

	private async showApartmentRooms(ctx: BotContext) {
		await ctx.editMessageText(
			'🏠 Поиск квартир\n\nВыберите количество комнат:',
			{ reply_markup: apartmentRoomsKeyboard }
		)
	}

	private async showPriceRanges(ctx: BotContext) {
		await ctx.editMessageText(
			'💰 Поиск по цене\n\nВыберите ценовой диапазон:',
			{ reply_markup: priceRangeKeyboard }
		)
	}

	private async showAreaRanges(ctx: BotContext) {
		await ctx.editMessageText(
			'📐 Поиск по площади\n\nВыберите диапазон площади:',
			{ reply_markup: areaRangeKeyboard }
		)
	}

	private async showPropertyTypes(ctx: BotContext) {
		try {
			const types = await this.dataService.getPropertyTypes()
			const message = `📊 Доступные типы недвижимости:\n${types
				.map(type => `• ${type}`)
				.join('\n')}`
			await ctx.editMessageText(message, { reply_markup: backToMainKeyboard })
		} catch (error) {
			await ctx.editMessageText('Ошибка при получении типов недвижимости.', {
				reply_markup: backToMainKeyboard,
			})
		}
	}

	private async showAboutFormCity(ctx: BotContext) {
		try {
			const info = await this.scrapingService.getFormCityInfo(
				'о компании проекты'
			)
			await ctx.editMessageText(`🏢 О FormCity:\n\n${info}`, {
				reply_markup: backToMainKeyboard,
			})
		} catch (error) {
			await ctx.editMessageText('Ошибка при получении информации о FormCity.', {
				reply_markup: backToMainKeyboard,
			})
		}
	}

	private async showContacts(ctx: BotContext) {
		try {
			const contacts = await this.scrapingService.getFormCityInfo(
				'контакты телефон адрес'
			)
			await ctx.editMessageText(`📞 Контакты FormCity:\n\n${contacts}`, {
				reply_markup: backToMainKeyboard,
			})
		} catch (error) {
			await ctx.editMessageText('Ошибка при получении контактной информации.', {
				reply_markup: backToMainKeyboard,
			})
		}
	}

	private async showHelp(ctx: BotContext) {
		const helpMessage = `❓ Справка по боту

🔍 Поиск недвижимости - найти объекты по параметрам
📊 Типы недвижимости - посмотреть доступные типы
🏢 О FormCity - информация о компании
📞 Контакты - контактная информация
🔄 Обновить данные - обновить базу данных

💬 Вы также можете написать свой вопрос текстом, и я постараюсь помочь!

Примеры вопросов:
• "Покажи квартиры на 5 этаже"
• "Какие есть коммерческие помещения?"
• "Расскажи о проекте FormCity"`

		await ctx.editMessageText(helpMessage, { reply_markup: backToMainKeyboard })
	}

	private async refreshData(ctx: BotContext) {
		try {
			await ctx.editMessageText('🔄 Обновляю данные...', {
				reply_markup: undefined,
			})
			await this.dataService.refreshCache()
			this.scrapingService.clearCache()
			await ctx.editMessageText('✅ Данные успешно обновлены!', {
				reply_markup: backToMainKeyboard,
			})
		} catch (error) {
			await ctx.editMessageText('❌ Ошибка при обновлении данных.', {
				reply_markup: backToMainKeyboard,
			})
		}
	}

	private async searchCommercial(ctx: BotContext) {
		const allProperties = await this.dataService.loadData()
		const properties = allProperties.filter(prop => prop.тип === 'Коммерческое')
		await this.showSearchResults(ctx, properties, 'Коммерческая недвижимость')
	}

	private async searchByPhase(ctx: BotContext, phase: string) {
		const allProperties = await this.dataService.loadData()
		const properties = allProperties.filter(
			prop =>
				prop.очередь &&
				String(prop.очередь).toLowerCase() === phase.toLowerCase()
		)
		await this.showSearchResults(ctx, properties, `Недвижимость - ${phase}`)
	}

	private async searchByRooms(ctx: BotContext, rooms: string) {
		const allProperties = await this.dataService.loadData()
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

	private async searchByPriceRange(ctx: BotContext, range: string) {
		const [min, max] = range.split('_').map(Number)
		const allProperties = await this.dataService.loadData()
		const properties = allProperties.filter(prop => {
			const price = Number(prop.цена)
			return price >= min && (max === 999999999 || price <= max)
		})
		const rangeText =
			max === 999999999
				? `от ${(min / 1000000).toFixed(0)} млн`
				: `${(min / 1000000).toFixed(0)}-${(max / 1000000).toFixed(0)} млн`
		await this.showSearchResults(ctx, properties, `Недвижимость ${rangeText}`)
	}

	private async searchByAreaRange(ctx: BotContext, range: string) {
		const [min, max] = range.split('_').map(Number)
		const allProperties = await this.dataService.loadData()

		console.log(`Поиск по площади ${min}-${max}:`)
		console.log(`Всего объектов: ${allProperties.length}`)

		allProperties.forEach((prop, i) => {
			console.log(
				`${i + 1}. Площадь: "${
					prop.площадь
				}" (тип: ${typeof prop.площадь}, число: ${Number(prop.площадь)})`
			)
		})

		const properties = allProperties.filter(prop => {
			const area = Number(prop.площадь)
			const inRange = area >= min && (max === 999 || area <= max)
			console.log(`Площадь ${area}: в диапазоне ${min}-${max}? ${inRange}`)
			return inRange
		})

		console.log(`Найдено: ${properties.length}`)

		const rangeText = max === 999 ? `от ${min} м²` : `${min}-${max} м²`
		await this.showSearchResults(ctx, properties, `Недвижимость ${rangeText}`)
	}

	private async showSearchResults(
		ctx: BotContext,
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

		const message = `${title}\n\n✅ Найдено ${
			properties.length
		} объектов:\n\n${this.formatPropertiesForUser(properties.slice(0, 10))}`

		if (message.length > 4000) {
			await ctx.editMessageText(
				`${title}\n\n✅ Найдено ${properties.length} объектов. Показываю первые 5:`,
				{ reply_markup: undefined }
			)
			await this.sendLongMessage(
				ctx,
				this.formatPropertiesForUser(properties.slice(0, 5))
			)
			await ctx.reply('Выберите действие:', {
				reply_markup: backToMainKeyboard,
			})
		} else {
			await ctx.editMessageText(message, { reply_markup: backToMainKeyboard })
		}
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

	private async sendLongMessage(ctx: BotContext, message: string) {
		const maxLength = 4000

		if (message.length <= maxLength) {
			await ctx.reply(message)
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
			await ctx.reply(part)
			await new Promise(resolve => setTimeout(resolve, 100))
		}
	}
}
