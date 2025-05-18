require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Настройка команд бота
bot.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'add_tabletop', description: 'Создать новую настольную игру' },
    { command: 'add_player', description: 'Добавить игрока' },
    { command: 'list', description: 'Показать список настольных игр' },
    { command: 'add_count', description: 'Добавить значение к счетчику' },
    { command: 'delete_game', description: 'Удалить настольную игру' },
    { command: 'delete_player', description: 'Удалить игрока' },
    { command: 'help', description: 'Показать справку' }
]);

// Структура данных:
// players: Map<chatId, Set<playerName>> - список всех игроков в чате
// games: Map<chatId, Map<gameName, Map<playerName, score>>> - очки игроков в играх
const players = new Map();
const games = new Map();

// Флаги для отслеживания состояний
const waitingForTabletopName = new Map();
const waitingForPlayerName = new Map();

// Функция для сохранения данных в файл
async function saveData() {
    const data = {
        players: Array.from(players.entries()).map(([chatId, playerSet]) => [
            chatId,
            Array.from(playerSet)
        ]),
        games: Array.from(games.entries()).map(([chatId, gameMap]) => [
            chatId,
            Array.from(gameMap.entries()).map(([gameName, scoreMap]) => [
                gameName,
                Array.from(scoreMap.entries())
            ])
        ])
    };

    try {
        await fs.writeFile('data.json', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Ошибка при сохранении данных:', error);
    }
}

// Функция для загрузки данных из файла
async function loadData() {
    try {
        const data = JSON.parse(await fs.readFile('data.json', 'utf8'));
        
        // Восстанавливаем players
        data.players.forEach(([chatId, playerArray]) => {
            players.set(chatId, new Set(playerArray));
        });

        // Восстанавливаем games
        data.games.forEach(([chatId, gameArray]) => {
            const gameMap = new Map();
            gameArray.forEach(([gameName, scoreArray]) => {
                gameMap.set(gameName, new Map(scoreArray));
            });
            games.set(chatId, gameMap);
        });

        console.log('Данные успешно загружены');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Файл data.json не найден, создаем новый');
            await saveData();
        } else {
            console.error('Ошибка при загрузке данных:', error);
        }
    }
}

// Загружаем данные при запуске
loadData();

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        'Привет! Я бот для управления настольными играми и счетчиками.\n\n' +
        'Доступные команды:\n' +
        '/add_tabletop - Создать новую настольную игру\n' +
        '/add_player - Добавить игрока\n' +
        '/list - Показать список настольных игр\n' +
        '/add_count - Добавить значение к счетчику\n' +
        '/delete_game - Удалить настольную игру\n' +
        '/delete_player - Удалить игрока\n' +
        '/help - Показать это сообщение'
    );
});

// Обработка команды /add_tabletop
bot.onText(/\/add_tabletop/, (msg) => {
    const chatId = msg.chat.id;
    waitingForTabletopName.set(chatId, true);
    const keyboard = {
        inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'cancel_input' }]
        ]
    };
    bot.sendMessage(chatId, 'Введите название настольной игры:', { reply_markup: keyboard });
});

// Обработка команды /add_player
bot.onText(/\/add_player/, (msg) => {
    const chatId = msg.chat.id;
    waitingForPlayerName.set(chatId, true);
    const keyboard = {
        inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'cancel_input' }]
        ]
    };
    bot.sendMessage(chatId, 'Введите имя игрока:', { reply_markup: keyboard });
});

// Обработка команды /add_count
bot.onText(/\/add_count/, (msg) => {
    const chatId = msg.chat.id;
    if (!games.has(chatId) || games.get(chatId).size === 0) {
        bot.sendMessage(chatId, 'У вас пока нет созданных настольных игр.');
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(games.get(chatId).keys()).map(name => [{
            text: name,
            callback_data: `select_game_${name}`
        }])
    };

    bot.sendMessage(chatId, 'Выберите игру:', { reply_markup: keyboard });
});

// Обработка команды /delete_game
bot.onText(/\/delete_game/, (msg) => {
    const chatId = msg.chat.id;
    if (!games.has(chatId) || games.get(chatId).size === 0) {
        bot.sendMessage(chatId, 'У вас пока нет созданных настольных игр.');
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(games.get(chatId).keys()).map(name => [{
            text: name,
            callback_data: `delete_game_${name}`
        }])
    };

    bot.sendMessage(chatId, 'Выберите игру для удаления:', { reply_markup: keyboard });
});

