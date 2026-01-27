# Pixelplaent 2.0

The 2.0 release comes with a total revamp of the account system, proxy detection
and more. Its database layout is not compatible with previous versions.

The configuration moved to the file `config.ini`, which you have to edit and copy
all the configs, that you previously had in `ecosystem.yml`, to.

We can not offer automatic migration of the SQL database.
However, a migration script got shipped with this version. Make sure to BACK UP
your SQL database before running it.

Migration script (uses the sql database configured in config.ini):

```bash
node scripts/migrate2.js
```

The following redis keys aren't used anymore and
can be deleted: `isal:*`, `chip`, `sess:*`.
Which can be done with those commands:

```bash
redis-cli KEYS "isal:*" | xargs redis-cli DEL
redis-cli KEYS "sess:*" | xargs redis-cli DEL
redis-cli DEL chip
```
