<h1 align="center">
  <img src="/public/logo.png" width="auto" height="48"/>
  <br>
  Industrious Sloth
</h1>
<p align="center">The Kanban-style task manager</p>

---

## What is the Industrious Sloth about?
The sloth is lazy, but also industrious. It wants to get tasks done, but with as little effort as possible.

Essentially it's a UI to manage markdown files. Tasks are stored in a single markdown file with a YAML Front Matter metadata header. Folder structure determines boards and lanes.
You can point Obsidian at them, sync them to Github, or think of any other workflow I can't even imagine. Plain text files are awesome and I like the flexibility they offer.

It is heavily inspired by [Vikunja](https://github.com/go-vikunja/vikunja) and [Tasks.md](https://github.com/BaldissaraMatheus/Tasks.md) (the self-hosted service, not the hosted app).

### Why not simply use Tasks.md instead?

Tasks.md is an amazing tool. I love the simple structure, the markdown editor, and the fact that it saves tasks as simple markdown files. In fact I got the idea from there. There are three reasons, however, for me to build the Industrious Sloth:
* It can handle multiple boards, but there are no options to navigate them conveniently within the UI.
* Due dates can be set, but there is no timeline view and no way to check due tasks.
* Metadata is simply written as part of the markdown file, I prefer to handle it in text form within the file, but as YAML Front Matter block.

### Why not simply use Vikunja instead?

Honestly, you should probably use Vikunja. It's an amazing tool and much more mature than the Industrious Sloth. It covers pretty much all use cases the Sloth woke up for as well. There are a few reasons why I built the Industrious Sloth anyway:
* Vikunja uses a database backend to store tasks. Which works very well, I just prefer having them as markdown files on disk.
* The Vikunja dev brings his political opinions into his software. It's "just" icon changes to support causes he likes and there is an option to disable it (implemented after community backlash), but it still puts me off the app. Even if I agree with the cause, I don't want my task app to be political. I want it to manage my tasks, nothing else. The Industrious Sloth is strictly neutral and only wants to manage tasks, it will never try to push any political or social opinions.
* Vikunja does much, much more than the Industrious Sloth. The sloth is lazy compared to the alpaca. Being able to do more can be good, but I wanted to cut down the excess and have a simple, more streamlined tool for a more narrow use case.

### What about TaskTrove?

I actually became aware of it only after I started waking up the Industrious Sloth. It stores data as a json file, not quite markdown but a text file directly accessible on the file system. I really like it. If I had known about it early, the sloth might have continued to sleep in the jungle. Still, there are some reasons to keep the sloth awake:
* I think the interface, especially in Kanban view, of TaskTrove isn't quite as intuitive as the one of Vikunja. Whether the sloth is more intuitive is for you to decie, I tried to make it so.
* It comes with pricing, subscriptions and pro features. Sure, devs need to make money, but there are also examples of features disappearing behind paywalls. The sloth doesn't care about money, it will always be open source and free (but in turn it's only a hobby/side project so it'll get less support).

## It's an early release and was designed primarily with AI, will it keep my data safe?
Yes, absolutely!

I did primarily use the Gemini AI to create this. It is "just" a kind-of fancy UI on top of regular files and folders, though.
All data is kept as simple directories and markdown files on the file system. No database, no arbitrary abstraction, just plain text files.
You should, of course, have a 3-2-1 backup strategy already and you should make sure that these files are part of it.

## Screenshots
<p align="center">
  <img src="/images/light.png" alt="boards_light" width="48%"/>
  <img src="/images/dark.png" alt="boards_dark" width="48%"/>
</p>

## Setup and installation

### Docker setup

You can simply use the following docker-compose.yml to spin up the Industrious Sloth. Make sure to create the volumes as needed.

```yaml
---
services:
  industrious_sloth:
    image: ghcr.io/h-quer/industrious_sloth:latest
    container_name: industrious_sloth
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - UID=1000
      - GID=1000
    volumes:
      - /your_sloth_dir/data:/app/data       # adjust path
    ports:
      - 8428:3000                            # remove if using reverse proxy and accessing via container name
```
Once it's set, simply pull and start the image:
```
docker compose up -d
```

The Industrious Sloth should now be watching your specified port (8428 in the example above).

### What's with the weird color scheme?

The sloth lives in the jungle. It wants familiar colors. If you don't agree with its preferences, you can fully customize the color scheme.
There is a custom.css file in the data directory. It overrides the default color schemes. Simply uncommend and adjust what you want to change.

### Directories and the config file

All data is stored in the data directory. Make sure that it exists and is readable / writable from within the container using the UID and GID set with the environment variable.

### Security

The Industrious Sloth does not offer logins or any kind of security measures. This should be fine if only using it locally or behind a VPN, but even then you might want to put it behind an auth provider. Something like Caddy basic auth is advisable, or a more full-featured solution like Authentik.
If you want to expose this to the Internet, you should definitely put it behind a proper auth solution.
The Industrious Sloth does not and will not provide auth functionality, for the simple reason that I trust neither myself nor some AI to design a safe one. Leave it to the professionaly, use an existing and tested auth solution.

## Scope and roadmap
### Continuous support

The Industrious Sloth manages my tasks and I use it daily. I will continue to support it since I want to continue using it. That being said, it's build primarily with my use case in mind and it is a hoppy/side project.

I'm more than happy to expand it to cover additional use cases if they fit the overall theme, but I don't want to over-complicate it.

The Industrious Sloth is intentionally lean and I want it to stay that way.

### Not in scope

* Auth functionality or any team/sharing features.
* Any sort of database backend, using simple markdown files is the point.
* Data export functionality. Everything is stored as simple directories and markdown files in your bind mount. You can simply copy these directories. A dedicated export functionality would be redundant.

### Improvements I hope to implement (eventually)

* I'm not perfectly happy with the markdown editor yet, I hope to improve it generally.
* Attachments / images are not possible right now, I'd like to add that functionality, but I'm not sure how to best handle their storage yet.
* Due dates are exactly that, dates. I'm thinking about whether changing them from date to datetime might be a good idea. It adds some complexity, primarily in the UI, but the functionality might be worth it.
* I'm thinking about adding multi-user support by using domain paths for each user. It'll add some complexity and the external auth provider might be more complicated to set up, but it should be possible without over-complicating the architecture.
* The default color scheme might change a bit. It's not a high priority since it's completely customizable using the custom.css file, but I'd like to default colors to look a bit "nicer", without knowing what exactly that means yet.

## How to contribute
Bug reports are always useful (if you run into bugs, which of course I hope won't happen ...).
I'm also happy to get feature requests as long as they fit with the overall theme of the Industrious Sloth and don't break the very intentional simplicity of it.
