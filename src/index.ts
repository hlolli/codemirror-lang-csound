import {
  LRLanguage,
  LanguageSupport,
  foldNodeProp,
  foldInside,
  indentUnit,
  indentNodeProp,
  syntaxTree,
  syntaxTreeAvailable,
} from '@codemirror/language';
import { completeFromList } from '@codemirror/autocomplete';
import { SyntaxNode, TreeCursor } from '@lezer/common';
import {
  PanelConstructor,
  Decoration,
  ViewPlugin,
  showPanel,
  EditorView,
  ViewUpdate,
} from '@codemirror/view';
import { Extension, RangeSet, RangeSetBuilder } from '@codemirror/state';
import { StyleModule } from 'style-mod';
import {
  csoundTags,
  defaultCsoundLightTheme,
  htmlizeSynopsis,
  variableHighlighter,
} from './highlighter';
import { parser } from './syntax.grammar.js';
import { builtinOpcodes } from './parser-utils';

const csoundModePlugin: Extension = ViewPlugin.fromClass(
  class {
    public view: EditorView;
    constructor(view: EditorView) {
      this.view = view;
    }
    get decorations() {
      return variableHighlighter(this.view);
    }
  },
  {
    decorations: ({ view }: { view: EditorView }) => {
      return variableHighlighter(view) as any;
    },
  },
);

type LineReducer = {
  cand: string | undefined;
  stop: boolean;
  lastComma: boolean;
};

const findOperatorName = (view: EditorView, tree: TreeCursor) => {
  const treeRoot = tree.node;
  let maybeArgList: SyntaxNode | null = treeRoot;
  let maybeArgListNode: SyntaxNode | null = tree.node;

  while (maybeArgList && maybeArgList.type.name !== 'ArgList') {
    maybeArgListNode = maybeArgList?.node?.parent ?? maybeArgList.node;
    maybeArgList = maybeArgList.node.parent;
  }

  if (
    maybeArgList &&
    maybeArgList.node?.parent?.type.name === 'CallbackExpression'
  ) {
    const tokenSlice = view.state.doc.slice(
      maybeArgList.node.parent.from,
      maybeArgList.node.parent.to,
    );
    const token = (tokenSlice as any).text[0]
      .replace(/:.*/, '')
      .replace(/\(.*/, '');

    return {
      token,
      statement: tokenSlice,
      treeNode: maybeArgListNode.node.parent?.node ?? null,
    };
  }

  let maybeOpcodeStatement: SyntaxNode | null = treeRoot;
  let maybeOpcodeStatementNode: SyntaxNode | null = treeRoot;

  while (
    maybeOpcodeStatement &&
    maybeOpcodeStatement.type.name !== 'OpcodeStatement'
  ) {
    maybeOpcodeStatementNode =
      maybeOpcodeStatement?.node?.parent ?? maybeOpcodeStatement.node;
    maybeOpcodeStatement = maybeOpcodeStatement.node.parent;
  }

  if (maybeOpcodeStatement) {
    const tokenSlice = view.state.doc.slice(
      maybeOpcodeStatement.from,
      maybeOpcodeStatement.to,
    );

    const splitStatement = (tokenSlice as any).text[0].split(/\s/);
    const result = splitStatement.reduce(
      ({ cand, stop, lastComma }: LineReducer, curr: string) => {
        if (stop) {
          return {
            cand,
            stop,
            lastComma,
          };
        } else {
          if (curr.includes(',')) {
            return {
              cand: undefined,
              stop: false,
              lastComma: true,
            };
          } else if (lastComma) {
            return {
              cand: undefined,
              stop: false,
              lastComma: false,
            };
          } else {
            const tokenExists = builtinOpcodes[curr] !== undefined;

            return tokenExists
              ? { cand: curr, stop: true, lastComma: true }
              : { cand, stop: false, lastComma: false };
          }
        }
      },
      { cand: undefined, stop: false, lastComma: false } as LineReducer,
    );

    return {
      token: result.cand,
      statement: tokenSlice,
      treeNode: maybeOpcodeStatementNode,
    };
  }

  return {};
};

const csoundInfoPanel: PanelConstructor = (view: EditorView) => {
  const dom = document.createElement('div');

  return {
    dom,
    destroy() {
      dom.remove();
    },
    update(update) {
      if (update.heightChanged || update.selectionSet) {
        const isEmptyLine =
          view.lineBlockAt(view.state.selection.main.to).length < 2;
        if (isEmptyLine) {
          dom.innerHTML = '';
          return;
        }
        const treeRoot = syntaxTree(view.state).cursorAt(
          view.state.selection.main.head,
        );
        const { token: operatorName } = findOperatorName(view, treeRoot);
        const synopsis = operatorName && builtinOpcodes[operatorName];
        const hasSynopsis =
          Boolean(synopsis) &&
          Array.isArray(synopsis.synopsis) &&
          synopsis.synopsis.length > 0;
        if (hasSynopsis) {
          dom.innerHTML = htmlizeSynopsis(synopsis.synopsis[0], operatorName);
        } else {
          dom.innerHTML = '';
        }
      }
    },
  };
};

const csoundInfo = () => {
  return showPanel.of(csoundInfoPanel);
};

function foldInstrInside(
  node: SyntaxNode,
): { from: number; to: number } | null {
  let first = node.firstChild;
  if (first?.nextSibling) {
    first = first.nextSibling;
  }
  const last = node.lastChild;
  return first && first.to < last!.from
    ? { from: first.to, to: last!.type.isError ? node.to : last!.from }
    : null;
}

export const csdLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      csoundTags,
      indentNodeProp.add({
        InstrumentDeclaration: (context) =>
          context.column(context.node.from) + context.unit,
        UdoDeclaration: (context) =>
          context.column(context.node.from) + context.unit,
        ControlFlowStatement: (context) =>
          context.column(context.node.from) + context.unit,
      }),
      foldNodeProp.add({
        InstrumentDeclaration: foldInstrInside,
        UdoDeclaration: foldInstrInside,
      }),
    ],
  }),
  languageData: {
    closeBrackets: { brackets: ['(', '[', '{', "'", '"'] },
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
  },
});

const completionList = csdLanguage.data.of({
  autocomplete: Object.keys(builtinOpcodes),
});

export function csoundMode() {
  return new LanguageSupport(csdLanguage, [
    completionList,
    csoundModePlugin,
    csoundInfo(),
    indentUnit.of('  '),
    defaultCsoundLightTheme,
  ]);
}
