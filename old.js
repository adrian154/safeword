const crypto = require("crypto");
const buf = crypto.randomBytes(256);

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const length = Number(process.argv[2]) || 16;

let password = "";
for(let i = 0; i < length; i++) {
	password += chars[buf[i] % chars.length];
}

console.log(password);