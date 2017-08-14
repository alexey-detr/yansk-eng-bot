const _ = require('lodash');
const TelegramBot = require('node-telegram-bot-api');
const Asker = require('./asker');
const config = require('./config');

async function run() {
    const db = await require('./db');

    const bot = new TelegramBot(config.token, {polling: true});
    const asker = new Asker(bot, db);

    [
        {
            pattern: /^\/start$/,
            action: async (msg, match) => {
                const userId = msg.from.id;
                let user = await db.collection('users').findOne();
                if (!user) {
                    user = {
                        userId,
                        lastAskedAt: new Date(0),
                        lastRepliedAt: new Date(0),
                        createdAt: new Date(),
                        words: [],
                        lastAskedWordId: null,
                    };
                    await db.collection('users').insertOne(user);
                    bot.sendMessage(userId, 'Hi, new user! I will help you to learn new words!');
                } else {
                    bot.sendMessage(userId, `Hey, you've already learned ${user.words.length} word(s).`);
                }
            }
        },
        {
            pattern: /^\/adm_add_word ([^\n]+)\n(.*)/,
            admin: true,
            action: async (msg, match) => {
                const userId = msg.from.id;

                const wordsInput = _(match[1].split(','))
                    .map(_.lowerCase)
                    .map(_.trim)
                    .value();
                const translationsInput = _(match[2].split(','))
                    .map(_.lowerCase)
                    .map(_.trim)
                    .value();

                let word = await db.collection('words').findOne({words: {$in: wordsInput}});
                if (!word) {
                    word = {
                        words: wordsInput,
                        translations: translationsInput,
                    };
                    db.collection('words').insertOne(word);
                    const message = `New word was saved with ID ${word._id}\n\n` +
                        `Word:\n` +
                        word.words.join('\n') + '\n\n' +
                        `Translations:\n` +
                        word.translations.join('\n');
                    bot.sendMessage(userId, message);
                }
            }
        },
        {
            pattern: /^\/adm_list_words$/,
            admin: true,
            action: (msg, match) => {
                bot.sendMessage(msg.from.id, message, {disable_web_page_preview: true});
            }
        },
        {
            pattern: /^\/adm_stat$/,
            admin: true,
            action: (msg, match) => {
                bot.sendMessage(msg.from.id, `Current number of watchers: ${watchingUserIds.size.toString()}`);
            }
        }
    ].forEach((action) => {
        bot.onText(action.pattern, (msg, match) => {
            if (action.admin && msg.from.id !== config.adminUserId) {
                return;
            }
            action.action(msg, match);
        });
    });

    bot.on('callback_query', async msg => {
        const data = JSON.parse(msg.data);

        const user = await db.collection('users').findOne({userId: msg.from.id});
        db.collection('users').update({_id: user._id}, {$set: {lastRepliedAt: new Date()}});

        switch (data.type) {
            case 'guess_translation': {
                const wordIndex = _.findIndex(user.words, word => word.wordId);
                const word = user.words[wordIndex];
                if (String(user.lastAskedWordId) === String(data.wordId)) {
                    const update = {
                        $inc: {
                            [`words.${wordIndex}.correctAnswers`]: 1,
                        },
                    };
                    if (word.correctAnswers >= 2) {
                        update.$set = {
                            [`words.${wordIndex}.learnedAt`]: new Date(),
                        };

                        bot.answerCallbackQuery(msg.id, 'You learned it! 😁');
                    } else {
                        bot.answerCallbackQuery(msg.id, 'Correct! 🙂');
                    }
                    db.collection('users').update({_id: user._id}, update);
                } else {
                    db.collection('users').update({_id: user._id}, {
                        $inc: {
                            [`words.${wordIndex}.wrongAnswers`]: 1,
                        },
                    });

                    bot.answerCallbackQuery(msg.id, 'Wrong! 😔');
                }

                break;
            }
        }
    });
}

run();
