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
		enterPassword: false,
	    yes: false,
		newPassword: false,
		path: null
	};

	const nonFlagTokens = [];

	// scan tokens for flags first
	while(tokens.length > 0) {
		const token = getToken(tokens);
		if(token[0] === "-") {
			if(token === "-e" || token === "--enter-password")
				flags.enterPassword = true;
			else if(token === "-y" || token === "--yes")
				flags.yes = true;
			else if(token === "-n" || token === "--new-password")
				flags.newPassword = true;
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

	if(flags.newPassword) {
		passwordStore.updatePassword(await prompt("New password: ", true));
	}

	while(tokens.length > 0) {

		const token = getToken(tokens);

		if(token === "add") {
			
			const name = getToken(tokens);
			if(passwordStore.exists(name)) {
				if(!(flags.yes || await promptYN(`A password entry named "${name}" exists already. Overwrite`))) {
					continue;
				}
				console.log("Overwriting existing entry");
			}

			// generate password
			let password;
			if(flags.enterPassword) {
				password = await prompt(`Password for ${name}: `, true);
			} else {
				password = await generatePassword(flags.yes);
			}

			passwordStore.setEntry(name, password);
			await showPassword(name, password);

		} else if(token === "remove") {
			const name = getToken(tokens);
			passwordStore.checkExistence(name);
			if(flags.yes || await promptYN("Deleting a password entry is irreversible. Delete", false)) {
				passwordStore.removeEntry(name);
			}
		} else if(token === "show") {
			const name = getToken(tokens);
			await showPassword(name, passwordStore.getEntry(name));
		} else if(token === "list") {
			const entries = passwordStore.getEntryNames();
			console.log("Password entries:");
			console.log(entries.map(name => `* ${name}`).join("\n"));
		} else if(token === "import") {
			
			const path = getToken(tokens);
			const otherPassword = await prompt("Password for other file: ", true);
			const otherStore = new PasswordStore({path, password: otherPassword});
			
			for(const entry of otherStore.getEntryNames()) {
				if(passwordStore.exists(entry)) {
					if(!(flags.yes || await promptYN(`A password entry named "${entry}" exists already. Overwrite`))) {
						continue;
					}
					console.log(`Replacing entry "${entry}" with password from imported file`);
				}
				passwordStore.setEntry(entry, otherStore.getEntry(entry));
				
			}

		} else if(token === "interactive") {
			while(true) {
				try {
					await execute(tokenize(await prompt("> ")), flags, passwordStore);
				} catch(error) {
					console.error(error.message);
				}
			}
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