#! /usr/bin/env node
const {prompt, promptYN, showPassword, close} = require("./prompt.js");
const {generatePassword} = require("./password-gen.js");
const PasswordStore = require("./password-file.js");
const path = require("path");
const os = require("os");

// handle quoted strings 
const tokenize = str => {
	
	const tokens = [];
	let curToken = "";

	let quote = false, // whether we're in a quoted string
	    escape = false; // whether the char is escaped

	for(let i = 0; i < str.length; i++) {
		
		const char = str[i];

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
	    yes: false,
		path: null
	};

	const nonFlagTokens = [];

	// scan tokens for flags first
	while(tokens.length > 0) {
		const token = getToken(tokens);
		if(token[0] === "-") {
			if(token === "-y" || token === "--yes")
				flags.yes = true;
			else if(token === "-f" || token === "--file")
				flags.path = getToken(tokens);
			else
				throw new Error(`Unknown flag "${token}"`);
		} else {
			nonFlagTokens.push(token);
		}
	}

	return {flags, nonFlagTokens};

};

const execute = async (tokens, flags, passwordStore) => {

	while(tokens.length > 0) {

		const token = getToken(tokens);

		if(token === "add" || token === "gen") {
			
			const name = getToken(tokens);
			if(passwordStore.exists(name)) {
				if(!(flags.yes || await promptYN(`A password entry named "${name}" exists already. Overwrite`))) {
					continue;
				}
				console.log("Overwriting existing entry");
			}

			// generate password
			let password;
			if(token === "add") {
				password = await prompt(`Password for ${name}: `, true);
			} else {
				password = await generatePassword(flags.yes);
			}

			passwordStore.setEntry(name, password);
			await showPassword(name, password);

		} else if(token === "rm") {
			const name = getToken(tokens);
			passwordStore.checkExistence(name);
			if(flags.yes || await promptYN("Deleting a password entry is irreversible. Delete", false)) {
				passwordStore.removeEntry(name);
			}
		} else if(token === "show") {
			const name = getToken(tokens);
			await showPassword(name, passwordStore.getEntry(name));
		} else if(token === "ls") {
			const entries = passwordStore.getEntryNames();
			console.log(entries.join("\n"));
		} else if(token === "import" || token === "importsafe") {
			
			const path = getToken(tokens);
			const otherPassword = await prompt("Password for other file: ", true);
			const otherStore = new PasswordStore({path, password: otherPassword});
			
			for(const entry of otherStore.getEntryNames()) {
				if(passwordStore.exists(entry)) {
					if(token === "importsafe") {
						console.log(`Skipping "${entry}" since an entry already exists`);
						continue;
					} else if(!(flags.yes || await promptYN(`Overwrite password for "${entry}" with value from new file`))) {
						continue;
					}
				}
				passwordStore.setEntry(entry, otherStore.getEntry(entry));
			}

		} else if(token === "prompt") {
			while(true) {
				try {
					await execute(tokenize(await prompt("> ")), flags, passwordStore);
				} catch(error) {
					console.error(error.message);
				}
			}
		} else if(token === "resave") {
			const newPassword = await prompt("New password: ", true);
			passwordStore.updatePassword(newPassword);
			passwordStore.save();
		} else if(token[0] != "-") {
			throw new Error(`Unexpected token "${token}"`);
		}

	}

};

(async () => {

	const tokens = process.argv.slice(2);
	const {flags, nonFlagTokens} = readFlags(tokens);
	const password = await prompt("Password: ", true);
	const pwFilePath = flags.path || process.env.PW_FILE || path.join(os.homedir(), ".passwords");

	try {
		const passwordStore = new PasswordStore({path: pwFilePath, password});
		await execute(nonFlagTokens, flags, passwordStore);
	} catch(error) {
		console.error(error.message);
		process.exit(1);
	}
	
	close();

})();