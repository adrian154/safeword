const PasswordStore = require("./password-file.js");
const {Writable} = require("stream");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const os = require("os");

// figure out where the user wants to store their password file
const PW_FILE_PATH = process.env.PW_FILE || path.join(os.homedir(), ".passwords");

// pass stdout through this stream so that we can disable logging when the user is entering passwords
const muteableStream = new Writable({
	write: function(chunk, encoding, callback) {
		if(!this.muted) {
			process.stdout.write(chunk, encoding);
		}
		callback();
	}
});

const lineReader = readline.createInterface({input: process.stdin, output: muteableStream, terminal: true});
const readPassword = question => new Promise((resolve, reject) => {
	lineReader.question(question, password => {
		muteableStream.muted = false;
		console.log();
		resolve(password);
	});
	muteableStream.muted = true;
});

(async () => {

	const password = await readPassword("Password: ");

	let passwordStore;
	if(!fs.existsSync(PW_FILE_PATH)) {
		console.log(`A new password file will be created at ${PW_FILE_PATH}`);
		passwordStore = new PasswordStore({password});
	} else {
		passwordStore = new PasswordStore({password, data: fs.readFileSync(PW_FILE_PATH)});
	}

	// read arguments with a state machine
	

	// save
	passwordStore.data = {secret: Math.random()};
	fs.writeFileSync(PW_FILE_PATH, passwordStore.serialize());

	lineReader.close();

})();