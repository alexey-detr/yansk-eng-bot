'use strict';

const {Database} = require('mongorito');
const User = require('./models/user');
const Word = require('./models/word');

class Db {
    constructor(url) {
        this.db = new Database(url);
        this.db.register(User);
        this.db.register(Word);
    }

    async connect() {
        await this.db.connect();
    }
}

module.exports = Db;
