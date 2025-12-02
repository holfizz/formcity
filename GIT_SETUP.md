# Инструкция по публикации проекта в Git

## Шаг 1: Проверка конфиденциальных данных

Убедитесь, что файл `.env` НЕ будет загружен в репозиторий:

```bash
cat .gitignore | grep .env
```

Должно показать `.env` в списке игнорируемых файлов.

## Шаг 2: Добавление файлов в git

```bash
git add .
```

## Шаг 3: Создание коммита

```bash
git commit -m "Initial commit: FormCity Telegram Bot

- NestJS архитектура с модулями
- Telegram бот с кнопочным интерфейсом
- Интеграция с OpenAI GPT
- Работа с Excel/CSV данными
- Веб-скрапинг FormCity.ru
- Поиск недвижимости по параметрам"
```

## Шаг 4: Создание репозитория на GitHub

1. Перейдите на https://github.com/new
2. Создайте новый репозиторий (например, `formcity-telegram-bot`)
3. НЕ инициализируйте с README, .gitignore или лицензией

## Шаг 5: Подключение удаленного репозитория

```bash
git remote add origin https://github.com/ваш-username/formcity-telegram-bot.git
```

Или с SSH:

```bash
git remote add origin git@github.com:ваш-username/formcity-telegram-bot.git
```

## Шаг 6: Публикация в GitHub

```bash
git branch -M main
git push -u origin main
```

## Шаг 7: Проверка

Откройте репозиторий на GitHub и убедитесь, что:

- ✅ Все файлы проекта загружены
- ✅ Файл `.env` НЕ виден в репозитории
- ✅ Файл `.env.example` присутствует (для примера)

## Альтернатива: Использование VS Code

Если вы используете VS Code:

1. Откройте панель Source Control (Ctrl+Shift+G)
2. Нажмите "Publish Branch"
3. Выберите "Publish to GitHub"
4. Выберите публичный или приватный репозиторий
5. Подтвердите публикацию

## Важно! Безопасность

Перед публикацией убедитесь, что удалили или заменили:

- ❌ Реальные токены Telegram
- ❌ Реальные ключи OpenAI
- ❌ Конфиденциальные данные компании

В файле `.env.example` используйте placeholder значения:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
```

## После публикации

Добавьте в README инструкции для других разработчиков:

1. Как установить зависимости
2. Как настроить `.env` файл
3. Как запустить проект
