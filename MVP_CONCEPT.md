# Streaming Loudness Adapter Bot

## Идея

Telegram-бот, который принимает готовый миксдаун или мастер в WAV/AIFF/MP3, анализирует громкость и делает безопасную delivery-версию под стриминговые площадки.

Это не AI-мастеринг и не творческий мастер-плагин. Первая версия только адаптирует loudness и пики под выбранную площадку.

## Цель MVP

Сделать минимальную рабочую версию продукта, которую можно дать музыкантам, битмейкерам и продюсерам для проверки идеи.

Пользователь должен суметь:

1. Отправить аудиофайл в Telegram.
2. Получить анализ громкости.
3. Выбрать пресет площадки.
4. Получить обработанный WAV-файл и короткий отчет.

## Главный сценарий

1. Пользователь отправляет файл боту.
2. Бот скачивает файл.
3. Бот анализирует:
   - Integrated LUFS
   - True Peak
   - Sample Peak
   - риск клиппинга
4. Бот показывает результат.
5. Пользователь выбирает пресет:
   - YouTube
   - Spotify
   - Apple Music
   - Custom
6. Бот применяет gain adjustment и true peak limiting.
7. Бот отправляет:
   - обработанный WAV
   - короткий текстовый отчет

## MVP-пресеты

| Preset | Target LUFS | True Peak Ceiling |
| --- | ---: | ---: |
| YouTube | -14 LUFS | -1.0 dBTP |
| Spotify | -14 LUFS | -1.0 dBTP |
| Apple Music | -16 LUFS | -1.0 dBTP |
| Custom | user-defined | user-defined |

## Что делаем в первой версии

- Telegram-бот
- Прием WAV/AIFF/MP3
- Анализ loudness
- Нормализация по Integrated LUFS
- True peak limiting
- Экспорт в WAV
- Короткий отчет до/после

## Что не делаем в первой версии

- VST/AU-плагин
- Web-кабинет
- Регистрация пользователей
- Оплата и подписки
- AI-мастеринг
- Эквализация
- Многополосная компрессия
- Сложный дизайн
- PDF-отчеты

## Технический стек для MVP

- Python
- aiogram для Telegram-бота
- ffmpeg для чтения/конвертации аудио
- ffmpeg loudnorm или pyloudnorm/libebur128 для loudness-анализа
- локальное хранение файлов на старте

Позже можно добавить:

- FastAPI backend
- Redis + Celery для очередей
- S3-compatible storage
- Web UI
- личный кабинет
- оплату

## Первый технический milestone

Собрать локальный прототип без Telegram:

```text
input.wav -> analyze -> process -> output.wav -> report.txt
```

Почему так:

до Telegram-бота нужно убедиться, что аудио-движок корректно считает LUFS и умеет делать обработанный файл.

## Следующий шаг

Создать CLI-скрипт:

```bash
python loudness_adapter.py input.wav --preset spotify
```

Ожидаемый результат:

- файл `input_spotify.wav`
- отчет `input_spotify_report.txt`

