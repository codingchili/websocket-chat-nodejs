/**
 * @author Robin Duda
 *
 * The chatserver implementation.
 *
 * The methods in the messageHandler that requires a query to the
 * backend database will be sent to the backend with the socket id in the header.
 *
 * Messages returned from the backend will be parsed in the eventHandler and
 * then returned back to the client.
 */

var Protocol = require('./../protocol');
var params = require('./../params');
var uuid = require('uuid');
var events = require('./events.js');
var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({port: params.chatserver.websockPort});

var VERSION = "NODE";
var rooms = {};     // a cache of rooms which have users.
var clients = {};   // client pool, required for reverse lookups during callbacks.
var defaultRoom = {topic: 'Public channel', room: params.chatserver.defaultRoomName};
var serverName = params.chatserver.serverName;

wss.on('connection', function connection(socket) {

    socket.on('message', function incoming(message) {
        message = JSON.parse(message);
        messageHandler.process(socket, message);
    });


    socket.on('close', function close() {
        onLeaveRoom(socket);
        delete clients[socket.id];
    });

    // fixes an issue where the client re-upgrades without closing/resetting the socket.
    onLeaveRoom(socket);
    delete socket.username;

    socket.id = uuid.v4();
    clients[socket.id] = socket;

    sendSystem(socket, 'Connected to ' + serverName);
    sendRoomData(socket, {room: 'SYSTEM', topic: 'Authentication Required'});
    authenticationRequired(socket);
});

messageHandler = {

    /**
     * Inspects an incoming message to determine the correct handler method,
     * the authentication status of the sender is also verified.
     * @param socket the sender.
     * @param message the complete message with header and body. object {header: {action: '?'}, ...}
     */
    process: function (socket, message) {
        if (this[message.header.action] != null) {
            if (message.header.action != new Protocol.Authenticate().header.action && !socket.username)
                authenticationRequired(socket);
            else
                this[message.header.action](socket, message);
        }
    },

    /**
     * Authenticates a user or creates if it does not exist.
     * @param socket the sender.
     * @param message object {password, username}
     */
    authenticate: function (socket, message) {
        deAuthenticate(socket);
        events.getAuthentication(message.username, message.password, socket.id);
    },

    /**
     * Move the user to the specified room, if it does not exist it is created.
     * @param socket the sender.
     * @param message object {room}
     */
    join: function (socket, message) {
        joinRoom(socket, message);
    },

    /**
     * Set the topic of the room.
     * @param socket the sender.
     * @param message object {topic}
     */
    topic: function (socket, message) {
        setRoomTopic(socket, message);
    },

    /**
     * Request the list of servers connected to the backend/connector.
     * @param socket the sender.
     */
    "server.list": function (socket) {
        events.getServerList(socket.id);
    },

    /**
     * Get a list of commands from the server.
     * @param socket the sender.
     */
    help: function (socket) {
        var message = new Protocol.Message('Available commands: /join <string> , /topic <string>, /servers, /help.');
        socket.send(JSON.stringify(message));
    },

    /**
     * Send a message to the currently joined room.
     * @param socket the sender.
     * @param message {content}
     */
    message: function (socket, message) {
        events.notifyMessage({
            room: socket.room,
            sender: socket.username,
            content: message.content
        });
    }
};

module.exports = {
    handler: messageHandler
};

function deAuthenticate(socket) {
    onLeaveRoom(socket);
    delete socket.username;
}

function authenticationRequired(socket) {
    sendSystem(socket, 'Authentication Required.');
    sendSystem(socket, '/authenticate <username> <password>');
}

function sendSystem(socket, content) {
    socket.send(JSON.stringify(new Protocol.Message(content)));
}

/**
 * Send a message to all users in the specified room.
 * @param event object {content, room, sender, command}
 */
function sendRoom(event) {
    var room = rooms[event.room];
    var message = JSON.stringify(new Protocol.Message(event.content, event.room, event.sender, event.command));

    for (var i = 0; i < room.clients.length; i++) {
        room.clients[i].send(message);
    }
}

function onLeaveRoom(socket) {
    if (socket.room) {
        var index = rooms[socket.room].clients.indexOf(socket);
        rooms[socket.room].clients.splice(index, 1);

        events.notifyUserEvent(socket.room, socket.username, false);

        if (rooms[socket.room].clients.length == 0) {
            delete rooms[socket.room];
        }
        delete socket.room;
    }
}

