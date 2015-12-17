/**
 * @author Robin Duda
 *
 * Connects to the backend to send notifications and receive events.
 */

var params = require('./../params');
var Protocol = require('../protocol');
var WebSocket = require('ws');
var host = 'socket://' + params.chatserver.backendHost + ':' + params.chatserver.backendPort + '/';
var socket;

function connect() {
    socket = new WebSocket(host);

    socket.on('open', function open() {
        socket.send(JSON.stringify(new Protocol.Register(params.chatserver.serverName, params.chatserver.websockPort)));
    });

    socket.on('message', function (message) {
        message = JSON.parse(message);

        switch (message.header.action) {
            case "user.event":
                module.exports.onUserEvent(message);
                break;
            case "topic":
                module.exports.onTopicChanged(message);
                break;
            case "message":
                module.exports.onMessage(message);
                break;
            case "server.list":
                module.exports.onServerList(message);
                break;
            case "authenticate":
                module.exports.onAuthentication(message);
                break;
            case "history":
                module.exports.onHistoryLoaded(message);
                break;
            case "room":
                module.exports.onRoomResult(message);
                break;
        }
    });

    socket.on('error', function () {
        console.log("Error: Connection to backend lost, retrying..");
        connect();
    });

    socket.on('close', function () {
        console.log("Error: Connection to backend lost, retrying..");
        connect();
    });
}

connect();

/** the on.* are handlers that should be registered to in order to receive the events. */
module.exports = {
    onUserEvent: function (handler) {
        this.onUserEvent = handler;
    },

    onMessage: function (handler) {
        this.onMessage = handler;
    },

    onTopicChanged: function (handler) {
        this.onTopicChanged = handler;
    },

    onHistoryLoaded: function (handler) {
        this.onHistoryLoaded = handler;
    },

    onAuthentication: function (handler) {
        this.onAuthentication = handler;
    },

    onServerList: function (handler) {
        this.onServerList = handler;
    },

    onRoomResult: function (handler) {
        this.onRoomResult = handler;
    },

    notifyMessage: function (message) {
        this.emitMessageNotification(message);
        this.onMessage(message);
    },

    emitMessageNotification: function (message) {
        socket.send(JSON.stringify(new Protocol.Message(message.content, message.room, message.sender, message.command)));
    },

    notifyCommand: function (message) {
        this.emitMessageNotification(message);
    },

    notifyTopic: function (room, topic) {
        socket.send(JSON.stringify(new Protocol.Topic(room, topic)));
    },

    notifyUserEvent: function (room, user, join) {
        var event = new Protocol.UserEvent(room, user, join);
        socket.send(JSON.stringify(event));
        this.onUserEvent(event);
    },

    getAuthentication: function (username, password, id) {
        socket.send(JSON.stringify(new Protocol.Authenticate(username, password, id)));
    },

    getHistory: function (room, id) {
        socket.send(JSON.stringify(new Protocol.History(room, id)));
    }
    ,

    getServerList: function (id) {
        socket.send(JSON.stringify(new Protocol.ServerList(id)));
    }
    ,

    roomQuery: function (room, username, id, topic) {
        socket.send(JSON.stringify(new Protocol.Room(room, topic, username, id)));
    }
};