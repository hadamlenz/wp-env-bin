# wp-env-bin

some extra commands for working with wp-env in your theme

## Installation

Composer or NPM coming soon, for now you must install.  Download the files and place in your theme.  Most examples have the folder placed in an src folder like
`[THEME_ROOT]/src/wp-env-bin`

from the root of your theme run

```bash
npm install ./src/wp-env-bin --save-dev
```

You will need to customized the command to work for you. so that it works with npm add the following to package.json replacing `[COMMAND_NAME]` name with what you want the command to be named

```json
{
    "scripts":{
        "[COMMAND_NAME]": "node ./src/wp-env-bin/",
    }
}
```

create a file .wp-env-bin.json.  in the root, this is the config file and where settings are saved.


