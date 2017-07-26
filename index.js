'use strict';

const _ = require('lodash');
const TelegramBot = require('node-telegram-bot-api');
const Db = require('./db');
const User = require('./models/user');
const Word = require('./models/word');
const Asker = require('./asker');
const config = require('./config');

const bot = new TelegramBot(config.token, {polling: true});
const db = new Db(config.dbUrl);
db.connect();

const SERIAL_CORRECT_ANSWERS_THRESHOLD = 3;
const asker = new Asker(bot, WORD_ASK_INTERVAL, SERIAL_CORRECT_ANSWERS_THRESHOLD);

[
    {
        pattern: /^\/start$/,
        action: async (msg, match) => {
            const userId = msg.from.id;

            let user = await User.findOne({userId});
            if (!user) {
                user = new User({
                    userId,
                    lastAskedAt: new Date(0),
                    createdAt: Date.now(),
                    /**
                     * {wordId: '597640cfcb534142ec2e2251', wrongAnswers: 2, correctAnswers: 3}
                     */
                    words: [],
                });
                await user.save();
                bot.sendMessage(userId, 'Hi, new user! I will help you to learn new words!');
            } else {
                bot.sendMessage(userId, `Hey, you've already learned ${user.get('learnedWordsIds').length} word(s).`);
            }
        }
    },
    {
        pattern: /^\/adm_add_word ([^\n]+)\n(.*)/,
        admin: true,
        action: async (msg, match) => {
            const userId = msg.from.id;

            const wordsInput = _.map(match[1].split(','), _.lowerCase);
            const translationsInput = _.map(match[2].split(','), _.lowerCase);

            let word = await Word.where('words').in(wordsInput).findOne();
            if (!word) {
                word = new Word({
                    words: wordsInput,
                    translations: translationsInput,
                });
                await word.save();
                const message = `New word was saved with ID ${word.get('_id')}\n\n` +
                    `Word:\n` +
                    word.get('words').join('\n') + '\n\n' +
                    `Translations:\n` +
                    word.get('translations').join('\n');
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
