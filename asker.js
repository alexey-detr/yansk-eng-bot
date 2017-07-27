'use strict';

const _ = require('lodash');
const User = require('./models/user');
const Word = require('./models/word');

class Asker {

    constructor(bot) {
        // this.CHECK_INTERVAL = 63 * 9 * 1000;
        // this.ASK_INTERVAL = 3 * 60 * 60 * 1000;
        this.CHECK_INTERVAL = 5 * 1000;
        this.ASK_INTERVAL = 10 * 1000;
        this.CORRECT_ANSWER_THRESHOLD = 3;

        this.bot = bot;
        this.process();
        setInterval(this.process.bind(this), this.CHECK_INTERVAL);
    }

    async process() {
        const askTimeThreshold = Date.now() - this.ASK_INTERVAL;

        const usersToAsk = await User.where({
            lastAskedAt: {$lte: new Date(askTimeThreshold)}
        }).find();
        for (const user of usersToAsk) {
            console.log(`Processing user ${user.get('userId')}`);

            const learnedWords = _.filter(user.get('words'), word => word.correctAnswers >= this.CORRECT_ANSWER_THRESHOLD);
            const learnedWordIds = _.map(learnedWords, 'wordId');

            console.log(`Learning (or learned) words amount ${user.get('words').length}`);

            const word = await Word.where({_id: {$nin: learnedWordIds}}).findOne();
            if (!word) {
                continue;
            }

            console.log(`Asking word ${word.get('_id')} to user ${user.get('userId')}`);

            Asker._ensureWordForUser(word, user);

            const message = word.get('words').join(', ');
            this.bot.sendMessage(user.get('userId'), message)
        }
    }

    static async _ensureWordForUser(word, user) {
        if (user.get('words').some(item => String(item.wordId) === String(word.get('_id')))) {
            return;
        }
        const wordObject = Asker._initEmbeddedWordObject(word);
        user.get('words').push(wordObject);
        user.set('lastAskedAt', new Date());
        await user.save();
    }

    static _initEmbeddedWordObject(word) {
        return {
            wordId: word.get('_id'),
            wrongAnswers: 0,
            correctAnswers: 0,
            learnedAt: new Date(0),
        };
    }
}

module.exports = Asker;
