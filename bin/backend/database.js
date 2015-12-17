/**
 * @author Robin Duda
 *
 * Connection to the MongoDB database.
 */

var mongoose = require('mongoose');
var database = 'mongodb://localhost/chatgram';

mongoose.connect(database);
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function (callback) {
});

module.exports = {
    database: function database() {
        return mongoose;
    }
};