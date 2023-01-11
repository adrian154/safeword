#! /usr/bin/env node
const {prompt, promptYN, showPassword, close} = require("./prompt.js");
const {generatePassword} = require("./password-gen.js");
const PasswordStore = require("./password-file.js");
const child_process = require("child_process");
const path = require("path");
const os = require("os");

// handle quoted strings
const tokenize = str => {
	
	const tokens = [];
	let curToken = "";

	let quote = false, // whether we're in a quoted string
	    escape = false; // should the current character be escaped?

	for(const char of str) {

		if(escape) {
			curToken += char;
			escape = false;
		} else {

			// when we encounter whitespace, start a new token
			if(!quote && char.match(/\s/)) {
				if(curToken.length > 0) {
					tokens.push(curToken);
					curToken = "";
				}
			} else if(quote && char === '\\') {
				escape = true; // handle escapes in quotes
			} else if(char === '"') {
				quote = !quote; // quote start/end
			} else {
				curToken += char;
			}
		}

	}

	if(quote) {
		throw new Error("Unterminated quote");
	}

	if(curToken.length > 0) {
		tokens.push(curToken);
	}

	return tokens;

};

const getToken = tokens => {
	const token = tokens.shift();
	if(!token) {
		throw new Error("Unexpected end of input");
	}
	return token;
};


const readFlags = tokens => {
	
	// flags
	const flags = {
		path: null
	};

	const filteredTokens = [];

	// scan tokens for flags first
	while(tokens.length > 0) {
		const token = getToken(tokens);
		if(token[0] === "-") {
			if(token === "-f" || token === "--file")
				flags.path = getToken(tokens);
			else
				throw new Error(`Unknown flag "${token}"`);
		} else {
			filteredTokens.push(token);
		}
	}

	return {flags, filteredTokens};

};

const copyToClipboard = text => {
	if(process.platform === "win32") {
		const clip = child_process.spawn("C:\\Windows\\System32\\clip.exe");
		clip.stdin.end(text);
		return new Promise(resolve => {
			clip.on("close", resolve);
		});
	} else {
		console.log(`Sorry, but clipboard support is not yet available on your platform (${process.platform})`);
	}
};

const execute = async (tokens, passwordStore) => {

	while(tokens.length > 0) {

		const token = getToken(tokens);

		if(token === "add" || token === "gen") {
			
			const name = getToken(tokens);
			if(passwordStore.data[name]) {
				if(!await promptYN(`A password entry named "${name}" exists already. Overwrite`)) {
					continue;
				}
			}

			// generate password
			let password;
			if(token === "add") {
				password = await prompt(`Password for ${name}: `, true);
			} else {
				password = await generatePassword();
			}

			const description = await prompt(`Description for ${name} (optional): `);
			passwordStore.setEntry(name, {password, description, timestamp: Date.now()});

		} else if(token === "rm") {
			const name = getToken(tokens);
			passwordStore.checkExistence(name);
			if(await promptYN("Deleting a password entry is irreversible. Delete", false)) {
				passwordStore.removeEntry(name);
			}
		} else if(token === "show" || token === "info") {
			const name = getToken(tokens);
			const entry = passwordStore.getEntry(name);
			console.log(`Description for ${name}: ${entry.description}`);
			if(token === "show") {
				await showPassword(entry.password);
			}
		} else if(token === "ls") {
			const entries = passwordStore.getEntryNames();
			console.log(entries.sort().map(str => "\u001b[92m" + str + "\u001b[39m").join("\n"));
		} else if(token === "copy") {
			const name = getToken(tokens);
			const entry = passwordStore.getEntry(name);
			await copyToClipboard(entry.password);
		} else if(token === "import" || token === "import-new") {
			
			const path = getToken(tokens);
			const otherPassword = await prompt("Password for other file: ", true);
			const otherStore = new PasswordStore({path, password: otherPassword});
			
			for(const entryName of otherStore.getEntryNames()) {
				const entry = otherStore.getEntry(entryName);
				if(passwordStore.exists(entryName)) {
					const existingEntry = passwordStore.getEntry(entryName);
					if(token === "import-new" || !await promptYN(`Overwrite password for "${entryName}" with ${entry.timestamp < existingEntry.timestamp ? "older" : "newer"} value from imported file`)) {
						continue;
					}
				}
				passwordStore.setEntry(entryName, entry);
			}

		} else if(token === "resave") {
			const newPassword = await prompt("New password: ", true);
			passwordStore.updatePassword(newPassword);
			passwordStore.save();
		} else if(token === "dump") {
			console.log(JSON.stringify(passwordStore.data));
		}

	}

};

(async () => {

	const tokens = process.argv.slice(2);
	const {flags, filteredTokens} = readFlags(tokens);
	const password = await prompt("Password: ", true);
	const pwFilePath = flags.path || process.env.PW_FILE || path.join(os.homedir(), ".passwords");

	try {
		const passwordStore = new PasswordStore({path: pwFilePath, password});
		if(filteredTokens.length > 0) {
			await execute(filteredTokens, passwordStore);
		} else {
			while(true) {
				try {
					await execute(tokenize(await prompt("> ")), passwordStore);
				} catch(error) {
					console.error(error.message);
				}
			}
		}
	} catch(error) {
		console.error(error.message);
		process.exit(1);
	}
	
	close();

})();