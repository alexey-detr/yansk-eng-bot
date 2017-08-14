const MongoClient = require('mongodb').MongoClient;
const config = require('./config');

module.exports = MongoClient.connect(config.dbUrl);
