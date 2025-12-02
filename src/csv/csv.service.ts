import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'

export interface CsvData {
	category: string
	metric: string
	total: number
	sold: number
	remaining: number
	yearlyData: Record<string, number>
	quarterlyData: Record<string, number>
	monthlyData: Record<string, number>
}

@Injectable()
export class CsvService {
	private readonly logger = new Logger(CsvService.name)
	private readonly csvPath = process.env.CSV_FILE_PATH || './data.csv'
	private cachedData: CsvData[] = []

	async loadCsvData(): Promise<CsvData[]> {
		if (this.cachedData.length > 0) {
			this.logger.log(
				`Returning cached data: ${this.cachedData.length} records`
			)
			return this.cachedData
		}

		try {
			this.logger.log(`Loading CSV from: ${this.csvPath}`)
			const csvContent = fs.readFileSync(this.csvPath, 'utf-8')
			const lines = csvContent.split('\n')
			this.logger.log(`CSV has ${lines.length} lines`)

			this.cachedData = this.parseCsvData(lines)
			this.logger.log(`Parsed ${this.cachedData.length} records from CSV`)

			// Логируем первую запись для проверки
			if (this.cachedData.length > 0) {
				this.logger.log(`Sample record: ${JSON.stringify(this.cachedData[0])}`)
			}

			return this.cachedData
		} catch (error) {
			this.logger.error(`Error loading CSV: ${error.message}`)
			this.logger.error(`Stack: ${error.stack}`)
			return []
		}
	}

	private parseCsvData(lines: string[]): CsvData[] {
		const data: CsvData[] = []
		let currentCategory = ''

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			if (!line.trim()) continue

			const columns = line.split(',')

			// Определяем категорию (строки типа: ,ЖИЛЬЕ,ИТОГО,ПРОДАНО,...)
			if (columns[1] && columns[2] === 'ИТОГО' && columns[3] === 'ПРОДАНО') {
				const category = columns[1].trim().replace(/"/g, '')
				if (category && !category.includes('ПРОЕКТ')) {
					currentCategory = category
					this.logger.log(`Found category: ${currentCategory}`)
				}
				continue
			}

			// Парсим строки с метриками (содержат "руб", "м2", "шт")
			if (columns[1] && currentCategory) {
				const metric = columns[1].trim().replace(/"/g, '')

				if (
					metric.includes('руб') ||
					metric.includes('м2') ||
					metric.includes('шт')
				) {
					const total = this.parseNumber(columns[2])
					const sold = this.parseNumber(columns[3])
					const remaining = this.parseNumber(columns[4])

					// Парсим данные по годам (колонки 6-14: 2025-2033)
					const yearlyData: Record<string, number> = {}
					const years = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]
					for (let j = 0; j < years.length; j++) {
						yearlyData[years[j].toString()] = this.parseNumber(columns[6 + j])
					}

					// Парсим данные по кварталам (колонки 16-51)
					const quarterlyData: Record<string, number> = {}
					let colIndex = 16
					for (let year = 2025; year <= 2033; year++) {
						for (let q = 1; q <= 4; q++) {
							const key = `${q} кв. ${year}`
							quarterlyData[key] = this.parseNumber(columns[colIndex])
							colIndex++
						}
					}

					// Парсим данные по месяцам (колонки 52+)
					const monthlyData: Record<string, number> = {}
					const months = [
						'янв',
						'февр',
						'мар',
						'апр',
						'мая',
						'июн',
						'июл',
						'авг',
						'сент',
						'окт',
						'нояб',
						'дек',
					]
					colIndex = 52
					for (let year = 25; year <= 33; year++) {
						for (const month of months) {
							const key = `${month}-${year}`
							monthlyData[key] = this.parseNumber(columns[colIndex])
							colIndex++
						}
					}

					const record: CsvData = {
						category: currentCategory,
						metric,
						total,
						sold,
						remaining,
						yearlyData,
						quarterlyData,
						monthlyData,
					}

					data.push(record)
					this.logger.log(
						`Added record: ${currentCategory} - ${metric} (total: ${total})`
					)
				}
			}
		}

		return data
	}

