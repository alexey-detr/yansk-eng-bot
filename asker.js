'use strict';

const User = require('./models/user');

class Asker {
    CHECK_INTERVAL = 63 * 9 * 1000;
    ASK_INTERVAL = 3 * 60 * 60 * 1000;
    CORRECT_ANSWER_THRESHOLD = 3;

    constructor(bot) {
        this.bot = bot;
        this.process();
        setInterval(this.process, this.CHECK_INTERVAL);
    }

    async process() {
        const askTimeThreshold = Date.now().getTime() - this.ASK_INTERVAL;

        const usersToAsk = await User.where({
            lastAskedAt: {$lte: new Date(askTimeThreshold)}
        }).find();
        for (const user of usersToAsk) {
            const learnedWords = _.filter(user.words, word => word.correctAnswers < this.CORRECT_ANSWER_THRESHOLD);
            const learnedWordIds = _.map(learnedWords, 'wordId');

            const word = await Word.where({_id: {$nin: learnedWordIds}}).findOne();
            User.where({userId: user.get('userId')})
                .update({
                    $push: {
                        words: {
                            wordId: word.get('_id'),
                            wrongAnswers: 0,
                            correctAnswers: 0,
                            learnedAt: new Date(0),
                        }
                    }
                });
        }
    }
}

module.exports = Asker;
