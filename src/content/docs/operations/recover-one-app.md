---
title: Recover one app
description: The runbook for putting one VPS app's data back from a backup with the backups helper commands, plus what's different for the CMS, TeamSpeak, the wiki and the other apps.
sidebar:
  order: 2
---

This runbook puts one app's data back from its [backups](/operations/backups/): after a bad change, a deleted record, or data that's gone wrong. It uses the `backups` helper commands, which every server's deploy installs for `deploy`, so nobody has to remember rclone or age. It's for an admin with an SSH login on the server the app runs on. The steps are the same for every app; the sections after them cover what each app does differently.

A restore replaces the app's live data with the backup's. Anything changed since that backup is lost, so step 2 keeps a copy of today's data first.

## 1. Log in and become `deploy`

On the server the app runs on, from your own login:

```sh
ssh <you>@<server>          # alexandria.flyzid.org, or the old droplet for apps not yet moved
sudo -iu deploy             # the helper commands, the runner's key and the apps all belong to deploy
backups --help
```

You should see the list of commands. If `backups` isn't found, the shell predates the deploy that installed it: `exec bash -l`, or run `bash ~/backup-runner/backups.sh` instead, which is the same thing. Every command takes `--help`.

Nothing here changes anything. Leave with `exit`, twice.

> **Why `deploy`.** Your own account isn't in the `docker` group, by design, and the runner's secrets are readable only by `deploy`. Acting as `deploy` means the helpers see exactly what the runner sees.

## 2. Keep a copy of today's data

```sh
backups now <app>
```

It runs the app's recipe and uploads the result exactly as the hourly runner does, while the app keeps running. You should see `Done: frequent/<app>/ in r2:indy-center-backups`. It goes into `frequent/` only, kept 14 days, and the app's schedule carries on as before. A failure is shown on screen, not sent to Discord.

This is the way back if the restore turns out worse than what was there. Skip it only if the app's data is unreadable anyway.

Nothing to undo: the copy expires on its own after 14 days, and can't be deleted sooner.

## 3. Pick the backup

```sh
backups list <app>
```

You should see every backup of the app, oldest first, so the newest is at the bottom:

```
Backups of payload (UTC, oldest first):
2026-10-20T070000Z-payload.tar.age           1.2M      frequent daily monthly
2026-10-20T130000Z-payload.tar.age           1.2M      frequent
```

Each name starts with the UTC time of its run. The commands below take a full name, the start of one (`2026-10-20T07`), or `latest`. Pick the last backup from before the problem started; step 2's copy is the newest line. Changes nothing.

`Couldn't list …` with rclone's error means R2 or the runner's key is the problem, not that there are no backups. `No backups of <app>` means the name is wrong: apps are named for their folder in `~/apps`, which is the repository's name.

## 4. Look inside it first (optional)

To check a backup holds what you want before restoring it:

```sh
mkdir -m 700 ~/look && backups fetch <app> <backup> ~/look
```

You should see `Done: /home/deploy/look/<name>`, the decrypted file, readable only by `deploy`. It holds the app's data, members' details and password hashes included. Changes nothing on the live app.

Undo, and do it as soon as you're done: `rm -r ~/look`.

