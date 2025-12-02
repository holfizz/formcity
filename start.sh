#!/bin/bash

echo "FormCity Telegram Bot - Запуск"

if [ ! -f ".env" ]; then
    echo "Копирую .env.example в .env"
    cp .env.example .env
    echo "Настройте переменные в .env файле"
fi

if [ ! -f "data.xlsx" ] && [ ! -f "data.csv" ]; then
    echo "Создаю тестовые данные"
    node create-test-data.js
fi

echo "Установка зависимостей"
pnpm install

echo "Сборка проекта"
pnpm run build

echo "Запуск бота"
pnpm run start:prod