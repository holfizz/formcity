import * as fs from 'fs'
import { PropertyData } from '../types'

export class DataService {
	private cachedData: PropertyData[] = []
	private lastModified: Date | null = null

	async loadData(filePath?: string): Promise<PropertyData[]> {
		try {
			let dataPath = filePath || process.env.EXCEL_FILE_PATH || './data.csv'

			if (!fs.existsSync(dataPath) && fs.existsSync('./data.csv')) {
				dataPath = './data.csv'
			}

			const stats = fs.statSync(dataPath)
			if (
				this.lastModified &&
				stats.mtime <= this.lastModified &&
				this.cachedData.length > 0
			) {
				return this.cachedData
			}

			console.log(`Loading data from: ${dataPath}`)

			const csvContent = fs.readFileSync(dataPath, 'utf8')
			const lines = csvContent.split('\n').filter(line => line.trim())
			const jsonData = lines.map(line => this.parseCSVLine(line))

			if (jsonData.length === 0) {
				console.warn('Data file is empty')
				return []
			}

			const headers = jsonData[0] as string[]
			const dataRows = jsonData.slice(1)

			this.cachedData = dataRows
				.map((row, index) => {
					const obj: PropertyData = { id: `prop_${index + 1}` }

					headers.forEach((header, colIndex) => {
						if (
							header &&
							row[colIndex] !== null &&
							row[colIndex] !== undefined
						) {
							const key = this.normalizeKey(header)
							obj[key] = row[colIndex]
						}
					})

					return obj
				})
				.filter(obj => Object.keys(obj).length > 1)

			this.lastModified = stats.mtime
			console.log(`Loaded ${this.cachedData.length} properties from data file`)

			return this.cachedData
		} catch (error) {
			console.error(`Error loading data: ${error.message}`)
			throw new Error(`Failed to load data: ${error.message}`)
		}
	}

	async searchProperties(query: string): Promise<PropertyData[]> {
		const data = await this.loadData()

		if (!query || query.trim() === '') {
			return data
		}

		const searchTerm = query.toLowerCase()

		return data.filter(property => {
			return Object.values(property).some(value => {
				if (value === null || value === undefined) return false
				return String(value).toLowerCase().includes(searchTerm)
			})
		})
	}

	async getPropertyTypes(): Promise<string[]> {
		const data = await this.loadData()
		const types = new Set<string>()

		data.forEach(property => {
			if (property.тип) {
				types.add(String(property.тип))
			}
		})

		return Array.from(types)
	}

	private parseCSVLine(line: string): string[] {
		const result: string[] = []
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

	private normalizeKey(header: string): string {
		return header
			.toLowerCase()
			.replace(/\s+/g, '_')
			.replace(/[^\w]/g, '')
			.replace(/^_+|_+$/g, '')
	}

	async refreshCache(): Promise<void> {
		this.lastModified = null
		this.cachedData = []
		await this.loadData()
	}
}
