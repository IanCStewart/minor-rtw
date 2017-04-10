# Contributing

## Commits

Use [gitmoji](https://github.com/carloscuesta/gitmoji/) to make commits. Please consider installing this globally on your machine.

When ready to commit please do the following:
* Make sure gitmoji is initiated `gitmoji -i`
1. Add the files your creating a commit for `git add $[FILES]`
2. Run the gitmoji cli `git commit`
3. Choose the right emoji corresponding to your work. For a full visual list visit [the gitmoji site](https://gitmoji.carloscuesta.me/)
4. Enter the commit title of what your work represents
5. Commit message is not needed if your title is clear enough
6. If it's a bug fix state the issue #
7. Hit `⏎` (enter) to sign the commit
8. Vim will open write and quit this to finish the commit `:wq`
9. Push the commits (pat your self on the back you've done it)

## Pull Requests

Before making a Pull Request (PR) makes sure the code passes the linter `npm run lint`. If this doesn't throw errors in your terminal you are ready to make a PR.

1. Make sure the title is explanatory
2. Make sure the description explains whats new or fixed
