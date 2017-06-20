Utility to render the output of flow into an interactive webpage.

The main goal of this utility is to make it easier to navigate through flow errors:
on larger projects minor errors can often result in hundreds of lines of errors, making
it difficult to filter this down to the root cause. The HTML render of these errors allows
for collapsing parts of the error trees, which makes it much easier to navigate them. 

## Usage:

```
flow --json | flow-web-logger [--root <root>] > error-page.html
```

If the optional parameter `--root` is set then all paths will be printed relative to the root directory.