For the CMS, [a scratch database](#look-at-old-data-without-restoring) is easier than reading a dump.

## 5. Restore

```sh
backups restore <app> <backup>
```

It downloads and decrypts the backup, says what it's about to do, and asks you to type the app's name. Anything else stops it with nothing changed. Then it waits for any hourly run to finish and runs the app's `restore.sh` with the file. You should see the app's own `restore.sh` output, then:

```
Done: <app> is restored from <name>. Check it works.
```

The decrypted file is deleted when the restore ends, however it ends. The restore is logged in `~/backup-runner/logs/runner.log` with the hourly runs.

`<app> has no restore.sh` means the app doesn't ship one, so this command can't restore it: `backups fetch` still gets the file, and the app's README says how to put it back. `restore.sh exited <n>` means the restore itself failed. Each app's `restore.sh` reacts differently; see its section below before doing anything else.

Undo: restore the copy from step 2 the same way, `backups restore <app> <name from step 2>`.

## 6. Check the app

Open the app as a user would, and check what was broken is back. For an app with a web surface:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://<name>.flyindycenter.com/
cd ~/apps/<app> && docker compose ps && docker compose logs --tail 50
```

You should see `200` and every container up. Nothing to undo; if the app is worse than before, go back to step 5's undo.

## The CMS (payload)

A CMS backup is the database only. Uploaded files live in the R2 buckets `payload-media` and `payload-private`, and `restore.sh` leaves them alone; Payload never overwrites an upload, so a restored database still finds every file it names.

**If `restore.sh` fails**, the CMS stays stopped and a `restore-failed` file is left in `~/apps/payload/`. While it's there, **Build and Deploy** fails before touching the server. That's deliberate: started on an empty database, the CMS offers its first-admin sign-up to anyone. Don't start the CMS or deploy by hand. Fix the cause (the output says which step failed) and run the restore again, which removes the file once the load succeeds. If the CMS doesn't answer within 3 minutes after a good load, check `docker compose logs app`: its first request after a restore runs any migrations newer than the backup.

### Look at old data without restoring

To copy one deleted page or course out of an old backup, load it beside the live CMS instead of replacing it:

```sh
backups scratch-cms <backup>
```

It starts a throwaway Postgres 17, `backups-scratch-cms`, loads the backup into its database `payload`, and prints how to connect: `docker exec -it backups-scratch-cms psql -U postgres payload` on the server, or an SSH tunnel to `127.0.0.1:15432` from your computer with the password it prints. The live CMS is never touched.

Undo, when you're done: `backups scratch-cms remove`, which deletes the container and its data.

### Bring back a deleted upload

The media copy keeps every file ever uploaded. Find the file, then download it:

```sh
backups media-find <part of its name>          # prints <bucket>/<path> lines
backups media-get payload-media/<path> ~/look  # mkdir -m 700 ~/look first
```

`media-get` changes nothing: the runner's key can only read the CMS's buckets. It prints where the file belongs and how to get it to your computer, through `/tmp`, since your own login can't read `deploy`'s files:

```sh
install -m 644 ~/look/<name> /tmp/<name>        # as deploy, on the server
scp '<you>@<server>:/tmp/<name>' .              # on your computer
```

Then, in the Cloudflare dashboard, **R2 → the bucket**, open the folder it printed and upload the file under the same name, so the CMS finds it at the same key again. Delete `/tmp/<name>` and `~/look` on the server afterwards. A file from `payload-private` is members-only: keep it off anything shared on the way.

Undo: delete the uploaded file in the bucket. The media copy still has it.

### Check a backup loads

`backups restore-check` runs the weekly restore check now: loads the newest CMS backup into a throwaway database, checks every table and its row count, and removes it. It says `Restore check passed` or names the step that failed. Changes nothing.

## TeamSpeak (teamspeak-server)

The backup holds the server's **identity**, its key pair, inside its SQLite database. Clients remember it, so a server that comes back with a new identity is a different server to them: they warn, and saved bookmarks and permissions don't match. Only the backup brings the same identity back, which is why the archive is treated as a secret. `restore.sh` checks for it: if the server announces a new admin privilege key on start, it started on an empty database, and the restore counts as failed.

Everyone on the server is disconnected while it restarts. Afterwards, restart the legacy Discord sync bot, in `/opt/ts-disc-control` on the droplet: it never reconnects to ServerQuery on its own.

**If `restore.sh` fails** after the server stopped, it puts the earlier data back, starts the server on it, and says so. If even that fails, the earlier data stays in the volume at `/var/ts3server/.restore-old`, and the next restore refuses to run until it's been put back:

```sh
cd ~/apps/teamspeak-server && bash restore.sh --undo
```

You should see `Put back the data from before the interrupted restore.`

## The wiki

**Status.** The wiki doesn't run on the deploy pipeline yet, so nothing here applies to it until it moves; until then its copy is the one taken by hand before the move started. This section describes the recipe the wiki moves with.

A wiki backup is one compressed archive, `wiki.tar.gz`, holding its SQLite database, `database.sqlite`, and its `content` folder. The database is everything the wiki is: pages, uploaded files, user accounts, the OAuth2 sign-in settings and the session keys. It holds password hashes and the sign-in client secret, so don't leave a decrypted copy lying around. The `/wiki/backups` volume, where the Local File System storage target writes its copy of the pages, isn't in the backup on purpose: it's a copy of what's in the database.

Before stopping anything, `restore.sh` unpacks the archive and checks the database: SQLite's integrity check, and a `pages` table, so a file that isn't a Wiki.js database is refused. You should see:

```
Its database passed SQLite's integrity check and holds <n> pages
```

Then it stops the wiki, sets its data aside, swaps the archive's in, starts it, and waits up to 5 minutes for it to answer `/healthz`. A wiki that comes up on its setup page instead — it found no settings in the database, and would offer setup to anyone who opens the site — or that keeps restarting counts as failed. On any failure after the stop, it puts the earlier data back and starts the wiki on it, and says so. You should see `Restored wiki.tar.gz` when it worked.

**If a restore was interrupted**, the earlier data stays in the volumes at `/wiki/data/.restore-old` and `/wiki/data/content/.restore-old`, and the next restore refuses to run until it's been put back:

```sh
cd ~/apps/wiki && bash restore.sh --undo
```

You should see `Put back the data from before the interrupted restore.`, or `Nothing to undo: no data set aside by an interrupted restore.` if there was nothing to put back.

`restore.sh` also takes a bare SQLite copy of the database, such as the one taken by hand before the move, instead of an archive. Run it from `~/apps/wiki` as `bash restore.sh <file>.sqlite`. The `content` folder then comes back empty.

Restore with the image version the backup was taken on. Wiki.js migrates its database on start and can't go back, so a backup restored into a newer version is upgraded for good. The image is pinned in the wiki's `deploy/docker-compose.yml`; take `backups now wiki` before changing it.

The exports in the admin area (to the `wikijs-backup` bucket, or to a local folder) are copies of the pages, not backups: Wiki.js can bring back pages and files from them, but not users, groups or sign-in settings.

## indy-larry

`restore.sh` checks every file in the archive before changing anything, then swaps them in by renaming and restarts the bot, which carries on with the same status messages, timers and any running Iron Mic. If the swap fails part-way, it puts the old files back. A restore killed part-way leaves `.restore-new` or `.restore-old` in the bot's volume, and the next restore refuses to run until they've been checked and removed by hand: `.restore-old` may hold the only copy of the old files.

## Postiz and Moodle

Both restore their databases and uploaded files together, stopping the app while they do. Restoring Moodle signs everyone out. Postiz's Redis isn't in the backup; Postiz refills it.

## An app on a new server

Backups are kept by app name, not by server, so an app deployed to a new server can be restored there from the old server's backups. Deploy the app first, so `~/apps/<app>/` and its `restore.sh` exist, then follow the steps above on the new server. The CMS's `restore.sh` starts its database itself when it isn't running yet. Moving a whole server, DNS included, is the Rebuild the VPS runbook's job.
