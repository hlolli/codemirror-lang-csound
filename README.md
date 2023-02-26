## codemirror-lang-csound

Support for csound in codemirror6

```console
$ npm i @hlolli/codemirror-lang-csound codemirror --save
```

Add to extensions, example:

```ts
import { csoundMode } from '@hlolli/codemirror-lang-csound';
import { EditorView, basicSetup } from 'codemirror';

const editor = new EditorView({
  extensions: [basicSetup, csoundMode({ fileType: 'csd' })],
  parent: document.getElementById('editor')!,
});
```

[Read more on codemirror6](https://codemirror.net/)
