import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import * as XLSX from 'xlsx'

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
	проект?: string
	[key: string]: any
}

@Injectable()
export class ExcelService {
	private readonly logger = new Logger(ExcelService.name)
	private cachedData: PropertyData[] = []
	private lastModified: Date | null = null

	async loadExcelData(filePath?: string): Promise<PropertyData[]> {
		try {
			let dataPath = filePath || process.env.EXCEL_FILE_PATH || './data.xlsx'

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

			this.logger.log(`Loading data from: ${dataPath}`)

			let jsonData: any[][]

			if (dataPath.endsWith('.csv')) {
				const csvContent = fs.readFileSync(dataPath, 'utf8')
				const lines = csvContent.split('\n').filter(line => line.trim())
				jsonData = lines.map(line => line.split(','))
			} else {
				try {
					const workbook = XLSX.readFile(dataPath)
					const sheetName = workbook.SheetNames[0]
					const worksheet = workbook.Sheets[sheetName]

					jsonData = XLSX.utils.sheet_to_json(worksheet, {
						header: 1,
						defval: null,
					}) as any[][]
				} catch (xlsxError) {
					this.logger.warn(
						`Failed to read as Excel, trying as CSV: ${xlsxError.message}`
					)
					const csvContent = fs.readFileSync(dataPath, 'utf8')
					const lines = csvContent.split('\n').filter(line => line.trim())
					jsonData = lines.map(line => line.split(','))
				}
			}

			if (jsonData.length === 0) {
				this.logger.warn('Data file is empty')
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
			this.logger.log(
				`Loaded ${this.cachedData.length} properties from data file`
			)

			return this.cachedData
		} catch (error) {
			this.logger.error(`Error loading data: ${error.message}`)
			throw new Error(`Failed to load data: ${error.message}`)
		}
	}

	async searchProperties(query: string): Promise<PropertyData[]> {
		const data = await this.loadExcelData()

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
		const data = await this.loadExcelData()
		const types = new Set<string>()

		data.forEach(property => {
			if (property.тип) {
				types.add(String(property.тип))
			}
		})

		return Array.from(types)
	}

	async getPropertyByPhase(phase: string): Promise<PropertyData[]> {
		const data = await this.loadExcelData()

		return data.filter(
			property =>
				property.очередь &&
				String(property.очередь).toLowerCase() === phase.toLowerCase()
		)
	}

	async getAvailableColumns(): Promise<string[]> {
		const data = await this.loadExcelData()

		if (data.length === 0) return []

		const allKeys = new Set<string>()
		data.forEach(property => {
			Object.keys(property).forEach(key => allKeys.add(key))
		})

		return Array.from(allKeys)
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
		await this.loadExcelData()
	}
}
