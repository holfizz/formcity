const fs = require('fs')

function normalizeKey(header) {
	return header
		.toLowerCase()
		.replace(/\s+/g, '_')
		.replace(/[^\w]/g, '')
		.replace(/^_+|_+$/g, '')
}

function parseCSVLine(line) {
	const result = []
	let current = ''
	let inQuotes = false

	for (let i = 0; i < line.length; i++) {
		const char = line[i]

		if (char === '"') {
			inQuotes = !inQuotes
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim())
			current = ''
		} else {
			current += char
		}
	}

	result.push(current.trim())
	return result
}

function loadData() {
	const dataPath = './data.csv'

	if (!fs.existsSync(dataPath)) {
		console.log('❌ Файл не найден:', dataPath)
		return []
	}

	const csvContent = fs.readFileSync(dataPath, 'utf8')
	const lines = csvContent.split('\n').filter(line => line.trim())
	const jsonData = lines.map(line => parseCSVLine(line))

	if (jsonData.length === 0) {
		console.log('❌ Файл пустой')
		return []
	}

	const headers = jsonData[0]
	const dataRows = jsonData.slice(1)

	const data = dataRows
		.map((row, index) => {
			const obj = { id: `prop_${index + 1}` }

			headers.forEach((header, colIndex) => {
				if (header && row[colIndex] !== null && row[colIndex] !== undefined) {
					const key = normalizeKey(header)
					obj[key] = row[colIndex]
				}
			})

			return obj
		})
		.filter(obj => Object.keys(obj).length > 1)

	return data
}

function formatPropertiesForAI(properties) {
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

console.log('=== ТЕСТ ЗАГРУЗКИ ДАННЫХ ДЛЯ AI ===\n')

const data = loadData()
console.log(`✅ Загружено объектов: ${data.length}\n`)

if (data.length > 0) {
	console.log('Первый объект:')
	console.log(data[0])
	console.log('\n=== ФОРМАТИРОВАННЫЕ ДАННЫЕ ДЛЯ AI ===\n')
	console.log(formatPropertiesForAI(data))
} else {
	console.log('❌ Данные не загружены!')
}
