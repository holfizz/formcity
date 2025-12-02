export interface PropertyData {
	id?: string
	тип?: string
	подтип?: string
	очередь?: string
	площадь?: number
	цена?: number
	этаж?: number
	комнаты?: number
	статус?: string
	описание?: string
	[key: string]: any
}

export interface ScrapedContent {
	title: string
	content: string
	url: string
	lastUpdated: Date
}

export interface BotContext {
	reply: (message: string) => Promise<void>
	sendChatAction: (action: string) => Promise<void>
}
