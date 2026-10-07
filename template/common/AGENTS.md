<!-- BEGIN BOOGY SCAFFOLD (managed by `boogy new --upgrade`; edit outside this block) -->
# {{name}}

A Boogy frontend on @boogy/web {{sdk_version}}.

- Build and deploy with the Boogy skills: invoke `using-boogy`, then
  `boogy-serving-frontends`. Never work from memory of them.
- Layout: size everything from `--u`. Mark regions that own their size with
  `surface()` and choose each component's scaling with `scale()`, both from
  `@boogy/web`. No media queries, no pixel sizes outside `theme.css`.
- Theme: the five knobs in `{{src}}/theme.css`. Your own styles go in
  `{{src}}/app.css`; they always win over the foundation's, which sits in a
  lower cascade layer.
- Check before deploying: `boogy check --layout .`
- Upgrading: the layout, theme, dev platform, Vite preset and TypeScript base
  all live in `@boogy/web`. In dist mode bump it in `package.json`; in source
  mode redeploy. `boogy new --upgrade` refreshes this block only.
- Sign-in works on your app's own address (the `URL:` that `boogy deploy`
  prints) and on a verified custom domain bound to it.
<!-- END BOOGY SCAFFOLD -->
