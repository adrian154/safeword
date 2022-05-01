// All code related to manipulating password files is contained here
const crypto = require("crypto");
const fs = require("fs");

// crypto constants
const CIPHER = "chacha20-poly1305";
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const CHACHA20_KEYLEN = 32;

const deriveKey = (password, salt) => {
    console.log("Deriving key...");
    //return crypto.scryptSync(password, salt, CHACHA20_KEYLEN, {N: 1048576, r: 8, p: 1, maxmem: 2048 * 1024 * 1024});
    return crypto.scryptSync(password, salt, CHACHA20_KEYLEN, {N: 65536, r: 8, p: 1, maxmem: 256*65536*8});
};

// this code is absolutely not timing-safe, but as far as I can tell it doesn't matter since the nonce is readable by anyone
// or maybe it does matter. i don't know anything about cryptography. *please* don't use this app, not that I expect anyone to
const incrementNonce = nonce => {
    let i = 0;
    do {
        nonce[i++]++;
    } while(nonce[i - 1] == 0x00);
    return nonce;
};

const randomBytes = bytes => crypto.randomFillSync(Buffer.alloc(bytes));

module.exports = class {

    constructor(options) {

        this.path = options.path;
        if(fs.existsSync(this.path)) {
            this.deserialize(fs.readFileSync(this.path), options.password);
        } else {

            if(options.throwIfNonexistent) {
                throw new Error("Password file doesn't exist");
            }

            console.log(`A new password file will be created at ${this.path}`);
            this.salt = randomBytes(SALT_LENGTH);
            this.nonce = Buffer.alloc(NONCE_LENGTH);
            this.key = deriveKey(options.password, this.salt);
            this.data = {};
            this.save();

        }

    }
    
    // generate the 'associated data' 
    createAAD() {
        return Buffer.concat([this.salt, this.nonce]);
    }

    deserialize(data, password) {

        let pos = 0;
        const read = bytes => {
            const result = data.slice(pos, pos + bytes);
            pos += bytes;
            return result;
        };

        // read fields
        this.salt = read(SALT_LENGTH);
        this.nonce = read(NONCE_LENGTH);
        const authTag = read(AUTH_TAG_LENGTH);
        const ciphertext = data.slice(pos, data.length);

        // derive key
        this.key = deriveKey(password, this.salt);

        // decrypt data
        const decipher = crypto.createDecipheriv(CIPHER, this.key, this.nonce, {authTagLength: AUTH_TAG_LENGTH});
        decipher.setAAD(this.createAAD());
        decipher.setAuthTag(authTag);
        const plaintext = decipher.update(ciphertext);

        try {
            decipher.final();
        } catch(error) {
            throw new Error("Decryption failed, your password is probably wrong");
        }

        // parse json
        try {
            this.data = JSON.parse(plaintext.toString("utf-8"));
        } catch(error) {
            throw new Error("Invalid JSON, the password file is probably corrupted");
        }

    }

    serialize() {

        // we increment the nonce instead of randomly generating it since it's too short (64 bits)
        this.nonce = incrementNonce(this.nonce);

        const plaintext = JSON.stringify(this.data).toString("utf-8");

        // encrypt
        const cipher = crypto.createCipheriv(CIPHER, this.key, this.nonce, {authTagLength: AUTH_TAG_LENGTH});
        cipher.setAAD(this.createAAD());
        const ciphertext = cipher.update(plaintext);
        cipher.final();

        return Buffer.concat([this.salt, this.nonce, cipher.getAuthTag(), ciphertext]);

    }

    save() {
        fs.writeFileSync(this.path, this.serialize());
    }

    setEntry(name, password) {
        this.data[name] = password;
        this.save();
    }

    getEntry(name) {
        this.checkExistence(name);
        return this.data[name];
    }

    removeEntry(name) {
        delete this.data[name];
        this.save();
    }

    exists(name) {
        return name in this.data;
    }

    getEntryNames() {
        return Object.keys(this.data);
    }

    checkExistence(name) {
        if(!this.exists(name)) {
            throw new Error(`No entry named "${name}" exists`);
        }
    }

};