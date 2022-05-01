# safeword

Safeword is a simple password manager I made for personal use.

## WARNING: DO NOT USE THIS, I have no idea what I'm doing!!

# Usage

`safeword add <name>`
* Add a new password entry

`safeword gen <name>`
* Generate a new password

`safeword rm <name>`
* Delete a password entry

`safeword show <name>`
* Show the password for a given entry

`safeword list`
* List the names of password entries; passwords are not printed 

`safeword import <file>`
* Read passwords from another Safeword password file

`safeword resave <file>`
* Save the password file with a new password

More than one operation can be specified at once, like this:

`safeword add GitHub-new rm GitHub resave`

The following flags can be included:

* `-y`, `--yes`: All prompts will be answered with the default option
* `-f <path>`, `--file <path>`: Use a specific password file

## Password File Location

The password file is located at `~/.passwords` by default. You can change the location of the password file by setting the `PW_FILE` environment variable, or by using the `-f` flag.

## Syncing

Safeword doesn't implement a synchronization mechanism. It is recommended that you use Git to sync the password file. This has one pitfall, however: Git isn't able to manually resolve merge conflicts in the encrypted password file automatically. If a merge conflict occurs, here's how you can resolve it:

* Run `git mergetool`.
* Import the remote password file into the current one: `safeword import passwords.REMOTE`
* If conflicting password entries are found, Safeword will ask you which you'd like to keep.

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
    "service1": "password",
    "service2": "password2"
}
```

The key used for encryption is derived from the password using scrypt with the following parameters: N=1048576, r=8, p=1.

The associated data used to generate the auth tag consists of the salt and nonce, concatenated.