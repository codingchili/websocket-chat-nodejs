/**
 * @author Robin Duda
 *
 * Account model for the database.
 */

var mongoose = require('./database').database();
var hash = require('./hash');

var accountSchema = new mongoose.Schema({
        username: String,
        password: String,
        salt: String
    }, {strict: false}
);

var Account = mongoose.model('account', accountSchema);

module.exports = {

    /**
     * Authenticates an account if exists, if not exists then the Account is created.
     * @param username the username of the account.
     * @param password the password of the account.
     * @param callback object {authenticated: boolean, created: boolean}
     */
    authenticate: function (username, password, callback) {
        username = username.toString();
        password = password.toString();

        Account.where({username: username}).findOne(function (err, result) {
                if (result) {
                    hash.calculate(function (err, salt, hash) {
                        callback({authenticated: (result.password === hash), username: username});
                    }, password, result.salt);

                } else if (!err) {
                    hash.calculate(function (err, salt, hash) {
                        new Account({username: username, password: hash, salt: salt})
                            .save(function (err) {
                                callback({authenticated: (err == null), created: (err == null), username: username});
                            });
                    }, password);
                }
            }
        ).exec();
    }
};