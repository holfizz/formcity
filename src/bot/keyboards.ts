export const mainKeyboard = {
	inline_keyboard: [
		[
			{ text: '🏢 О Formula City', callback_data: 'about' },
			{ text: '📞 Контакты', callback_data: 'contacts' },
		],
	],
}

export const searchKeyboard = {
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

export const apartmentRoomsKeyboard = {
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

export const priceRangeKeyboard = {
	inline_keyboard: [
		[
			{ text: 'До 5 млн', callback_data: 'price_0_5000000' },
			{ text: '5-10 млн', callback_data: 'price_5000000_10000000' },
		],
		[
			{ text: '10-15 млн', callback_data: 'price_10000000_15000000' },
			{ text: '15-20 млн', callback_data: 'price_15000000_20000000' },
		],
		[
			{ text: '20-30 млн', callback_data: 'price_20000000_30000000' },
			{ text: '30+ млн', callback_data: 'price_30000000_999999999' },
		],
		[{ text: '⬅️ Назад к поиску', callback_data: 'search' }],
	],
}

export const areaRangeKeyboard = {
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

export const backToMainKeyboard = {
	inline_keyboard: [[{ text: '⬅️ Главное меню', callback_data: 'main_menu' }]],
}
