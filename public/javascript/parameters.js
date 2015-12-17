/**
 * @author Robin Duda
 * @param line input text.
 *
 * Converts a line into a command.
 * todo should support quoting.
 */

function Parameters(line) {
    this.line = line;

    if (typeof line == 'string') {
        this.args = line.split(" ");

        this.arg = function (index) {
            return this.args[index] ? this.args[index] : "";
        };

        this.first = this.arg(1);
        this.second = this.arg(2);
        this.command = this.arg(0);
    }
}