function joinRoom(socket, message) {
    onLeaveRoom(socket);
    var room = rooms[message.room];

    // if the room is not in the cache; get a fresh copy from the backend.
    if (room == null) {
        sendSystem(socket, "Loading room..");
        events.roomQuery(message.room, socket.username, socket.id, message.topic);
    } else
        onJoinedRoom(socket, room);
}

function onJoinedRoom(socket, data) {
    socket.room = data.room;
    rooms[data.room].clients.push(socket);
    sendRoomData(socket, data);
    events.getHistory(data.room, socket.id);
}

function sendRoomData(socket, data) {
    socket.send(JSON.stringify(new Protocol.Join(data.room, data.topic, VERSION)));
}

function notifyRoom(name, user, joined) {
    var room = rooms[name];

    for (var i = 0; i < room.clients.length; i++) {
        sendSystem(room.clients[i], user + ' has ' + ((joined == true) ? 'joined' : 'left') + ' the room.')
    }
}

function sendCommand(socket, content) {
    var room = rooms[socket.room];
    var message = new Protocol.Message(content);
    message.command = true;

    for (var i = 0; i < room.clients.length; i++)
        room.clients[i].send(JSON.stringify(message))

    message.room = socket.room;
    events.notifyCommand(message);
}

function setRoomTopic(socket, message) {
    if (rooms[socket.room].owner == socket.username) {
        rooms[socket.room].topic = message.topic;
        events.notifyTopic(socket.room, message.topic);
        broadcastRoomData(socket.room);
        sendCommand(socket, socket.username + " changed the topic to '" + message.topic + "'.");
    } else {
        sendSystem(socket, "Error: Not authorized to change room, not the owner.");
    }
}

function broadcastRoomData(name) {
    var room = rooms[name];

    for (var i = 0; i < room.clients.length; i++) {
        sendRoomData(room.clients[i], room);
    }
}

/**
 * The asynchronous nature of the backend callbacks requires the clients
 * existence to be proven for every callback received.
 * @param event the server generated event.
 * @returns {boolean} indicating if the event is still applicable.
 */
function isValidEvent(event) {
    return (clients[event.header.actor] != null && (event.room == null || rooms[event.room] != null));
}

// authentication response has been received.
events.onAuthentication(function (event) {
    if (isValidSocket(event)) {
        var socket = clients[event.header.actor];

        if (event.authenticated == true) {
            socket.username = event.username;

            onLeaveRoom(socket);
            sendSystem(socket, (event.created == true)
                ? "Registered account '" + socket.username + "'." : "Authentication succeeded.");
            joinRoom(socket, defaultRoom);
        } else
            sendSystem(socket, "Authentication failed.");
    }
});

function isValidSocket(event) {
    return (clients[event.header.actor] != null);
}

/**
 * Called when the history is returned from the backend.
 */
events.onHistoryLoaded(function (event) {
    if (isValidEvent(event)) {
        var socket = clients[event.header.actor];
        var history = new Protocol.History();
        history.list = event.list;
        history.room = event.room;

        socket.send(JSON.stringify(history));
        events.notifyUserEvent(socket.room, socket.username, true);
    }
});

/**
 * The server list was returned queried by the user with the id of the event.
 */
events.onServerList(function (event) {
    if (isValidEvent(event)) {
        sendSystem(clients[event.header.actor], event.list);
    }
});

/**
 * Room data returned from the backend.
 */
events.onRoomResult(function (data) {
    if (isValidSocket(data)) {
        var socket = clients[data.header.actor];

        // make sure that another callback has not already cached the room.
        if (rooms[data.room] == null) {
            rooms[data.room] = {
                topic: data.topic,
                room: data.room,
                owner: data.owner,
                clients: []
            };
        }

        if (data.created) {
            sendSystem(socket, "Created room '" + data.room + "'.");
        } else {
            sendSystem(socket, "Room owner '" + data.owner + "'.");
        }
        onJoinedRoom(socket, data);
    }
});

/**
 * Notifies all clients that the topic was changed by an user on another server.
 */
events.onTopicChanged(function (event) {
    if (isRoomValid(event)) {
        rooms[event.room].topic = event.topic;
        broadcastRoomData(event.room);
    }
});

function isRoomValid(event) {
    return (rooms[event.room] != null);
}

/**
 *  User events received from remote servers are injected into the originating room.
 */
events.onUserEvent(function (event) {
    if (isRoomValid(event))
        notifyRoom(event.room, event.username, event.join);
});

/**
 * Messages received from remote servers are injected into the originating room.
 */
events.onMessage(function (event) {
    if (isRoomValid(event))
        sendRoom(event);
});