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
                let user = await db.collection('users').findOne({userId});
                if (!user) {
                    user = {
                        userId,
                        createdAt: new Date(),
                        words: [],
                        lastAskedAt: new Date(0),
                        lastRepliedAt: new Date(0),
                        lastAskedWordId: null,
                        lastWordReplied: true,
                    };
                    await db.collection('users').insertOne(user);
                    bot.sendMessage(userId, 'Hi, new user! I will help you to learn new words!');
                } else {
                    await db.collection('users').update({_id: user._id}, {
                        $set: {
                            lastAskedAt: new Date(0),
                            lastRepliedAt: new Date(0),
                            lastAskedWordId: null,
                            lastWordReplied: true,
                        },
                    });
                    bot.sendMessage(userId, `Hey, you've already learned ${user.words.length} word(s).`);
                }
            }
        },
        {
            pattern: /^\/add ([^\n]+)\n(.*)/,
            admin: true,
            action: async (msg, match) => {
                const userId = msg.from.id;

                const wordsInput = _(match[1].split(','))
                    .map(_.toLower)
                    .map(_.trim)
                    .value();
                const translationsInput = _(match[2].split(','))
                    .map(_.toLower)
                    .map(_.trim)
                    .value();

                let word = await db.collection('words').findOne({words: {$in: wordsInput}});
                if (!word) {
                    word = {
                        words: wordsInput,
                        translations: translationsInput,
                        random: Math.random(),
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
            pattern: /^\/list$/,
            admin: true,
            action: (msg, match) => {
                bot.sendMessage(msg.from.id, message, {disable_web_page_preview: true});
            }
        },
        {
            pattern: /^\/stat$/,
            admin: true,
            action: (msg, match) => {
                bot.sendMessage(msg.from.id, `Current number of watchers: ${watchingUserIds.size.toString()}`);
            }
        },
        {
            pattern: /^\/randomize$/,
            admin: true,
            action: async () => {
                const words = await db.collection('words').find().toArray();
                for (const word of words) {
                    db.collection('words').update({_id: word._id}, {
                        $set: {
                            random: Math.random(),
                        },
                    });
                }
            }
        },
    ].forEach((action) => {
        bot.onText(action.pattern, (msg, match) => {
            if (action.admin && msg.from.id !== config.adminUserId) {
                return;
            }
            action.action(msg, match);
        });
    });

    bot.on('callback_query', async callbackQuery => {
        const data = JSON.parse(callbackQuery.data);

        const user = await db.collection('users').findOne({userId: callbackQuery.from.id});
        db.collection('users').update({_id: user._id}, {
            $set: {
                lastRepliedAt: new Date(),
                lastWordReplied: true,
            }
        });

        switch (data.type) {
            case 'guess_translation': {
                const wordIndex = user.words.findIndex(word => {
                    return String(word.wordId) === String(user.lastAskedWordId);
                });
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

                        bot.answerCallbackQuery(callbackQuery.id, 'You learned it! 😁');
                    } else {
                        bot.answerCallbackQuery(callbackQuery.id, 'Correct! 🙂');
                    }
                    db.collection('users').update({_id: user._id}, update);
                } else {
                    db.collection('users').update({_id: user._id}, {
                        $inc: {
                            [`words.${wordIndex}.wrongAnswers`]: 1,
                        },
                    });

                    bot.answerCallbackQuery(callbackQuery.id, 'Wrong! 😔');
                }

                bot.editMessageReplyMarkup({}, {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id,
                });

                break;
            }
        }
    });
}

run();
