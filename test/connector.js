/**
 * @author Robin Duda
 *
 * Tests the backend, the connector of the frontend chatserver implementations.
 *
 * Tests authentication, database storage and replication between servers.
 */

require('./../bin/backend/database');
require('./param-config');
var uuid = require('uuid');
var hasher = require('./../bin/backend/hash');
var connector = require('./../bin/backend/connector');
var assert = require('assert');
var Mocks = require('./mocks');
var Protocol = require('./../bin/protocol');

describe('connector', function () {
    var username = uuid.v4();
    var password = uuid.v4();

    // use random ids for testing rooms.
    var Room = function () {
        return uuid.v4();
    };

    function registerSocket(name, callback) {
        var socket = new Mocks.Socket(callback);
        connector.handler["register"](socket, new Protocol.Register(name));
        return socket;
    }

    describe('Hash', function () {
        var password = 'defined';
        var password2 = 'undefined';

        it('Should not generate the same hash for two equal passwords', function (done) {
            hasher.calculate(function (err, salt, hash) {
                hasher.calculate(function (err, salt, next_hash) {
                    assert.notEqual(hash, next_hash);
                    done();
                }, password)
            }, password);
        });

        // callback, pass, salt - err, pass, salt
        it('Should generate a salt when hashing if none is given.', function (done) {
            hasher.calculate(function (err, salt, hash) {
                assert.notEqual(salt, null);
                done();
            }, password)
        });

        it('Should calculate the wrong hash when passwords are mismatching.', function (done) {
            hasher.calculate(function (err, salt, hash) {
                hasher.calculate(function (err, salt, next_hash) {
                    assert.notEqual(hash, next_hash);
                    done();
                }, password2, salt)
            }, password);
        });

        it('Should calculate the same hash when passwords are matching.', function (done) {
            hasher.calculate(function (err, salt, hash) {
                hasher.calculate(function (err, salt, next_hash) {
                    assert.equal(hash, next_hash);
                    done();
                }, password, salt)
            }, password);
        });

    });

    describe('Mocks', function () {
        it('Should test that the socket mock is working.', function (done) {
            var socket = new Mocks.Socket(function (data) {
                assert.equal(data.message, 'message');
                done();
            });
            socket.send(JSON.stringify({message: 'message'}));
        });
    });

    describe('Authentication', function () {
        it('Should create a new account if none exists.', function (done) {
            connector.handler["authenticate"](new Mocks.Socket(function (data) {
                assert.equal(data.created, true, 'not created.');
                assert.equal(data.authenticated, true, 'not authenticated.');
                done();
            }), new Protocol.Authenticate(username, password));
        });

        it('Should reject accounts not authorized.', function (done) {
            connector.handler["authenticate"](new Mocks.Socket(function (data) {
                assert.notEqual(data.authenticated, true);
                done();
            }), new Protocol.Authenticate(username, 'password-wrong'));
        });

        it('Should authenticate users if exists.', function (done) {
            connector.handler["authenticate"](new Mocks.Socket(function (data) {
                assert.equal(data.authenticated, true);
                assert.notEqual(data.created, false);
                done();
            }), new Protocol.Authenticate(username, password));
        });
    });


    describe('Synchronization', function () {

        it('Should add a server to the server list.', function (done) {
            registerSocket("TEST_NAME");

            connector.handler["server.list"](Mocks.Socket(function (data) {
                for (var i = 0; i < data.list.length; i++) {
                    if (data.list[i].name == 'TEST_NAME') {
                        done();
                        return;
                    }
                }
                throw new Error("Server not registered.");
            }), new Protocol.ServerList(null))
        });

        it('Should broadcast messages sent to it.', function (done) {
            var room = Room();
            var server1 = registerSocket();
            var server2 = registerSocket("", function (data) {
                assert.equal(data.room, room, 'Missing room');
                assert.equal(data.content, 'content', 'Missing content');
                assert.equal(data.sender, 'sender', 'Missing sender');
                assert.equal(data.command, true, 'Command not set');
                delete server2.callback;
                done();
            });

            connector.handler["message"](server1, new Protocol.Message("content", room, "sender", true));
        });

        it('Should return the message history of the room.', function (done) {
            var room = Room();
            var server = registerSocket("server", function (data) {
                delete server.callback;
                done();
            });

            connector.handler["message"](server, new Protocol.Message('content', room, 'sender', true));
            connector.handler["history"](server, new Protocol.History(room, null));
        });


        it('Should notify servers when topics change.', function (done) {
            var room = Room();
            var server1 = registerSocket();
            var server2 = registerSocket("", function (data) {
                assert.equal(data.topic, 'topic', 'Missing/wrong topic');
                assert.equal(data.room, room, 'Missing/wrong room');
                delete server2.callback;
                done();
            });

            connector.handler["topic"](server1, new Protocol.Topic(room, 'topic'));
        });
    });

    describe('Database', function () {
        it('Should change the topic of a room in the database', function (done) {
            var room = Room();
            connector.handler["room"](new Mocks.Socket(), new Protocol.Room(room, 'unchanged', '', ''));

            setTimeout(function () {
                connector.handler["topic"](new Mocks.Socket(), new Protocol.Topic(room, 'top1c'));
            }, 5);

            var server = registerSocket("", function (data) {
                assert.equal(data.topic, 'top1c', 'Topic not changed.');
                assert.equal(data.room, room, 'Room changed in transit.');
                delete server.callback;
                done();
            });

            setTimeout(function () {
                connector.handler["room"](server, new Protocol.Room(room, '', '', ''));
            }, 10);
        });

        it('Should (create | load) a room (not | if) exists.', function (done) {
            var room = Room();
            connector.handler["room"](new Mocks.Socket(), new Protocol.Room(room, 'newroom', '', ''));

            // when the second "room" query is issued, the topic is that of the first room
            // indicating that the room was initially created, and then later reloaded.
            var server = registerSocket("", function (data) {
                assert.equal(data.topic, 'newroom', 'Topic changed, room overwritten.');
                assert.equal(data.room, room, 'Room changed.');
                delete server.callback;
                done();
            });

            setTimeout(function () {
                connector.handler["room"](server, new Protocol.Room(room, '', '', ''));
            }, 10);
        });
    });
});