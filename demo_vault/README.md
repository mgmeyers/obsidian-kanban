Scratch vault for trying the plugin out against the current source.

## Use it

```sh
yarn build:demo   # one-off build into .obsidian/plugins/kanban-custom/
yarn dev:demo     # same, but rebuilds on every change
```

Then open this folder as a vault in Obsidian (`Open folder as vault`). The
plugin is already listed in `.obsidian/community-plugins.json`, so it loads on
its own — after a `dev:demo` rebuild, reload the plugin (or the window) to pick
up the new code.

The build output isn't committed; `yarn build:demo` regenerates it.

## Boards

- [[Auto-move completed cards]] — ticking a card's checkbox moves it to the
  `Done` list. The setting is enabled on the board itself, so it works whatever
  your global setting says.

The recurring cards need the [Tasks](https://publish.obsidian.md/tasks/) plugin
to do anything interesting: without it they're ordinary cards, with it ticking
one leaves the next occurrence behind in `Todo` and sends the completed
occurrence to `Done` with a `✅` date.
