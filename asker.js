const _ = require('lodash');

class Asker {

    /**
     * @param bot
     * @param {Db} db
     */
    constructor(bot, db) {
        this.CHECK_INTERVAL = 61 * 3 * 1000;
        this.ASK_INTERVAL = 60 * 60 * 1000;
        // this.CHECK_INTERVAL = 2 * 1000;
        // this.ASK_INTERVAL = 3 * 1000;
        this.CORRECT_ANSWER_THRESHOLD = 3;

        this.bot = bot;
        this.db = db;
        this.process();
        setInterval(this.process.bind(this), this.CHECK_INTERVAL);
    }

    async process() {
        const askTimeThreshold = Date.now() - this.ASK_INTERVAL;

        const usersToAsk = await this.db.collection('users').find({
            lastWordReplied: true,
            lastRepliedAt: {$lte: new Date(askTimeThreshold)},
        }).toArray();

        if (usersToAsk.length === 0) {
            return;
        }
        console.log(`There are ${usersToAsk.length} user(s) to ask`);

        for (const user of usersToAsk) {
            console.log(`Processing user ${user.userId}`);

            const learnedWords = _.filter(user.words, word => word.correctAnswers >= this.CORRECT_ANSWER_THRESHOLD);
            const learnedWordIds = _.map(learnedWords, 'wordId');

            console.log(`Learning (or learned) words amount ${user.words.length}`);

            let word = await this.db.collection('words').aggregate([
                {$match: {_id: {$nin: learnedWordIds}}},
                {$sample: {size: 1}},
            ]).next();
            if (!word) {
                continue;
            }

            console.log(`Asking word ${word._id} to user ${user.userId}`);

            this.ensureWordForUser(word, user);
            this.db.collection('users').update({_id: user._id}, {
                $set: {
                    lastAskedWordId: word._id,
                    lastWordReplied: false,
                },
            });

            const wordToAsk = word.words[_.random(0, word.words.length - 1)];
            const message = `Try to guess this one 🤔\n"${wordToAsk}"`;

            const words = await this._findTranslationVariants();
            if (!words.some(item => String(item._id) === String(word._id))) {
                words.pop();
                words.push(word);
            }
            const buttons = _.shuffle(words).map(word => [{
                text: word.translations[_.random(0, word.translations.length - 1)],
                callback_data: JSON.stringify({
                    type: 'guess_translation',
                    wordId: String(word._id),
                }),
            }]);
            const form = {
                reply_markup: {
                    inline_keyboard: buttons,
                },
            };
            this.bot.sendMessage(user.userId, message, form);
        }
    }

    async _findTranslationVariants() {
        return this.db.collection('words').aggregate(
            [
                {$sample: {size: 4}},
            ],
        ).toArray();
    }

    async ensureWordForUser(word, user) {
        if (user.words.some(item => String(item.wordId) === String(word._id))) {
            return;
        }
        const newWord = Asker.initEmbeddedWordObject(word);
        this.db.collection('users').update({_id: user._id}, {
            $push: {
                words: newWord,
            },
            $set: {
                lastAskedAt: new Date(),
            },
        });
    }

    static initEmbeddedWordObject(word) {
        return {
            wordId: word._id,
            wrongAnswers: 0,
            correctAnswers: 0,
            learnedAt: null,
        };
    }
}

module.exports = Asker;
