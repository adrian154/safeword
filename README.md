# safeword

Safeword is a simple password manager I made for personal use.

# Usage

`safeword ls`
* List the names of password entries; passwords are not printed 

`safeword add <name>`
* Add a new password entry

`safeword gen <name>`
* Generate a new password

`safeword show <name>`
* Show the password for a given entry

`safeword copy <name>`
* Copy a password to the clipboard; currently only supported on Windows.

`safeword info <name>`
* Print the description for a password.

`safeword rm <name>`
* Delete a password entry

`safeword import <file>`
* Read passwords from another Safeword password file

`safeword import-new <file>`
* Like `import`, but duplicate entries are skipped

`safeword resave <file>`
* Save the password file with a new password

`safeword prompt`
* Launch an interactive session, where multiple commands can be entered.

`safeword dump`
* Print out the full password file in plaintext. BE CAREFUL WITH THIS COMMAND!

More than one operation can be specified at once, like this:

`safeword add GitHub-new rm GitHub resave`

The following flags can be included:

* `-f <path>`, `--file <path>`: Use a specific password file

## Password File Location

The password file is located at `~/.passwords` by default. You can change the location of the password file by setting the `PW_FILE` environment variable, or by using the `-f` flag.

## Syncing

Safeword doesn't implement a synchronization mechanism. It is recommended that you use Git to sync the password file. To resolve conflicts, set up Safeword as a custom mergetool:

```
git config --global mergetool.safeword.cmd 'safeword -f "$LOCAL" import "$REMOTE" save-to "$MERGED"'
```

# Password Storage

Password files consist of the following fields, concatenated:

| Field    | Length (bytes) | Description                                      |
|----------|----------------|--------------------------------------------------|
| salt     | 16             | Salt input to scrypt                             |
| nonce    | 12             | ChaCha20 nonce, incremented with each encryption |
| auth tag | 16             | Poly1305 authentication tag                      |
| data     | variable       | Encrypted UTF-8 JSON                             |

Passwords are stored in JSON as a set of key-value pairs:

```
{
    "service1": {
        "password": "...",
        "description": "..."
    },
    "service2": {
        "password": "...",
        "description": "..."
    }
}
```

The key used for encryption is derived from the password using scrypt with the following parameters: N=262144, r=8, p=1.

The associated data used to generate the auth tag consists of the salt and nonce, concatenated.