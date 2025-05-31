require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const fs = require('fs').promises;
const path = require('path');

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Структура данных:
// players: Map<chatId, Set<playerName>> - список всех игроков в чате
// games: Map<chatId, Map<gameName, Map<playerName, score>>> - очки игроков в играх
const players = new Map();
const games = new Map();

// Флаг для режима Gachi
const gachiModes = new Map();

// Тексты для бота
const texts = {
    normal: {
        start: 'Привет! Я бот для управления настольными играми и счетчиками.\n\n' +
            'Доступные команды:\n' +
            '/add_game - Создать новую настольную игру\n' +
            '/add_player - Добавить игрока\n' +
            '/list - Показать список настольных игр\n' +
            '/add_count - Добавить значение к счетчику\n' +
            '/delete_game - Удалить настольную игру\n' +
            '/delete_player - Удалить игрока\n' +
            '/help - Показать это сообщение',
        help: 'Доступные команды:\n\n' +
            '/add_game - Создать новую настольную игру\n' +
            '/add_player - Добавить игрока\n' +
            '/list - Показать список настольных игр\n' +
            '/add_count - Добавить значение к счетчику\n' +
            '/delete_game - Удалить настольную игру\n' +
            '/delete_player - Удалить игрока\n' +
            '/help - Показать это сообщение',
        enterGameName: 'Введите название настольной игры:',
        enterPlayerName: 'Введите имя игрока:',
        gameCreated: (gameName) => `Настольная игра "${gameName}" создана!\n` +
            'Используйте команды:\n' +
            `/add_player - добавить игрока\n` +
            `/add_count - добавить очки`,
        gameWrongName: (gameName) => `"${gameName}" - неправильное название для игры!`,
        playerAdded: (playerName) => `Игрок "${playerName}" добавлен!`,
        playerWrongName: (playerName) => `"${playerName}" - неправильное имя игрока!`,
        noGames: 'У вас пока нет созданных настольных игр.',
        noPlayers: 'У вас пока нет добавленных игроков.',
        selectGame: 'Выберите игру:',
        selectPlayer: 'Выберите игрока:',
        selectGameForDeletion: 'Выберите игру для удаления:',
        selectPlayerForDeletion: 'Выберите игрока для удаления:',
        confirmGameDeletion: (gameName) => `Вы уверены, что хотите удалить игру "${gameName}"?\n` +
            'Это действие нельзя отменить!',
        confirmPlayerDeletion: (playerName) => `Вы уверены, что хотите удалить игрока "${playerName}"?\n` +
            'Это действие нельзя отменить!',
        gameDeleted: (gameName) => `Игра "${gameName}" удалена!`,
        playerDeleted: (playerName) => `Игрок "${playerName}" удален!`,
        deletionCancelled: 'Удаление отменено',
        adminOnlyGames: 'Только администраторы могут удалять игры!',
        adminOnlyPlayers: 'Только администраторы могут удалять игроков!',
        currentScore: (playerName, gameName, score) => 
            `Текущий счет игрока ${playerName} в игре ${gameName}: ${score}\n` +
            'Выберите изменение или введите новое значение:',
        scoreCancelled: 'Установка счета отменена',
        enterCustomScore: (playerName, gameName) => 
            `Введите новое количество очков для игрока ${playerName} в игре ${gameName}:`,
        pleaseEnterNumber: 'Пожалуйста, введите число.',
        operationCancelled: 'Операция отменена'
    },
    gachi: {
        start: '♂️ BOY NEXT DOOR! ♂️\n\n' +
            '♂️ Доступные команды: ♂️\n' +
            '/add_game - Создать новую GACHI игру\n' +
            '/add_player - Добавить ♂️SLAVE♂️\n' +
            '/list - Показать список GACHI игр\n' +
            '/add_count - Добавить DICK POINTS\n' +
            '/delete_game - Удалить GACHI игру\n' +
            '/delete_player - Удалить ♂️SLAVE♂️\n' +
            '/help - Показать это сообщение',
        help: '♂️ Доступные команды: ♂️\n\n' +
            '/add_game - Создать новую GACHI игру\n' +
            '/add_player - Добавить ♂️SLAVE♂️\n' +
            '/list - Показать список GACHI игр\n' +
            '/add_count - Добавить DICK POINTS\n' +
            '/delete_game - Удалить GACHI игру\n' +
            '/delete_player - Удалить ♂️SLAVE♂️\n' +
            '/help - Показать это сообщение',
        enterGameName: '♂️ Введите название GACHI игры: ♂️',
        enterPlayerName: '♂️ Введите имя ♂️SLAVE♂️: ♂️',
        gameCreated: (gameName) => `♂️ GACHI игра "${gameName}" создана! ♂️\n` +
            '♂️ Используйте команды: ♂️\n' +
            `/add_player - добавить ♂️SLAVE♂️\n` +
            `/add_count - добавить DICK POINTS`,
        gameWrongName: (gameName) => `♂️ You are bad ♂️BOY♂️. "${gameName}" - плохое название для GACHI игры! ♂️`,
        playerAdded: (playerName) => `♂️ ♂️SLAVE♂️ "${playerName}" добавлен! ♂️`,
        playerWrongName: (playerName) => `♂️ You are bad ♂️BOY♂️. "${playerName}" - плохое имя для ♂️SLAVE♂️! ♂️`,
        noGames: '♂️ У вас пока нет GACHI игр! ♂️',
        noPlayers: '♂️ У вас пока нет ♂️SLAVE♂️! ♂️',
        selectGame: '♂️ Выберите GACHI игру: ♂️',
        selectPlayer: '♂️ Выберите ♂️SLAVE♂️: ♂️',
        selectGameForDeletion: '♂️ Выберите GACHI игру для удаления: ♂️',
        selectPlayerForDeletion: '♂️ Выберите ♂️SLAVE♂️ для удаления: ♂️',
        confirmGameDeletion: (gameName) => `♂️ Вы уверены, что хотите удалить GACHI игру "${gameName}"? ♂️\n` +
            '♂️ Это действие нельзя отменить! ♂️',
        confirmPlayerDeletion: (playerName) => `♂️ Вы уверены, что хотите удалить ♂️SLAVE♂️ "${playerName}"? ♂️\n` +
            '♂️ Это действие нельзя отменить! ♂️',
        gameDeleted: (gameName) => `♂️ GACHI игра "${gameName}" удалена! ♂️`,
        playerDeleted: (playerName) => `♂️ ♂️SLAVE♂️ "${playerName}" удален! ♂️`,
        deletionCancelled: '♂️ Удаление отменено ♂️',
        adminOnlyGames: '♂️ Только DADDY может удалять GACHI игры! ♂️',
        adminOnlyPlayers: '♂️ Только DADDY может удалять ♂️SLAVES♂️! ♂️',
        currentScore: (playerName, gameName, score) => 
            `♂️ Текущие DICK POINTS ♂️SLAVE♂️ ${playerName} в GACHI игре ${gameName}: ${score} ♂️\n` +
            '♂️ Выберите изменение или введите новое значение: ♂️',
        scoreCancelled: '♂️ Установка DICK POINTS отменена ♂️',
        enterCustomScore: (playerName, gameName) => 
            `♂️ Введите новое количество DICK POINTS для ♂️SLAVE♂️ ${playerName} в GACHI игре ${gameName}: ♂️`,
        pleaseEnterNumber: '♂️ Пожалуйста, введите число! ♂️',
        operationCancelled: '♂️ Операция отменена ♂️'
    }
};