// Обработка команды /delete_player
bot.onText(/\/delete_player/, (msg) => {
    const chatId = msg.chat.id;
    if (!players.has(chatId) || players.get(chatId).size === 0) {
        bot.sendMessage(chatId, 'У вас пока нет добавленных игроков.');
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(players.get(chatId)).map(name => [{
            text: name,
            callback_data: `delete_player_${name}`
        }])
    };

    bot.sendMessage(chatId, 'Выберите игрока для удаления:', { reply_markup: keyboard });
});

// Функции для обработки callback-запросов
async function handleCancelInput(bot, query) {
    const chatId = query.message.chat.id;
    waitingForTabletopName.set(chatId, false);
    waitingForPlayerName.set(chatId, false);
    await bot.deleteMessage(chatId, query.message.message_id);
    await bot.answerCallbackQuery(query.id, { text: 'Операция отменена' });
}

async function handleSelectGame(bot, query, gameName) {
    const chatId = query.message.chat.id;
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await bot.answerCallbackQuery(query.id, { text: 'Игра не найдена' });
        return;
    }

    const chatPlayers = players.get(chatId);
    if (!chatPlayers || chatPlayers.size === 0) {
        await bot.answerCallbackQuery(query.id, { text: 'Сначала добавьте игроков с помощью команды /add_player' });
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(chatPlayers).map(playerName => [{
            text: playerName,
            callback_data: `add_point_${gameName}_${playerName}`
        }])
    };

    await bot.editMessageText('Выберите игрока:', {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: keyboard
    });
}

async function handleAddPoint(bot, query, gameName, playerName) {
    const chatId = query.message.chat.id;
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await bot.answerCallbackQuery(query.id, { text: 'Игра не найдена' });
        return;
    }

    const game = chatGames.get(gameName);
    if (!game.has(playerName)) {
        game.set(playerName, 0);
    }

    const currentScore = game.get(playerName);
    game.set(playerName, currentScore + 1);
    
    let message = `${gameName}:\n`;
    for (const [player, score] of game) {
        message += `${player}: ${score}\n`;
    }
    
    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id
    });
    await saveData();
}

async function handleDeleteGame(bot, query, gameName) {
    const chatId = query.message.chat.id;
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await bot.answerCallbackQuery(query.id, { text: 'Игра не найдена' });
        return;
    }

    const keyboard = {
        inline_keyboard: [
            [
                { text: 'Да, удалить', callback_data: `confirm_delete_game_${gameName}` },
                { text: 'Отмена', callback_data: 'cancel_delete' }
            ]
        ]
    };

    await bot.editMessageText(
        `Вы уверены, что хотите удалить игру "${gameName}"?\n` +
        'Это действие нельзя отменить!',
        {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: keyboard
        }
    );
}

async function handleDeletePlayer(bot, query, playerName) {
    const chatId = query.message.chat.id;
    const chatPlayers = players.get(chatId);
    
    if (!chatPlayers || !chatPlayers.has(playerName)) {
        await bot.answerCallbackQuery(query.id, { text: 'Игрок не найден' });
        return;
    }

    const keyboard = {
        inline_keyboard: [
            [
                { text: 'Да, удалить', callback_data: `confirm_delete_player_${playerName}` },
                { text: 'Отмена', callback_data: 'cancel_delete' }
            ]
        ]
    };

    await bot.editMessageText(
        `Вы уверены, что хотите удалить игрока "${playerName}"?\n` +
        'Это действие нельзя отменить!',
        {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: keyboard
        }
    );
}

async function handleConfirmDeleteGame(bot, query, gameName) {
    const chatId = query.message.chat.id;
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await bot.answerCallbackQuery(query.id, { text: 'Игра не найдена' });
        return;
    }

    chatGames.delete(gameName);
    await bot.editMessageText(`Игра "${gameName}" удалена!`, {
        chat_id: chatId,
        message_id: query.message.message_id
    });
    await saveData();
}

async function handleConfirmDeletePlayer(bot, query, playerName) {
    const chatId = query.message.chat.id;
    const chatPlayers = players.get(chatId);
    
    if (!chatPlayers || !chatPlayers.has(playerName)) {
        await bot.answerCallbackQuery(query.id, { text: 'Игрок не найден' });
        return;
    }

    chatPlayers.delete(playerName);

    const chatGames = games.get(chatId);
    if (chatGames) {
        for (const game of chatGames.values()) {
            game.delete(playerName);
        }
    }

    await bot.editMessageText(`Игрок "${playerName}" удален!`, {
        chat_id: chatId,
        message_id: query.message.message_id
    });
    await saveData();
}

