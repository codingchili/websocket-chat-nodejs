/**
 * @author Robin Duda
 *
 * AngularJS websocket client connector.
 */

angular.module('messageApp', [])
    .controller('messaging', ['$scope', function ($scope) {
        $scope.commandHandler = {};
        $scope.messageHandler = {};
        $scope.message = "";
        $scope.room = {
            messages: [],
            name: '',
            topic: '',
            version: '',
            connected: false,
            host: 'localhost:4040',
            socket: null
        };

        $scope.submit = function () {
            if ($scope.message.length != 0) {
                if ($scope.message[0] == '/') {
                    $scope.handleCommand($scope.message);
                } else {
                    $scope.handleMessage($scope.message);
                }
                $scope.message = "";
            }
        };

        $scope.handleCommand = function () {
            $scope.command($scope.message);
            var command = new Parameters($scope.message).command;

            if ($scope.commandHandler[command] == null)
                $scope.commandHandler[null]();
            else
                $scope.commandHandler[command](new Parameters($scope.message));
        };

        $scope.command = function (text) {
            var parameters = new Parameters(text);

            // mask passwords in input.
            if (parameters.command == '/authenticate') {
                text = parameters.command + " " + parameters.first + " **********";
            }
            $scope.room.messages.push({content: text, command: true});
            $scope.scroll();
        };

        $scope.handleMessage = function () {
            if ($scope.connected) {
                $scope.send(new Protocol.Message($scope.message));
            } else {
                $scope.write("Not connected. Type /man for the manpage.");
            }
        };

        $scope.send = function (message) {
            $scope.room.socket.send(JSON.stringify(message));
        };

        $scope.write = function (content, sender) {
            $scope.room.messages.push({content: content, sender: sender, system: (sender == null)});
            $scope.scroll();
        };

        $scope.scroll = function () {
            var frame = jQuery("#messageframe");
            frame.stop(true);
            frame.animate({scrollTop: $("#messagebox")[0].scrollHeight}, 600);
        };


        $scope.onMessage = function (message) {
            message = JSON.parse(message.data);

            console.log(message);

            if ($scope.messageHandler[message.header.action] != null)
                $scope.messageHandler[message.header.action](message);
            else
                console.log("no handler for " + message.header.action);

            $scope.$apply();
        };

        $scope.commandHandler["/connect"] = function (param) {
            if ($scope.room.socket != null)
                $scope.room.socket.close();

            $scope.room.host = param.first;
            $scope.connect();
        };

        $scope.connect = function () {
            if ("WebSocket" in window) {
                $scope.room.messages = [];
                $scope.write("Connecting to " + $scope.room.host + ".. ");

                $scope.room.socket = new SocketProvider("ws://" + $scope.room.host, {
                    onopen: $scope.onOpen,
                    onmessage: $scope.onMessage,
                    onclose: $scope.onClose,
                    onerror: $scope.onError
                }).socket;
            } else {
                $scope.onDisconnect();
                $scope.write("Error: WebSocket not supported.");
            }
        };

        $scope.onOpen = function () {
            $scope.connected = true;
            $scope.$apply();
        };

        $scope.onClose = function () {
            $scope.onDisconnect();
            $scope.write("Disconnected from server.");
            $scope.$apply();
        };

        $scope.onError = function () {
            $scope.onDisconnect();
            $scope.write("Error: socket error.");
            $scope.$apply();
        };

        $scope.onDisconnect = function () {
            $scope.room.connected = false;
            $scope.room.version = "disconnected.";
            $scope.room.topic = "chat your socks off.";
            $scope.room.name = "SYSTEM";
        };

        $scope.commandHandler["/authenticate"] = function (param) {
            $scope.send(new Protocol.Authenticate(param.first, param.second));
        };

        $scope.commandHandler["/join"] = function (param) {
            $scope.send(new Protocol.Join(param.first));
        };


        $scope.commandHandler["/topic"] = function (param) {
            $scope.send(new Protocol.Topic('', param.first));
        };


        $scope.commandHandler["/servers"] = function () {
            $scope.send(new Protocol.ServerList());
        };

        $scope.commandHandler["/man"] = function () {
            $scope.printHelp();
        };

        $scope.commandHandler["/help"] = function () {
            $scope.send(new Protocol.Help());
        };

        $scope.printHelp = function () {
            $scope.write("/connect <host>");

            if ($scope.room.connected) {
                $scope.room.socket.send(JSON.stringify(new Protocol.Help()));
            }
        };

        $scope.commandHandler[null] = function () {
            $scope.write("Error: no such command.");
        };

        $scope.messageHandler["join"] = function (message) {
            $scope.room.name = message.room;
            $scope.room.topic = message.topic;
            $scope.room.version = message.version;
            $scope.write(message.content);
        };

        $scope.messageHandler["message"] = function (message) {
            if (message.command)
                $scope.command(message.content);
            else
                $scope.write(message.content, message.sender)
        };

        $scope.messageHandler["history"] = function (message) {
            $scope.room.messages = $scope.room.messages.concat(message.list);
        };

        $scope.onDisconnect();
        $scope.connect();
    }]);