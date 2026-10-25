---
title: Backups
description: How every app on the VPS servers is backed up — the runner, what's covered, what an app ships, the schedule file, what it costs, and the gaps it leaves.
sidebar:
  order: 1
---

Every app on the VPS servers is backed up by one scheduled job per server, the **runner**, deployed from [`docker-infrastructure`](https://github.com/Indy-Center/docker-infrastructure#backups). It runs each app's own **recipe**, encrypts the result, and sends it to the Cloudflare R2 bucket `indy-center-backups`, where a bucket lock stops anyone, the server included, deleting it early. This page is for whoever looks after the servers: what's protected, how, and what isn't. [Recover one app](/operations/recover-one-app/) is the runbook for getting data back.

**The encryption key comes first.** Every backup is encrypted with one `age` key. Its source copy is the 1Password item "Backups — age encryption key" in the Infrastructure vault, and a copy sits on each server for the runner. Lose both the servers and that 1Password item and every backup is unreadable. Never replace the key to rotate it: backups made with the old key need the old key.

**Status.** The runner, its report and alerts, the media copy, the weekly restore check and the helper commands are live on both servers. The CMS, TeamSpeak, indy-larry, Postiz and Moodle ship recipes. The wiki doesn't yet: it still runs outside the deploy pipeline, so the runner can't see it until it moves (see [What's covered](#whats-covered)).

## How it works

Cron starts the runner as `deploy` at minute 7 of every hour. Each run, for each folder in `/home/deploy/apps/` whose schedule says it's due, it:

1. runs the app's `backup.sh` with an empty folder, `/home/deploy/backups/<app>/`;
2. encrypts the one file the recipe wrote with `age`;
3. uploads it, then copies the first backup of each day to `daily/` and the first of each month to `monthly/`;
4. empties the staging folder.

One app failing never stops the others. A recipe still running after 2 hours is stopped and counts as failed.

Three more jobs ride on the same runs:

- **The media copy.** Nightly at 07:00 UTC. The CMS keeps uploads in the R2 buckets `payload-media` and `payload-private`, not on the server, and the CMS's own key can delete them. The runner copies any new file into `media/<bucket>/` in the backup bucket. It never deletes or replaces a file there, so a database backup from any date still finds its uploads; Payload never overwrites an upload.
- **The restore check.** Sundays, after the 07:00 UTC backups. It loads the newest CMS backup into a throwaway Postgres 17 and checks every table holds at least the rows the recipe counted when the backup was taken. It proves the backup is good, not that the CMS's `restore.sh` works; the CMS's own CI tests that.
- **The backup report.** Once a day, after the 07:00 UTC run, in tech-team-notifications: each app's result (backed up, failed, no data, no recipe), its last good backup and the space its backups use, each media bucket's size, and the last restore check. Then the runner pings the status page to say the day's backups finished.

Anything that needs a person is an **alert**, in tech-team-alerts, straight away: a failed recipe, encryption or upload, an app with no recipe, a failed media copy or restore check. Everything else is only logged, in `~/backup-runner/logs/runner.log` on the server.

Each server runs its own runner over its own apps, and all of them write to the same bucket, in folders named for the app rather than the server. So the report's title and every alert name the server (`Backups on vanderbilt for 2026-10-20`, `vanderbilt: Backup of …`), and an app moved to another server keeps its backup history: the new server's runner and helper commands see the old server's backups.

> **Why a cron job on each server.** It's in git, the deploy installs it, and it comes back after a rebuild. Considered, not chosen: a scheduled GitHub workflow per app, which GitHub switches off after 60 days without activity in the repository; a systemd timer, which needs root and is set up by hand; an always-on container, which still needs Docker access to reach each app.

## Where backups go

```
indy-center-backups/
  frequent/<app>/   every backup of an app with frequent copies (the CMS: every 6 hours),
                    and any second backup in a day of an app without them
  daily/<app>/      the first backup of each day
  monthly/<app>/    the first backup of each month
  media/<bucket>/   the media copy: every file ever uploaded to the CMS, not encrypted
```

Each backup is named for the UTC time of its run and the recipe's file: `daily/payload/2026-10-20T070000Z-payload.tar.age`.

| Folder      | Deleted by R2 after | Locked against deletion for |
| ----------- | ------------------- | --------------------------- |
| `frequent/` | 14 days             | 14 days                     |
| `daily/`    | 60 days             | 60 days                     |
| `monthly/`  | 12 months           | 12 months                   |
| `media/`    | never               | 60 days per file            |

The runner never deletes anything; R2's lifecycle rules do. Its key can write to the bucket but can't delete a locked file, so a broken or compromised server can't take its backups down with it. Proven on the live bucket: deleting a file in `daily/` with the runner's key fails with `ObjectLockedByBucketPolicy`.

## What's covered

| App                | A backup holds                                                                                          | How often          |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ------------------ |
| `payload` (CMS)    | `payload.tar`: the whole database (`pg_dump`) and each table's row count. Uploads are in the media copy | Every 6 hours      |
| `teamspeak-server` | `teamspeak-server.tar.gz`: the SQLite database, which holds the server's identity, plus uploaded files  | Nightly            |
| `indy-larry`       | `indy-larry-state.tar.gz`: the bot's state files                                                        | Nightly            |
| `postiz`           | `postiz.tar`: its three databases and the uploads volume                                                | Nightly            |
| `moodle`           | `moodle.tar`: the database and `moodledata`, without the caches                                         | Nightly            |
| `wiki`             | Not yet. Once it moves onto the pipeline, its SQLite database and `content` folder in one archive       | Nightly, from then |

Each recipe takes a consistent copy while its app keeps running, and each app's own CI proves the round trip: add data, back up, wipe, restore, check the data is back.

Not backed up, on purpose:

- **Traefik.** Its certificate re-issues on start, and its Cloudflare token comes from a GitHub secret, with its source copy in 1Password.
- **CMS uploads in local volumes.** The CMS writes uploads to its `payload_media` volumes only when its R2 settings are missing, which is CI and local development. Those aren't backed up.
- **Data on Cloudflare.** See [Known gaps](#known-gaps).

## What an app ships

The runner knows nothing about any app. An app takes part by shipping, in its repository's `deploy/` folder, either:

- **`backup.sh` and `restore.sh`.** `backup.sh` is called with one argument, an empty folder, and writes exactly one file there: a consistent copy of all the app's data. `restore.sh` is called with the path of that file, decrypted, and puts the data back into the running app, stopping and starting what it needs to.
- **An empty `no-backup` file**, for an app with nothing to keep. It shows as "no data" in the report.

Both scripts run with `bash` (the deploy's rsync drops the execute bit), as `deploy`, from the app's folder. They may use `docker`, `docker compose` and throwaway containers, and nothing else installed on the server. They never encrypt, upload or delete old backups. An app with neither file raises an alert every night until it ships one, so a new app can't run for months unprotected. An app with `backup.sh` but no `restore.sh` is still backed up, and the report says so.

`docker-infrastructure`'s README has [the exact contract](https://github.com/Indy-Center/docker-infrastructure#what-an-app-ships). The CMS's and TeamSpeak's recipes are the worked examples: a Postgres dump from the running database container, and SQLite's online backup from a throwaway container.

> **Why `restore.sh` is the app's job too.** It makes recovering any app the same command, `backups restore <app> <backup>`, and only the app knows what has to stop while its data is swapped. It's also what each app's CI tests.

## The schedule file

How often an app is backed up isn't part of what it ships. It's one line in [`backup-runner/schedule.conf`](https://github.com/Indy-Center/docker-infrastructure/blob/main/backup-runner/schedule.conf) in `docker-infrastructure`: the app's folder name, the hours between backups (1, 2, 3, 4, 6, 8, 12 or 24, counted from 07:00 UTC), and the days to keep its frequent copies (0 for none, only with 24):

```
payload  6  14
```

An app with no line is backed up nightly at 07:00 UTC, with no frequent copies. Every app keeps one copy a day for 60 days and one a month for 12 months, so a mistake noticed months later can still be undone. To change a schedule, change its line and merge; the deploy ships it. A line the runner can't read raises an alert, and that app falls back to nightly.

A run missed while a server was down is made up at the next one, and a new app is backed up within the hour it appears.

R2's rule on `frequent/` has one age for every app, so it has to match the largest "keep" in the file. Raising an app's "keep" above 14 means changing the lifecycle rule and the lock in Cloudflare too; the runner can't.

> **Why one file, not a setting in each app.** How often to back up is a cost choice, not knowledge about the app, and one file shows every app's cost at a glance.

## Cost

R2's free allowance each month is 10 GB stored, 1 million writes and 10 million reads, and downloads are free. Above it, storage is $0.015 per GB-month, and there's no minimum storage time. (Cloudflare's [R2 pricing](https://developers.cloudflare.com/r2/pricing/), read 2026-10-24.)

Writes are tiny: a few dozen uploads a day. Storage is what grows. An app on the default schedule keeps about 72 copies at once (60 daily, 12 monthly), and the CMS adds 56 frequent ones (4 a day for 14 days). So an app's share is roughly its backup's size times the number of copies, and the media copy grows by every file ever uploaded. The backup report shows each app's space and each media bucket's size every day, so growth shows long before it costs anything; past the allowance, every extra 10 GB is $0.15 a month.

To spend less on one app, give it fewer frequent copies in the schedule file. To spend less across the board, the daily and monthly ages are lifecycle rules in Cloudflare, and the lock has to be shortened with them — a lock can't be shortened for files already written.

## Secrets

Each server's runner gets everything it needs from `docker-infrastructure`'s deploy, which writes them to `~/backup-runner/secrets/` (folder 700, files 600, readable only by `deploy`). A rebuilt server gets them back from one deploy.

| On the server                           | What it is                                                                         | Source copy in 1Password            |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| `age.key`                               | The key that encrypts every backup and decrypts it for restore                     | Backups — age encryption key        |
| `rclone.conf`                           | The runner's R2 key: writes `indy-center-backups`, reads the two CMS media buckets | Backups — R2 runner key             |
| `report-webhook.url`                    | Discord webhook "Backups" in tech-team-notifications                               | Backups — Discord webhook (reports) |
| `alert-webhook.url`                     | Discord webhook "Backup alerts" in tech-team-alerts                                | Backups — Discord webhook (alerts)  |
| `status-ping.url`, `status-ping.secret` | The status page's "backup finished" endpoint, set by hand                          | Backups — status page ping secret   |

GitHub never shows a secret again after it's saved, so 1Password is the only place to read them back.

## Known gaps

- **The encryption key's source copy is in 1Password.** Lose the servers and that item and every backup is unreadable. There's no second copy anywhere else.
- **Data on Cloudflare isn't backed up.** Identity's D1, community-website's and training-tools' D1, and discord-bot's KV have no backups at all. This feature leaves that alone.
- **One provider.** Every backup is in R2, on the same Cloudflare account as the CMS's uploads. A second copy with another provider (3-2-1) was considered and left for later: more to run than the risk warrants today.
- **The wiki isn't backed up until it moves.** It runs on the old droplet outside `/home/deploy/apps/`, so the runner doesn't see it and doesn't alert about it either. A checked copy of its database was taken off the droplet by hand before the move started.
- **Only the CMS has a restore check.** It's the only app whose backup format the runner knows. Every other app's restore is proven by its own CI, not against real backups.
- **Getting one CMS upload back is partly by hand.** The runner's key can only read the CMS's buckets, so `backups media-get` downloads the file and the upload back is a step in Cloudflare's dashboard.
- **The media copy only grows.** A file deleted from the CMS stays in the copy for good, and is protected against deletion for its first 60 days only.
- **Nothing more frequent than the schedule.** At best a CMS restore loses the last 6 hours. Take `backups now <app>` before anything risky.

## Out of scope

Server monitoring beyond the status page's up and down checks. Point-in-time recovery for Postgres. Rebuilding a whole server, which is its own runbook.
