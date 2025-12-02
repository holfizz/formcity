#!/bin/bash

echo "🚀 Публикация FormCity Telegram Bot в Git"
echo ""

echo "📋 Шаг 1: Проверка .gitignore"
if grep -q ".env" .gitignore; then
    echo "✅ .env файл в .gitignore"
else
    echo "❌ ВНИМАНИЕ: .env не в .gitignore!"
    exit 1
fi

echo ""
echo "📋 Шаг 2: Добавление файлов"
git add .

echo ""
echo "📋 Шаг 3: Создание коммита"
git commit -m "Initial commit: FormCity Telegram Bot

Features:
- NestJS архитектура с модулями
- Telegram бот с кнопочным интерфейсом  
- Интеграция с OpenAI GPT
- Работа с Excel/CSV данными
- Веб-скрапинг FormCity.ru
- Поиск недвижимости по параметрам
- Кнопочная навигация
- Поддержка множественных очередей строительства"

echo ""
echo "📋 Шаг 4: Настройка ветки main"
git branch -M main

echo ""
echo "✅ Готово к публикации!"
echo ""
echo "Следующие шаги:"
echo "1. Создайте репозиторий на GitHub"
echo "2. Выполните команду:"
echo "   git remote add origin https://github.com/ваш-username/formcity-telegram-bot.git"
echo "3. Опубликуйте:"
echo "   git push -u origin main"
echo ""
echo "Или используйте кнопку 'Publish Branch' в VS Code"