async function handleCancelDelete(bot, query) {
    await bot.editMessageText('Удаление отменено', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
    });
}

// Обработка callback-запросов
bot.on('callback_query', async (query) => {
    const data = query.data;

    switch (true) {
        case data === 'cancel_input': {
            await handleCancelInput(bot, query);
            return;
        }

        case data.startsWith('select_game_'): {
            const gameName = data.replace('select_game_', '');
            await handleSelectGame(bot, query, gameName);
            break;
        }

        case data.startsWith('add_point_'): {
            const [_, __, gameName, playerName] = data.split('_');
            await handleAddPoint(bot, query, gameName, playerName);
            break;
        }

        case data.startsWith('delete_game_'): {
            const gameName = data.replace('delete_game_', '');
            await handleDeleteGame(bot, query, gameName);
            break;
        }

        case data.startsWith('delete_player_'): {
            const playerName = data.replace('delete_player_', '');
            await handleDeletePlayer(bot, query, playerName);
            break;
        }

        case data.startsWith('confirm_delete_game_'): {
            const gameName = data.replace('confirm_delete_game_', '');
            await handleConfirmDeleteGame(bot, query, gameName);
            break;
        }

        case data.startsWith('confirm_delete_player_'): {
            const playerName = data.replace('confirm_delete_player_', '');
            await handleConfirmDeletePlayer(bot, query, playerName);
            break;
        }

        case data === 'cancel_delete': {
            await handleCancelDelete(bot, query);
            break;
        }
    }

    await bot.answerCallbackQuery(query.id);
});

// Обработка текстовых сообщений
bot.on('text', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Если ожидаем ввод названия игры
    if (waitingForTabletopName.get(chatId)) {
        if (!text.startsWith('/')) {
            const gameName = text;
            if (!games.has(chatId)) {
                games.set(chatId, new Map());
            }
            games.get(chatId).set(gameName, new Map()); // Создаем новую игру с пустым списком очков
            bot.sendMessage(chatId, 
                `Настольная игра "${gameName}" создана!\n` +
                'Используйте команды:\n' +
                `/add_player - добавить игрока\n` +
                `/add_count - добавить очки`
            );
            waitingForTabletopName.set(chatId, false);

            // Сохраняем данные после создания игры
            saveData();
            return;
        }
    }

    // Если ожидаем ввод имени игрока
    if (waitingForPlayerName.get(chatId)) {
        if (!text.startsWith('/')) {
            const playerName = text;
            if (!players.has(chatId)) {
                players.set(chatId, new Set());
            }
            players.get(chatId).add(playerName);
            bot.sendMessage(chatId, `Игрок "${playerName}" добавлен!`);
            waitingForPlayerName.set(chatId, false);

            // Сохраняем данные после добавления игрока
            saveData();
            return;
        }
    }
});

// Обработка команды /list
bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    if (!games.has(chatId) || games.get(chatId).size === 0) {
        bot.sendMessage(chatId, 'У вас пока нет созданных настольных игр.');
        return;
    }

    let message = 'Ваши настольные игры:\n\n';
    for (const [gameName, scores] of games.get(chatId)) {
        message += `${gameName}:\n`;
        if (scores.size === 0) {
            message += '  Нет очков\n';
        } else {
            for (const [player, score] of scores) {
                message += `  ${player}: ${score}\n`;
            }
        }
        message += '\n';
    }

    if (players.has(chatId) && players.get(chatId).size > 0) {
        message += 'Игроки:\n';
        for (const player of players.get(chatId)) {
            message += `- ${player}\n`;
        }
    }

    bot.sendMessage(chatId, message);
});

// Обработка команды /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        'Доступные команды:\n\n' +
        '/add_tabletop - Создать новую настольную игру\n' +
        '/add_player - Добавить игрока\n' +
        '/list - Показать список настольных игр\n' +
        '/add_count - Добавить значение к счетчику\n' +
        '/delete_game - Удалить настольную игру\n' +
        '/delete_player - Удалить игрока\n' +
        '/help - Показать это сообщение'
    );
});

console.log('Бот запущен!');
