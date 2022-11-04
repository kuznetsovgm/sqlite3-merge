# Join databases

Copies tables from multiple sqlite databases into one.

***

## Options

`-s`, `--source` *file/folder* - The folder containing the databases. Can be specify multiple. Default value: `.`

`-d`, `--destination` *file* - The database where the tables will be copied. If it does not exist,it will be created. Default value: `./result.db`

`-e`, `--extension` *db* - Database extensions. Can be specify multiple. By default search *.db* and *.sqlite*

`-t`, `--table` *table_name* - Tables to copy. Can be specify multiple. By default copies all tables.

`-h`, `--help` - Print help message.

## Usage example

`$ ./joindb [-d result.db] [-e .db] [-e .sqlite] [-t USERS] [-t POSTS] ./databases ./download`