## About

Surviv Fun is an open-source 2D battle royale game inspired by [suroi.io](https://suroi.io) and [surviv.io](https://survivio.fandom.com/wiki/Surviv.io_Wiki). It is currently a work in progress.

## Play the game!

[surviv.fun](https://surviv.fun)


## Join the Discord!

[discord.surviv.fun](https://socials.surviv.fun/discord)

## Development

To run the game locally, open a terminal in the project root and run the following:

```sh
pnpm dev
```

To open the game, go to http://127.0.0.1:3000 in your browser.

## Production

To build for production, run this command in the project root:

```sh
pnpm build
```

To start the WebSocket server, run this command:
```sh
pnpm start
```

Production builds are served using [NGINX](https://nginx.org). A sample configuration file can be found [here](nginx.conf).