// Функция для получения текста в зависимости от режима
function getText(chatId, key, ...args) {
    const mode = gachiModes.get(chatId) ? 'gachi' : 'normal';
    const text = texts[mode][key];
    return typeof text === 'function' ? text(...args) : text;
}

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
        ]),
        gachiModes: Array.from(gachiModes.entries())
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

        // Восстанавливаем gachiModes
        if (data.gachiModes) {
            data.gachiModes.forEach(([chatId, mode]) => {
                gachiModes.set(chatId, mode);
            });
        }

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

// Создаем сцены для обработки ввода
const addTabletopScene = new Scenes.BaseScene('add_game');
const addPlayerScene = new Scenes.BaseScene('add_player');
const setScoreScene = new Scenes.BaseScene('set_score');

// Обработка сцены добавления игры
addTabletopScene.enter(async (ctx) => {
    await ctx.reply(getText(ctx.chat.id, 'enterGameName'), {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Отмена', callback_data: 'cancel_input' }]
            ]
        }
    });
});

addTabletopScene.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const gameName = ctx.message.text;

    if (gameName.startsWith('/')) {
        await ctx.reply(getText(chatId, 'gameWrongName', gameName));
        return;
    }

    if (!games.has(chatId)) {
        games.set(chatId, new Map());
    }
    games.get(chatId).set(gameName, new Map());

    await ctx.reply(getText(chatId, 'gameCreated', gameName));
    await saveData();
    await ctx.scene.leave();
});

