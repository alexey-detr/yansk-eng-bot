'use strict';

const TelegramBot = require('node-telegram-bot-api');
const Db = require('./db');
const User = require('./models/user');
const Word = require('./models/word');
const config = require('./config');

const bot = new TelegramBot(config.token, {polling: true});
const db = new Db(config.dbUrl);
db.connect();

[
    {
        pattern: /^\/start$/,
        action: async (msg, match) => {
            const message = "Hi! I'm English learning bot, and I will help you to learn new English words!\n" +
                "Type /help to learn more.";
            bot.sendMessage(msg.from.id, message);

            const user = new User({
                userId: msg.from.id,
                learnedWordsIds: [],
            });
            await user.save();
        }
    },
    {
        pattern: /^\/help$/,
        action: (msg, match) => {
            let message =
                "Hey! You can use following commands:\n\n" +
                "/list – to get info about all fresh versions I've found for ya ^^";
            bot.sendMessage(msg.from.id, message);
        }
    },
    {
        pattern: /^\/adm_add_word$/,
        admin: true,
        action: async (msg, match) => {
            bot.sendMessage(msg.from.id, message, {disable_web_page_preview: true});
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
