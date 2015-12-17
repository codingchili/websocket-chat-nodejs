/**
 * @author Robin Duda
 *
 * Tests for the chatserver.
 */

require('./../bin/backend/database');
require('./param-config');
var connector = require('./../bin/backend/connector');
var Mock = require('./mocks');
var assert = require('assert');
var uuid = require('uuid');
var Protocol = require('../bin/protocol');
var chat = require('./../bin/frontend/chatserver');

describe('chatserver', function () {
    var username = uuid.v4();
    var room = uuid.v4();
    var auth_banner = 'Authentication Required.';

    function setupSocket(callback, authenticated) {
        var socket = new Mock.Socket(callback);

        if (authenticated) {
            socket.username = username;
            socket.id = username;
        }
        return socket;
    }

    it('Should return the server-specific command-list.', function (done) {
        var socket = setupSocket(function (data) {
            delete socket.callback;

            if (data.header.action == 'message' && !data.sender) {
                done();
            } else
                throw new Error("Incorrectly formatted reply.");
        }, true);
        chat.handler.help(socket);
    });

    describe('Unauthorized', function () {

        it('Should not allow access to /join', function (done) {
            var socket = setupSocket(function (data) {
                delete socket.callback;

                assert.equal(data.content, auth_banner, 'Auth banner mismatch.');
                done();
            }, false);

            chat.handler.process(socket, new Protocol.Join());
        });

        it('Should not allow access to /servers', function (done) {
            var socket = setupSocket(function (data) {
                delete socket.callback;

                assert.equal(data.content, auth_banner, 'Auth banner mismatch.');
                done();
            }, false);

            chat.handler.process(socket, new Protocol.ServerList());
        });

        it('Should not allow access to /topic', function (done) {
            var socket = setupSocket(function (data) {
                delete socket.callback;

                assert.equal(data.content, auth_banner, 'Auth banner mismatch.');
                done();
            }, false);

            chat.handler.process(socket, new Protocol.Topic());
        });

        it('Should not allow access to /message', function (done) {
            var socket = setupSocket(function (data) {
                delete socket.callback;

                assert.equal(data.content, auth_banner, 'Auth banner mismatch.');
                done();
            }, false);

            chat.handler.process(socket, new Protocol.Message());
        });

    });

});