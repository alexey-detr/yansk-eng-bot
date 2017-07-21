'use strict';

const {Database} = require('mongorito');

class Db {
    constructor(url) {
        this.db = new Database(url);
    }

    async connect() {
        await this.db.connect();
    }
}

module.exports = Db;
