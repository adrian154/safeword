const {Writable} = require("stream");
const readline = require("readline");

// how long a password is shown
const PW_TIMEOUT = 5;

// pass stdout through this stream so that we can disable logging when the user is entering passwords
const muteableStream = new Writable({
	write: function(chunk, encoding, callback) {
		if(!this.muted) {
			process.stdout.write(chunk, encoding);
		}
		callback();
	}
});

const lineReader = readline.createInterface({
    input: process.stdin,
    output: muteableStream,
    terminal: true
});

const prompt = (question, hidden, stay) => new Promise(resolve => {
	lineReader.question(question, answer => {
		if(hidden) {
			muteableStream.muted = false;
            if(!stay) {
			    console.log();
            }
		}
		resolve(answer);
	});
	muteableStream.muted = hidden;
});

const promptYN = async (question, defaultState) => {
	while(true) {
		const answer = (await prompt(question + ` [${defaultState ? "Y/n" : "y/N"}]? `))?.toLowerCase();
		if(!answer) return defaultState;
        if(["yes", "y"].includes(answer)) return true;
		if(["no", "n"].includes(answer)) return false;
		console.log("Please enter yes or no.");
	}
};

const clearline = () => {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
};

let passwordShown;
const showPassword = async password => {
    passwordShown = true;
    await prompt(`Password: ${password} (press enter to clear)`, true, true)
    clearline();
};

process.on("SIGINT", () => {
    if(passwordShown) {
        clearline();
    }
    process.exit(0);
});

module.exports = {prompt, promptYN, showPassword, close: () => lineReader.close()};