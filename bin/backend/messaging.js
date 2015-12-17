/**
 * @author Robin Duda
 *
 * Message model.
 */

var mongoose = require('./database').database();

var messageSchema = new mongoose.Schema({
        sender: String,
        content: String,
        room: String,
        timestamp: Number,
        command: Boolean
    }, {strict: false}
);

var Message = mongoose.model('message', messageSchema);
var HISTORY_LIMIT = 100;

module.exports = {
    /**
     * Get the message history of a room.
     * @param name of the room to get the history from.
     * @param callback {room, content, sender, command}
     */
    history: function (name, callback) {
        name = name.toString();

        Message.find({room: name}, {_id: 0, timestamp: 0, room: 0, __v: 0}).sort({timestamp: 1}).limit(HISTORY_LIMIT)
            .exec(function (err, result) {
                if (result)
                    callback(result);
                else if (err)
                    throw err;
            });
    },

    /**
     * Adds a new message to the room history.
     * @param message object {sender, content, command: boolean, room}
     */
    add: function (message) {
        new Message(
            {
                sender: message.sender,
                content: message.content,
                command: message.command,
                room: message.room,
                timestamp: (new Date).getTime()
            })
            .save(function (err) {
                if (err)
                    throw err;
            });
    }
};