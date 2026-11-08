---
title: Rebuild the VPS
description: The runbook for setting up a VPS server from nothing and moving apps onto it, from 1Password to switching DNS, plus what to do when its IP changes and day-to-day upkeep.
sidebar:
  order: 3
---

This runbook takes a server from nothing to running apps: after a server is lost, or to add one and move apps across. It's also the guide for moving an app from one server to another. It's written from setting up ALEXANDRIA in October 2026 and moving the CMS onto it, so the steps are ones that have run. The few that haven't yet are marked.

Read it through once before starting. Each step says what it does, what you should see, and how to undo it. Exact commands for the base setup stay in [`host/README.md`](https://github.com/Indy-Center/docker-infrastructure/blob/main/host/README.md) in `docker-infrastructure`; this page explains them and covers everything around them.

**Who runs what.** You'll act as three different users:

| As                            | For                                                                                       | How                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| `root`                        | The first login only, until `bootstrap.sh` has run. After that root can't log in over SSH | The provider's console, or SSH          |
| Your own account, with `sudo` | Anything below Docker: `apply.sh`, admins, the firewall check, Docker upgrades, reboots   | `ssh <you>@<server>`                    |
| `deploy`                      | Anything about apps and backups: the `backups` commands, `docker compose` in `~/apps/`    | `sudo -iu deploy` from your own account |

Your own account isn't in the `docker` group, by design, and the `backups` command exists only for `deploy`. Use `sudo -iu deploy`, with `-i`. Plain `sudo -u deploy` leaves you in your own home folder, where `deploy` may not be able to write.

## 1. Get the secrets from 1Password

Everything a rebuild needs that isn't in git is in the shared **Infrastructure** vault. Check you can open each item before starting, so you're never stuck halfway:

| Item                                      | Needed for                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| The hosting provider's account            | The server, its console and its firewall                                                                                |
| Cloudflare — account                      | The server's DNS record, app records, and the DNS token's IP allow-list                                                 |
| Backups — age encryption key              | Already a repository secret, but check it's there. **Without it, every backup is unreadable**                           |
| Traefik — Cloudflare DNS token            | Already a repository secret; needed only to rotate it                                                                   |
| Backups — R2 runner key, Discord webhooks | Already repository secrets; needed only to rotate them                                                                  |
| `<SERVER>` — deploy key (SSH)             | A new key pair for this server's `deploy`, never another server's, so a leak from one can't open another. Make it first |
| `<SERVER>` — sudo (`<you>`)               | Your sudo password on the server, set in step 3                                                                         |

You also need to be an owner of the Indy-Center GitHub organization, to make its org settings, and able to merge in `docker-infrastructure`.

The deploy writes every secret a server needs for itself from `docker-infrastructure`'s repository secrets. A rebuilt server needs no secret copied onto it by hand.

## 2. Name the server

Run the Ubuntu release `host/` supports, on x86-64, in US East: TeamSpeak's voice is sensitive to latency.

**Choose the name.** It becomes the prefix of the server's four org settings (`ALEXANDRIA_HOST` and so on), the runner's name for it in every backup report (`alexandria`), and its hostname. Pick one that will still make sense next to a third server.

**Give it its own DNS record.** In Cloudflare, add an A record `<name>.flyzid.org` to the server's IP, **DNS only**. Everything uses this name, never the IP: SSH, the `_HOST` setting, the known-hosts line, and every app's record. So an IP change is one record to fix.

## 3. First login

As root. This step takes a few minutes.

Check the image's SSH settings first. If it allows password login and you can't run `bootstrap.sh` straight away, turn it off until you can; `bootstrap.sh` sets SSH properly and removes the stopgap ([`host/README.md`](https://github.com/Indy-Center/docker-infrastructure/blob/main/host/README.md#first-login-a-new-server) says how).

**Fetch `host/` at a pinned commit and run `bootstrap.sh`.** Use the full SHA of the commit you've read, never a branch name, so what runs is what you reviewed. Run it with the server's hostname, your username, your public key, and the public half of the deploy key, each key in quotes. [`host/README.md`, "First login"](https://github.com/Indy-Center/docker-infrastructure/blob/main/host/README.md#first-login-a-new-server) has the exact commands. Your username must already be in `AllowUsers` in `host/`; if it isn't, it stops before changing anything.

It updates the packages, makes your account (asking for the password to keep in 1Password) and `deploy`, sets the hostname, applies the base setup (step 5), and adds `deploy` to `docker`.

**Before closing the root session,** check from a second terminal that you can log in as yourself and use `sudo`, since root can't log in over SSH once it has run. If you can't, keep the root session open and fix it there.

_Undo:_ reinstall the server from the provider's control panel; nothing outside it has changed yet.

## 4. The firewall

The provider's network firewall runs before traffic reaches the server, so it also covers ports Docker publishes. Set it by hand, for IPv4 and IPv6, to drop everything not allowed:

| Protocol | Port  | For                                           |
| -------- | ----- | --------------------------------------------- |
| TCP      | 22    | SSH                                           |
| TCP      | 80    | Traefik, which redirects to HTTPS             |
| TCP      | 443   | Traefik                                       |
| UDP      | 9987  | TeamSpeak voice, only once TeamSpeak is on it |
| TCP      | 30033 | TeamSpeak file transfer, likewise             |

> **Why not `ufw`.** It can't see the ports Docker publishes, so it would look like it covered them when it doesn't.

**Prove it drops a port nothing allows,** once. On the server, publish a throwaway container on 9999; from your own computer, `curl -m 5 http://<name>.flyzid.org:9999/` must time out, not answer. Then stop the container and check `sudo ss -tulpn` shows only sshd on 22, plus services on `127.0.0.x`. [`host/README.md`, "The outside port test"](https://github.com/Indy-Center/docker-infrastructure/blob/main/host/README.md#the-outside-port-test) has the commands.

**Check the provider's console works,** once. It gets you in when SSH doesn't, so it's the way back from a lockout.

_Undo:_ remove the rules. They belong to the server, so they survive an IP change.

## 5. What the base setup gave you

`bootstrap.sh` ran `apply.sh`, which makes the server match the files in `host/`. Nothing here is a step; it's what you now have, and why:

| What           | Set to                                                                                                                                            | Why                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| SSH            | Keys only, no root login, `AllowUsers` lists the admins and `deploy`. Its drop-in sorts first, so the image's own SSH settings can't undo it      | No password guessing can work, so there's no fail2ban                                                      |
| Admins         | Each has their own account, in `sudo` with their own password, not in `docker`                                                                    | The logs say who did what, and one person can be removed alone                                             |
| `deploy`       | In `docker`. Its key line has `restrict`: no forwarding, no terminal                                                                              | The deploys need only commands and rsync                                                                   |
| Docker         | From Docker's own apt repository, never the snap. Its packages are held. `live-restore` is on, and every container gets json-file logs of 10m × 5 | Docker upgrades happen on purpose; containers survive a daemon restart; no app can fill the disk with logs |
| Updates        | Security updates install daily, and the server never reboots itself                                                                               | An admin picks the reboot time                                                                             |
| Logs, swap     | journald keeps 1 GB for 30 days; a 4 GB swapfile at swappiness 10                                                                                 | A memory spike slows things down instead of the kernel killing the CMS's database                          |
| Clock          | UTC                                                                                                                                               | The runner's schedule is in UTC                                                                            |
| `/home/deploy` | `traefik/`, `apps/`, `backup-runner/` and `backups/`, owned by `deploy`. Later deploys add `host/` and `app-dns/`                                 | Every deploy writes into one place                                                                         |
| Network        | `traefik-shared`, which Traefik and every app join                                                                                                | Traefik reaches apps without any app publishing a port                                                     |

_You should see_ `sudo bash /home/deploy/host/apply.sh --check` report 0 differences once step 7's deploy has put `host/` there. Until then, run it from the folder you fetched in step 3.

## 6. Connect it to Cloudflare and GitHub

**Add the server's IP to the Cloudflare DNS token's allow-list.** The token Traefik uses for its certificate accepts calls only from listed IPs. Without the new IP, the new Traefik can't get its certificate, and the DNS record step in app deploys fails. Leave the other servers' IPs there.

**Get the server's known-hosts line,** from your own computer:

```sh
ssh-keyscan <name>.flyzid.org
```

Check its ed25519 fingerprint against the one the provider's console shows (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`), so you know the line is from the real server.

**Make its four org settings,** in **Org Settings → Secrets and variables → Actions**, named with its prefix:

| Name                      | Kind     | Value                             |
| ------------------------- | -------- | --------------------------------- |
| `<SERVER>_HOST`           | variable | `<name>.flyzid.org`, never the IP |
| `<SERVER>_DEPLOY_USER`    | variable | `deploy`                          |
| `<SERVER>_DEPLOY_SSH_KEY` | secret   | The deploy key's private half     |
| `<SERVER>_KNOWN_HOSTS`    | secret   | The line(s) from `ssh-keyscan`    |

Limit each to **Selected repositories**: `docker-infrastructure`, plus each app that will run on the server. A deploy key can do anything `deploy` can, and `deploy` is in the `docker` group, so it's as good as root on that server.

**Add it to `docker-infrastructure`'s server list.** In a pull request, add the prefix to `server:` in `.github/workflows/build-and-deploy.yml` (`[VANDERBILT, ALEXANDRIA]` today).

_Undo:_ remove the prefix from the list, delete the four settings, and take the IP off the allow-list.

## 7. Deploy Traefik and the backup runner

**Check the certificate first (optional).** **Actions → Staging certificate check → Run workflow**, with the server's prefix. It starts a throwaway Traefik on the server, asks Let's Encrypt's staging service for the wildcard certificate, and removes everything after. It proves the SSH settings, the token and its allow-list together, without touching anything live, in under a minute.

**Merge the server list pull request.** Build and Deploy runs once per server. On the new one it writes Traefik's Cloudflare token, starts Traefik, and installs the backup runner with its secrets (rclone's `r2:` remote, the age key, the webhooks), its crontab entry and the `backups` command. It copies `host/` and `app-dns/` too. The other servers get the same Traefik again, with no change, so their sites stay up.

:::note[Until the droplet's wiki moves]
Traefik's config still names `frontend`, the network the droplet's old Traefik used, so a new server's first deploy fails with `network frontend declared as external, but could not be found`. Make it empty, as `deploy`, then re-run the failed job: `docker network create frontend`. It goes away when the wiki moves off the droplet.
:::

_You should see_ every server's job go green. Then on the new server:

- As `deploy`: `backups --help` lists the commands, and `backups list payload` lists the CMS's backups. Backups are kept by app, not by server, so a new server can read what another wrote.
- As your own account: `sudo bash /home/deploy/host/apply.sh --check` reports 0 differences.
- The next morning, the server's first backup report in Discord names it, even with nothing to back up yet.

_Undo:_ drop the server from the list and merge again. Nothing on the other servers changes.

## 8. Move each app

One app at a time. Each one's data comes from its last backup, through the same [Recover one app](/operations/recover-one-app/#an-app-on-a-new-server) steps used for any restore. The CMS moved this way on 2026-10-25, down for about 15–25 minutes.

An empty app on a new server is a risk: an empty CMS offers first-admin sign-up, and an empty Wiki.js offers its setup page, to whoever opens it first. Keeping its DNS record on the old server keeps ordinary visitors away, but not someone who sends the app's hostname straight to the new server's IP: Traefik routes by the name asked for, and port 443 is open to everyone. So restore straight after the deploy, without a gap. The restore replaces the whole database, including anything someone set up in the meantime. An app like that also leaves the DNS record step out of its workflow until its data is restored and checked.

1. **A day before:** lower the TTL on the app's DNS record to 60 or 120 seconds, so the switch in step 7 takes effect quickly. Give the app's repository access to the new server's four settings. Tell the people who edit the app when it will pause. Hold the app's other merges until it's moved: a push to `main` deploys.
2. **Point its workflow at the new server,** in a pull request: `SERVER: <SERVER>` in its `build-and-deploy.yml`. Don't merge yet. If its last check calls the app by its hostname, make it call the server it deployed to (`curl --connect-to`), since DNS still names the old one.
3. **Freeze and back it up.** On the old server, as `deploy`: `backups now <app>`, then `backups list <app>`, and note the new backup's full name. Stop the app, keeping its data: `docker compose down` in `~/apps/<app>`. **Never add `-v`: it deletes the volumes.** _You should see_ `docker volume ls` still list the app's volumes. _Undo:_ `docker compose up -d` in the same folder.
4. **Merge the pull request.** Build and Deploy starts the app on the new server, empty. Visitors still go to the old server, but the empty app can be reached by IP, so go straight on to the restore.
5. **Restore** on the new server, as `deploy`: `backups restore <app> <the backup's full name>`. **Use the full name, never `latest`:** the new server's runner may already have backed up the empty app. [Recover one app](/operations/recover-one-app/) has what each app's restore does.
6. **Check it before DNS moves,** from your computer: `curl -sI --resolve <host>:443:<new server's IP> https://<host>/` answers as the app should, not with a setup or sign-up page. For a real look, add a hosts-file line pointing the hostname at the new server, sign in and look around, then remove the line.
7. **Switch DNS** (next section). _You should see_ the new server's Traefik log show the app's requests within the TTL.
8. **Take the old copy out of the old runner.** On the old server, as `deploy`: `mkdir -p ~/moved-apps && mv ~/apps/<app> ~/moved-apps/`. The runner backs up only what's under `~/apps`, so it stops backing up the stopped copy into the folders the new server now uses. The volumes stay as the fallback. _Undo:_ move it back.
9. **Back it up from the new server:** `backups now <app>`. The next morning, the new server's report lists the app and the old one's doesn't. Put the TTL back.

_Undo, after step 7:_ point DNS back at the old server, move its copy back into `~/apps/` and `docker compose up -d` there, and revert the pull request. Edits made on the new server since the switch are lost, unless you first restore a backup from the new server onto the old one the same way.

Apps with no data, like Postiz and Moodle when they started, just deploy to the new server: there's nothing to freeze or restore.

**Not run this way yet** (the steps above are the plan):

- **The wiki.** It isn't on the deploy pipeline on the droplet, so its freeze is a checked copy taken by hand rather than `backups now`, restored with its own `restore.sh` as [Recover one app](/operations/recover-one-app/#the-wiki) describes. Once it's off the droplet, the `frontend` network in step 7 is retired.
- **TeamSpeak.** Clients connect to it directly, not through Traefik, so it also needs its ports (below), and anything that names the old IP rather than the hostname has to change.

## 9. Switch DNS

Each app has its own DNS record, a **CNAME to its server's own name** (`<name>.flyzid.org`), not an A record to the IP, so an IP change is one record to fix. Records are DNS-only: Traefik serves the certificate itself.

- **A new app** gets its record from its deploy. The DNS record step creates a missing CNAME to the server it deployed to, and never changes or deletes a record ([Deploying to the VPS servers](/patterns/vps-apps/#hostname-dns-and-certificate)).
- **A moving app** already has a record, pointing at the old server, so the step only warns. Switch it by hand in Cloudflare, **DNS → Records**: make it a CNAME to the new server's name. Keep its proxy setting as it was. This is deliberate: a switch is one step of a move, done by a person, and a typo in an app's config can't take over another app's hostname.

The `*.flyindycenter.com` wildcard record points at the droplet and is never moved. A hostname with no record of its own answers from the droplet, so check an app has its own record before relying on it. Once every app has moved, the wildcard is deleted with the droplet's records, and a hostname with no record then fails to resolve instead of quietly reaching the wrong server.

Lower a record's TTL a day before switching it, and put it back after. A proxied record ignores its TTL and switches almost at once.

## 10. TeamSpeak's ports

TeamSpeak is the one app that publishes ports of its own. Before it moves to a server, add UDP 9987 (voice) and TCP 30033 (file transfer) to that server's firewall, for any source. Never its ServerQuery ports. Its DNS record is the one clients connect to directly, so lower its TTL a day ahead like any other. Not run yet: TeamSpeak moves to ALEXANDRIA after this page is written.

## 11. Retire the old server

Once its apps have all moved and the new server has had a week of good backups, take out everything that still points at the old server. Not run yet: this is the plan for the droplet.

- Drop its prefix from `docker-infrastructure`'s server list, and delete its four org settings (`VANDERBILT_HOST`, `VANDERBILT_KNOWN_HOSTS` and the rest).
- Take its IP off the Cloudflare DNS token's allow-list.
- Delete its DNS records, and the `*.flyindycenter.com` wildcard with them.
- Remove TeamSpeak's ports from its firewall, if it had them.

## If the server's IP changes

The provider may not keep an IP for good. Everything uses the server's hostname, so a change is three fixes by hand:

1. **Its A record:** in Cloudflare, set `<name>.flyzid.org` to the new IP, DNS only. App records are CNAMEs to it, so they follow.
2. **The DNS token's allow-list:** add the new IP and remove the old one. Until then, Traefik can't renew its certificate and app deploys can't make DNS records.
3. **The known-hosts line:** `ssh-keyscan <name>.flyzid.org` from your computer. If it differs from the `<SERVER>_KNOWN_HOSTS` secret (it will if the server was rebuilt), check its fingerprint against the console's and update the secret. Until then, every deploy to it fails at SSH.

The status page shows the outage until DNS catches up. The firewall rules belong to the server, so they stay.

## Looking after a server

As your own account, with `sudo`. [`host/README.md`](https://github.com/Indy-Center/docker-infrastructure/blob/main/host/README.md) has each command.

- **Apply a change to `host/`.** Make it in a pull request. Once merged, the deploy copies `host/` to every server set up from it, but never runs it, and each server's backup report counts the differences until an admin applies it. Run `sudo bash /home/deploy/host/apply.sh --check`, read what it would change, then run it without `--check`. Run it with `sudo` from your own account, not a root shell: its SSH guards check that you, and `deploy`, can still log in afterwards.
- **Add an admin.** Add their username to `AllowUsers` in `host/` in a pull request. Then on each server, make their account in `sudo`, install the key they gave you directly (never from GitHub's list of their keys), apply the change, and have them log in and run `sudo -v`. Add their sudo password to 1Password as "`<SERVER>` — sudo (`<them>`)".
- **Remove an admin.** Take them out of `AllowUsers` in a pull request, apply it on each server, then `sudo deluser --remove-home <them>`. Another admin does this: `apply.sh` won't let you remove yourself.
- **Upgrade Docker,** about every quarter, at a quiet time: unhold its packages, install the new ones, then run `apply.sh`, which holds them again. `live-restore` keeps the containers running while the daemon restarts.
- **Reboot** at a quiet time, away from the 07:00 UTC backups. The backup report says when one is needed, and an alert goes out after 14 days. Every app uses `restart: unless-stopped`, so they come back on their own.
