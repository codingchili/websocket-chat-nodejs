/**
 * @author Robin Duda
 *
 * Passes messages between chatroom-servers.
 *
 * Messages passed to this connector are returned as-is, this means
 * that the header stays intact and the response is appended to the query.
 */

require('./database');
var account = require('./account');
var messaging = require('./messaging');
var rooms = require('./rooms');
var params = require('./../params');
var Protocol = require('../protocol');

var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({port: params.backend.listenPort});

var handler = {};
var servers = [];

module.exports = {
    handler: handler
};

wss.on('connection', function connection(socket) {

    socket.on('message', function incoming(message) {
        console.log(message);
        message = JSON.parse(message);

        if (handler[message.header.action] != null)
            handler[message.header.action](socket, message);
    });

    socket.on('close', function close() {
        for (var i = 0; i < servers.length; i++) {
            if (servers[i].socket == socket) {
                console.log('disconnection: ' + servers[i].name);
                servers.splice(i, 1);
                return;
            }
        }
    });
});

/**
 * Registers a new server for notifications.
 * @param socket websocket to the server.
 * @param message containing additional details. object {name, port}
 */
handler["register"] = function (socket, message) {
    console.log(message);
    servers.push({socket: socket, name: message.name, port: message.port});
};

/**
 * Authenticates an user with the database.
 * @param socket connection to the server initiating the query.
 * @param message the parameters of the request. object {username, password}
 */
handler["authenticate"] = function (socket, message) {
    account.authenticate(message.username, message.password,
        function (result) {
            result.header = message.header;
            socket.send(JSON.stringify(result));
        });
};

/**
 * A chat message that should be forwarded to connected servers, the message
 * forwarded is also stored in the database as the message history for the room.
 * @param socket connection to the server initiating the query.
 * @param message to be broadcast. object {sender, content, room, command}
 */
handler["message"] = function (socket, message) {
    messaging.add(message);
    broadcast(socket, message);
};

/**
 * Sends a message to all connected servers.
 * todo only send the message to servers that are registered for notifications for a specific room.
 * @param socket connection to the server initiating the query.
 * @param message to be broadcast.
 */
function broadcast(socket, message) {
    for (var i = 0; i < servers.length; i++) {
        if (servers[i].socket != socket)
            servers[i].socket.send(JSON.stringify(message));
    }
}

/**
 * Retrieves message history for a specified room.
 * @param socket socket connection to the server initiating the query.
 * @param message specifying the room to fetch from. object {room}
 */
handler["history"] = function (socket, message) {
    messaging.history(message.room, function (result) {
        message.list = result;
        socket.send(JSON.stringify(message));
    });
};

/**
 * Changes the topic of a specified room.
 * @param socket socket connection to the server initiating the query.
 * @param message containing the room and new topic. object {room, topic}
 */
handler["topic"] = function (socket, message) {
    rooms.topic(message.room, message.topic);
    broadcast(socket, message);
};

/**
 * Notification that a user has entered or left a room.
 * @param socket connection to the server initiating the query.
 * @param message containing the event, {username, join: true | false}
 */
handler["user.event"] = function (socket, message) {
    broadcast(socket, message);
};

/**
 * Returns a list of the currently connected chatservers.
 * @param socket connection to the server initiating the query.
 * @param message containing the request header, returned as object {list: [ip, port, name]}
 */
handler["server.list"] = function (socket, message) {
    message.list = getServerNames();
    socket.send(JSON.stringify(message));
};

/**
 * Creates a room if it does not exist, or returns it if it already exists.
 * @param socket connection to the server initiating the query.
 * @param message contains the query. object {room, topic, username, created: true | null}
 *      if the room is created the username is returned as the owner.
 */
handler["room"] = function (socket, message) {
    message.topic = (message.topic != null) ? message.topic : '/topic <string>';

    rooms.create(message.room, message.username, message.topic, function (result) {
        result.header = message.header;
        socket.send(JSON.stringify(result));
    });
};

function getServerNames() {
    var list = [];

    for (var i = 0; i < servers.length; i++) {
        list.push({name: servers[i].name, ip: servers[i].socket._socket.remoteAddress, port: servers[i].port});
    }
    return list;
}