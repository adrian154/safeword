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
    const start = performance.now();
    const key = crypto.scryptSync(password, salt, CHACHA20_KEYLEN, {N: 262144, r: 8, p: 1, maxmem: 130 * 262144 * 8});
    const elapsed = performance.now() - start;
    if(elapsed < 250) {
        console.log("warning: key derivation took less than 250ms, you should probably adjust the SCrypt parameters");
    }
    return key;
};

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
    
    updatePassword(password) {
        this.salt = randomBytes(SALT_LENGTH);
        this.key = deriveKey(password, this.salt);
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
            throw new Error("Decryption failed, your password is wrong or the password file is corrupted");
        }

        // parse json
        try {
            this.data = JSON.parse(plaintext.toString("utf-8"));
        } catch(error) {
            throw new Error("Invalid JSON, the password file was corrupted");
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

    setEntry(name, entry) {
        this.data[name] = entry;
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