// Обработка сцены добавления игрока
addPlayerScene.enter(async (ctx) => {
    await ctx.reply(getText(ctx.chat.id, 'enterPlayerName'), {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Отмена', callback_data: 'cancel_input' }]
            ]
        }
    });
});

addPlayerScene.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const playerName = ctx.message.text;

    if (playerName.startsWith('/')) {
        await ctx.reply(getText(chatId, 'playerWrongName', playerName));
        return;
    }

    if (!players.has(chatId)) {
        players.set(chatId, new Set());
    }
    players.get(chatId).add(playerName);

    await ctx.reply(getText(chatId, 'playerAdded', playerName));
    await saveData();
    await ctx.scene.leave();
});

// Обработка сцены установки счета
setScoreScene.enter(async (ctx) => {
    const chatId = ctx.chat.id;
    if (!games.has(chatId) || games.get(chatId).size === 0) {
        await ctx.reply(getText(chatId, 'noGames'));
        await ctx.scene.leave();
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(games.get(chatId).keys()).map(name => [{
            text: name,
            callback_data: `select_game_for_score_${name}`
        }])
    };

    await ctx.reply(getText(chatId, 'selectGame'), { reply_markup: keyboard });
});

setScoreScene.action(/select_game_for_score_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const gameName = ctx.match[1];
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
        return;
    }

    const chatPlayers = players.get(chatId);
    if (!chatPlayers || chatPlayers.size === 0) {
        await ctx.answerCbQuery(getText(chatId, 'noPlayers'));
        return;
    }

    // Сохраняем выбранную игру в контексте сцены
    ctx.scene.state.gameName = gameName;

    const keyboard = {
        inline_keyboard: Array.from(chatPlayers).map(playerName => [{
            text: playerName,
            callback_data: `select_player_for_score_${playerName}`
        }])
    };

    await ctx.editMessageText(getText(chatId, 'selectPlayer'), { reply_markup: keyboard });
});

setScoreScene.action(/select_player_for_score_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const playerName = ctx.match[1];
    const gameName = ctx.scene.state.gameName;
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
        return;
    }

    const game = chatGames.get(gameName);

    // Сохраняем выбранного игрока в контексте сцены
    ctx.scene.state.playerName = playerName;

    await ctx.editMessageText(getText(ctx.chat.id, 'enterCustomScore', ctx.scene.state.playerName, ctx.scene.state.gameName));
});

setScoreScene.action(/score_(-?\d+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const score = parseInt(ctx.match[1]);
    const gameName = ctx.scene.state.gameName;
    const playerName = ctx.scene.state.playerName;
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
        return;
    }

    const game = chatGames.get(gameName);
    game.set(playerName, score);
    
    let message = `${gameName}:\n`;
    for (const [player, playerScore] of game) {
        message += `${player}: ${playerScore}\n`;
    }
    
    await ctx.editMessageText(message);
    await saveData();
    await ctx.scene.leave();
});

setScoreScene.action('score_custom', async (ctx) => {
    await ctx.editMessageText(getText(ctx.chat.id, 'enterCustomScore', ctx.scene.state.playerName, ctx.scene.state.gameName));
});

setScoreScene.action('cancel_score', async (ctx) => {
    await ctx.editMessageText(getText(ctx.chat.id, 'scoreCancelled'));
    await ctx.scene.leave();
});

