/**
 * @author Robin Duda
 *
 * Provides a hashing methods.
 */

var crypto = require('crypto');
var algorithm = 'sha512';
var iterations = 2500;
var salt_bits = 128;

module.exports = {

    /**
     * Calculates the hash for stored passwords.
     * @param callback called on complete with (err, salt, hash)
     * @param pass password string to be hashed.
     * @param salt for use in hashing, if unset one is generated.
     */
    calculate: function (callback, pass, salt) {
        var compute = function (callback, pass, salt) {
            crypto.pbkdf2(pass, new Buffer(salt, 'base64'), iterations, salt_bits, algorithm, function (err, hash) {
                if (err)
                    throw err;

                callback(err, salt, hash.toString('base64'));
            });
        };

        if (!salt) {
            crypto.randomBytes(salt_bits, function (err, salt) {
                compute(callback, pass, salt.toString('base64'));
            });
        } else {
            compute(callback, pass, salt)
        }
    }
};