	private parseNumber(value: string): number {
		if (!value) return 0
		const cleaned = value.replace(/"/g, '').replace(/,/g, '.').trim()
		const num = parseFloat(cleaned)
		return isNaN(num) ? 0 : num
	}

	async analyzeData(query: string): Promise<string> {
		const data = await this.loadCsvData()

		this.logger.log(`Analyzing query: ${query}`)
		this.logger.log(`Available data records: ${data.length}`)

		if (data.length === 0) {
			return 'Данные из CSV не загружены. Проверьте файл data.csv'
		}

		// Определяем период из запроса
		const yearMatch = query.match(/\b(202[5-9]|203[0-3])\b/)
		const quarterMatch = query.match(/([1-4])\s*кв/)
		const periodMatch = query.match(/с\s*(\d{2})\s*по\s*(\d{2})/)

		let result = ''

		if (periodMatch) {
			// Период с X по Y
			const startYear = parseInt(`20${periodMatch[1]}`)
			const endYear = parseInt(`20${periodMatch[2]}`)
			this.logger.log(`Period query: ${startYear} to ${endYear}`)
			result = this.calculatePeriod(data, startYear, endYear)
		} else if (yearMatch && quarterMatch) {
			// Конкретный квартал года
			const year = yearMatch[0]
			const quarter = quarterMatch[1]
			this.logger.log(`Quarter query: Q${quarter} ${year}`)
			result = this.calculateQuarter(data, year, quarter)
		} else if (yearMatch) {
			// Конкретный год
			const year = yearMatch[0]
			this.logger.log(`Year query: ${year}`)
			result = this.calculateYear(data, year)
		} else {
			// Общая статистика
			this.logger.log(`Total query`)
			result = this.calculateTotal(data)
		}

		return result
	}

	private calculateYear(data: CsvData[], year: string): string {
		let result = `📊 ДАННЫЕ ЗА ${year} ГОД\n\n`

		const categories = [...new Set(data.map(d => d.category))]
		this.logger.log(`Categories: ${categories.join(', ')}`)

		for (const category of categories) {
			const categoryData = data.filter(d => d.category === category)
			result += `${category}\n`

			for (const item of categoryData) {
				const value = item.yearlyData[year] || 0
				if (value > 0) {
					result += `• ${item.metric}: ${this.formatNumber(value)}\n`
				}
			}
			result += `\n`
		}

		return result
	}

	private calculateQuarter(
		data: CsvData[],
		year: string,
		quarter: string
	): string {
		const key = `${quarter} кв. ${year}`
		let result = `📊 ДАННЫЕ ЗА ${key}\n\n`

		const categories = [...new Set(data.map(d => d.category))]

		for (const category of categories) {
			const categoryData = data.filter(d => d.category === category)
			result += `${category}\n`

			for (const item of categoryData) {
				const value = item.quarterlyData[key] || 0
				if (value > 0) {
					result += `• ${item.metric}: ${this.formatNumber(value)}\n`
				}
			}
			result += `\n`
		}

		return result
	}

	private calculatePeriod(
		data: CsvData[],
		startYear: number,
		endYear: number
	): string {
		let result = `📊 ДАННЫЕ ЗА ПЕРИОД ${startYear}-${endYear}\n\n`

		const categories = [...new Set(data.map(d => d.category))]

		for (const category of categories) {
			const categoryData = data.filter(d => d.category === category)
			result += `${category}\n`

			for (const item of categoryData) {
				let sum = 0
				for (let year = startYear; year <= endYear; year++) {
					sum += item.yearlyData[year.toString()] || 0
				}
				if (sum > 0) {
					result += `• ${item.metric}: ${this.formatNumber(sum)}\n`
				}
			}
			result += `\n`
		}

		return result
	}

	private calculateTotal(data: CsvData[]): string {
		let result = `📊 ОБЩАЯ СТАТИСТИКА ПРОЕКТА\n\n`

		const categories = [...new Set(data.map(d => d.category))]

		for (const category of categories) {
			const categoryData = data.filter(d => d.category === category)
			result += `${category}\n`

			for (const item of categoryData) {
				result += `• ${item.metric}\n`
				result += `  Всего: ${this.formatNumber(item.total)}\n`
				result += `  Продано: ${this.formatNumber(item.sold)}\n`
				result += `  Остаток: ${this.formatNumber(item.remaining)}\n`
			}
			result += `\n`
		}

		return result
	}

	private formatNumber(num: number): string {
		if (num >= 1000000) {
			return `${(num / 1000000).toFixed(2)} млн`
		} else if (num >= 1000) {
			return `${(num / 1000).toFixed(2)} тыс`
		}
		return num.toFixed(2)
	}

	async getAllDataAsText(): Promise<string> {
		const data = await this.loadCsvData()

		if (data.length === 0) {
			return 'Данные CSV не загружены'
		}

		let result = 'ФИНАНСОВЫЕ ДАННЫЕ ПРОЕКТА\n\n'

		const categories = [...new Set(data.map(d => d.category))]

		for (const category of categories) {
			result += `${category}:\n`
			const categoryData = data.filter(d => d.category === category)

			for (const item of categoryData) {
				result += `\n${item.metric}\n`
				result += `Всего: ${this.formatNumber(
					item.total
				)}, Продано: ${this.formatNumber(
					item.sold
				)}, Остаток: ${this.formatNumber(item.remaining)}\n`

				// Добавляем данные по годам
				result += `По годам: `
				const years = Object.keys(item.yearlyData).sort()
				const yearData = years
					.map(year => `${year}: ${this.formatNumber(item.yearlyData[year])}`)
					.join(', ')
				result += yearData + '\n'
			}
			result += '\n'
		}

		return result
	}

	refreshCache(): void {
		this.cachedData = []
		this.logger.log('CSV cache cleared')
	}
}