setScoreScene.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const score = parseInt(ctx.message.text);
    const gameName = ctx.scene.state.gameName;
    const playerName = ctx.scene.state.playerName;
    
    if (isNaN(score)) {
        await ctx.reply(getText(chatId, 'pleaseEnterNumber'));
        return;
    }

    const chatGames = games.get(chatId);
    if (chatGames && chatGames.has(gameName)) {
        const game = chatGames.get(gameName);
        game.set(playerName, score);
        
        let message = `${gameName}:\n`;
        for (const [player, playerScore] of game) {
            message += `${player}: ${playerScore}\n`;
        }
        
        await ctx.reply(message);
        await saveData();
    }

    await ctx.scene.leave();
});

// Создаем менеджер сцен
const stage = new Scenes.Stage([addTabletopScene, addPlayerScene, setScoreScene]);
bot.use(session());
bot.use(stage.middleware());

// Настройка команд бота
bot.telegram.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'add_game', description: 'Создать новую настольную игру' },
    { command: 'add_player', description: 'Добавить игрока' },
    { command: 'list', description: 'Показать список настольных игр' },
    { command: 'add_count', description: 'Добавить значение к счетчику' },
    { command: 'set_score', description: 'Установить количество очков игрока' },
    { command: 'delete_game', description: 'Удалить настольную игру' },
    { command: 'delete_player', description: 'Удалить игрока' },
    { command: 'help', description: 'Показать справку' },
    { command: 'set_true_nature', description: 'Переключить режим' }
]);

// Обработка команды /start
bot.command('start', async (ctx) => {
    await ctx.reply(getText(ctx.chat.id, 'start'));
});

// Обработка команды /add_game
bot.command('add_game', async (ctx) => {
    await ctx.scene.enter('add_game');
});

// Обработка команды /add_player
bot.command('add_player', async (ctx) => {
    await ctx.scene.enter('add_player');
});

// Обработка команды /add_count
bot.command('add_count', async (ctx) => {
    const chatId = ctx.chat.id;
    if (!games.has(chatId) || games.get(chatId).size === 0) {
        await ctx.reply(getText(chatId, 'noGames'));
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(games.get(chatId).keys()).map(name => [{
            text: name,
            callback_data: `select_game_${name}`
        }])
    };

    await ctx.reply(getText(chatId, 'selectGame'), { reply_markup: keyboard });
});

// Функция для проверки прав администратора
async function isAdmin(ctx) {
    const chatId = ctx.chat.id;
    
    // В личных чатах всегда возвращаем true
    if (ctx.chat.type === 'private') {
        return true;
    }
    
    const chatMember = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    return ['creator', 'administrator'].includes(chatMember.status);
}

// Обработка команды /delete_game
bot.command('delete_game', async (ctx) => {
    const chatId = ctx.chat.id;
    
    if (!await isAdmin(ctx)) {
        await ctx.reply(getText(chatId, 'adminOnlyGames'));
        return;
    }

    if (!games.has(chatId) || games.get(chatId).size === 0) {
        await ctx.reply(getText(chatId, 'noGames'));
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(games.get(chatId).keys()).map(name => [{
            text: name,
            callback_data: `delete_game_${name}`
        }])
    };

    await ctx.reply(getText(chatId, 'selectGameForDeletion'), { reply_markup: keyboard });
});

// Обработка команды /delete_player
bot.command('delete_player', async (ctx) => {
    const chatId = ctx.chat.id;
    
    if (!await isAdmin(ctx)) {
        await ctx.reply(getText(chatId, 'adminOnlyPlayers'));
        return;
    }

    if (!players.has(chatId) || players.get(chatId).size === 0) {
        await ctx.reply(getText(chatId, 'noPlayers'));
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(players.get(chatId)).map(name => [{
            text: name,
            callback_data: `delete_player_${name}`
        }])
    };

    await ctx.reply(getText(chatId, 'selectPlayerForDeletion'), { reply_markup: keyboard });
});

