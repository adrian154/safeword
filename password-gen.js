const {prompt, promptYN} = require("./prompt.js");
const crypto = require("crypto");

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      DIGITS = "0123456789",
      SYMBOLS = "`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";

const DEFAULT_PW_LEN = 16;

const generate = (charlist, length) => {

    const bytes = crypto.randomFillSync(Buffer.alloc(length));
    const password = new Array(length);
    for(let i = 0; i < length; i++) {
        password[i] = charlist[bytes[i] % charlist.length]; // FIXME: Using a modul for this results in bias, slightly reducing entropy
    }

    return password.join("");

};

module.exports = {
    LETTERS,
    DIGITS,
    SYMBOLS,
    generatePassword: async () => {
        
        // helper for asking user if they want to use a specific char group
        const ask = async (question, charlist) => await promptYN(question, true) ? charlist : "";

        const length = Number(await prompt(`Length (${DEFAULT_PW_LEN}): `)) || DEFAULT_PW_LEN; 
        const charlist = await ask("Include letters", LETTERS) +
                        await ask("Include digits", DIGITS) +
                        await ask("Include symbols", SYMBOLS);
                        
        return generate(charlist, length);

    }
}