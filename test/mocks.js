/**
 * @author Robin Duda
 *
 * Simple mocked socket.
 */

module.exports = {
    Socket: function (callback) {
        var socket = {};

        socket.callback = callback;
        socket._socket = {remoteAddress: 'localhost'};

        socket.send = function (data) {
            if (this.callback)
                this.callback(JSON.parse(data));
        };

        return socket;
    }
};