/**
 * @author Robin Duda
 *
 * Room model.
 */

var mongoose = require('./database').database();

var roomSchema = new mongoose.Schema({
        topic: String,
        owner: String,
        name: String
    }, {strict: false}
);

var Room = mongoose.model('room', roomSchema);

module.exports = {

    /**
     * Creates a new room if it does not exist, if it exists the found room is returned.
     * @param name of the room to find | create.
     * @param owner if the room is to be created, the owner is set to this.
     * @param topic the initial topic of the room.
     * @param callback object {topic, owner, room, created: true | null}
     */
    create: function (name, owner, topic, callback) {
        name = name.toString();

        Room.where({name: name}).findOne(function (err, result) {
            if (result) {
                callback({topic: result.topic, owner: result.owner, room: name});
            } else {
                if (err)
                    throw err;

                new Room({name: name, owner: owner, topic: topic})
                    .save(function (err) {
                        if (err)
                            throw err;
                        callback({topic: topic, owner: owner, room: name, created: true});
                    });
            }
        });
    },

    /**
     * Set the topic of a room.
     * @param room to set the topic of.
     * @param topic the new topic.
     */
    topic: function (room, topic) {
        room = room.toString();
        topic = topic.toString();

        Room.where({name: room}).update({$set: {topic: topic}}, function (err) {
            if (err)
                throw err;
        });
    }

};