// Обработка команды /list
bot.command('list', async (ctx) => {
    const chatId = ctx.chat.id;
    if (!games.has(chatId) || games.get(chatId).size === 0) {
        await ctx.reply(getText(chatId, 'noGames'));
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

    await ctx.reply(message);
});

// Обработка команды /help
bot.command('help', async (ctx) => {
    await ctx.reply(getText(ctx.chat.id, 'help'));
});

// Обработка команды /set_score
bot.command('set_score', async (ctx) => {
    if (!await isAdmin(ctx)) {
        await ctx.reply(getText(chatId, 'adminOnlyPlayers'));
        return;
    }

    await ctx.scene.enter('set_score');
});

// Обработка команды /set_true_nature
bot.command('set_true_nature', async (ctx) => {
    const chatId = ctx.chat.id;
    const currentMode = gachiModes.get(chatId);
    gachiModes.set(chatId, !currentMode);
    await ctx.reply(gachiModes.get(chatId) ? '♂️ GACHI MODE ACTIVATED! ♂️' : '♂️ GACHI MODE DEACTIVATED! ♂️');
    await saveData();
});

// Обработка callback-запросов
bot.action('cancel_input', async (ctx) => {
    await ctx.deleteMessage();
    await ctx.answerCbQuery(getText(ctx.chat.id, 'operationCancelled'));
    await ctx.scene.leave();
});

bot.action(/select_game_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const gameName = ctx.match[1];
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
        return;
    }

    const chatPlayers = players.get(chatId);
    if (!chatPlayers || chatPlayers.size === 0) {
        await ctx.answerCbQuery(getText(chatId, 'noPlayers'));
        return;
    }

    const keyboard = {
        inline_keyboard: Array.from(chatPlayers).map(playerName => [{
            text: playerName,
            callback_data: `add_point_${gameName}_${playerName}`
        }])
    };

    await ctx.editMessageText(getText(chatId, 'selectPlayer'), { reply_markup: keyboard });
});

bot.action(/add_point_(.+)_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const [gameName, playerName] = [ctx.match[1], ctx.match[2]];
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
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
    
    await ctx.editMessageText(message);
    await saveData();
});

bot.action(/^delete_game_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;
    const gameName = ctx.match[1];
    const chatGames = games.get(chatId);

    if (!chatGames || !chatGames.has(gameName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
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

    await ctx.editMessageText(
        getText(chatId, 'confirmGameDeletion', gameName),
        { reply_markup: keyboard }
    );
});

bot.action(/^delete_player_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;
    const playerName = ctx.match[1];
    const chatPlayers = players.get(chatId);

    if (!chatPlayers || !chatPlayers.has(playerName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
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

    try {
        await ctx.telegram.editMessageText(
            chatId,
            messageId,
            null,
            getText(chatId, 'confirmPlayerDeletion', playerName),
            { reply_markup: keyboard }
        );
    } catch (error) {
        console.error('Ошибка при обновлении сообщения:', error);
    }
});

bot.action(/confirm_delete_game_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;
    const gameName = ctx.match[1];
    const chatGames = games.get(chatId);
    
    if (!chatGames || !chatGames.has(gameName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
        return;
    }

    chatGames.delete(gameName);

    try {
        await ctx.telegram.editMessageText(
            chatId,
            messageId,
            null,
            getText(chatId, 'gameDeleted', gameName)
        );
    } catch (error) {
        console.error('Ошибка при обновлении сообщения:', error);
    }
    await saveData();
});

bot.action(/confirm_delete_player_(.+)/, async (ctx) => {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;
    const playerName = ctx.match[1];
    const chatPlayers = players.get(chatId);
    
    if (!chatPlayers || !chatPlayers.has(playerName)) {
        await ctx.answerCbQuery(getText(chatId, 'operationCancelled'));
        return;
    }

    chatPlayers.delete(playerName);

    const chatGames = games.get(chatId);
    if (chatGames) {
        for (const game of chatGames.values()) {
            game.delete(playerName);
        }
    }
    console.log(chatId, messageId, ctx.callbackQuery.message.text);

    try {
        await ctx.telegram.editMessageText(
            chatId,
            messageId,
            null,
            getText(chatId, 'playerDeleted', playerName)
        );
    } catch (error) {
        console.error('Ошибка при обновлении сообщения:', error);
    }
    await saveData();
});

bot.action('cancel_delete', async (ctx) => {
    await ctx.editMessageText(getText(ctx.chat.id, 'deletionCancelled'));
});

// Запуск бота
bot.launch(() => {
    console.log('Бот запущен!');
}).catch((err) => {
    console.error('Ошибка при запуске бота:', err);
});

// Включаем graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));