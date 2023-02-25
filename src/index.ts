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
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { completeFromList } from '@codemirror/autocomplete';
import { SyntaxNode } from '@lezer/common';
import { Tag, styleTags, tags as t } from '@lezer/highlight';
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
import { parser } from './syntax.grammar.js';
import * as builtinOpcodesStar from './builtin-opcodes.json';

const builtinOpcodes: Record<
  string,
  { synopsis: string[]; short_desc: string }
> = builtinOpcodesStar;

const globalVarCssClassName = 'cm-csound-global-var';

const globalConstantCssClassName = 'cm-csound-global-constant';

const globalConstantDecoration = Decoration.mark({
  attributes: { class: globalConstantCssClassName },
});

const iRateVarCssClassName = 'cm-csound-i-rate-var';

const iRateVarDecoration = Decoration.mark({
  attributes: { class: iRateVarCssClassName },
});

const giRateVarDecoration = Decoration.mark({
  attributes: {
    class: [iRateVarCssClassName, globalVarCssClassName].join(' '),
  },
});

const opcodeCssClassName = 'cm-csound-opcode';

const opcodeDecoration = Decoration.mark({
  attributes: { class: opcodeCssClassName },
});

const aRateVarCssClassName = 'cm-csound-a-rate-var';

const aRateVarDecoration = Decoration.mark({
  attributes: { class: aRateVarCssClassName },
});

const gaRateVarDecoration = Decoration.mark({
  attributes: {
    class: [aRateVarCssClassName, globalVarCssClassName].join(' '),
  },
});

const kRateVarCssClassName = 'cm-csound-k-rate-var';

const kRateVarDecoration = Decoration.mark({
  attributes: { class: kRateVarCssClassName },
});

const gkRateVarDecoration = Decoration.mark({
  attributes: {
    class: [kRateVarCssClassName, globalVarCssClassName].join(' '),
  },
});

const sRateVarCssClassName = 'cm-csound-s-rate-var';

const sRateVarDecoration = Decoration.mark({
  attributes: { class: sRateVarCssClassName },
});

const gsRateVarDecoration = Decoration.mark({
  attributes: {
    class: [sRateVarDecoration, globalVarCssClassName].join(' '),
  },
});

const fRateVarCssClassName = 'cm-csound-f-rate-var';

const fRateVarDecoration = Decoration.mark({
  attributes: { class: fRateVarCssClassName },
});

const gfRateVarDecoration = Decoration.mark({
  attributes: {
    class: [fRateVarDecoration, globalVarCssClassName].join(' '),
  },
});

const pFieldVarCssClassName = 'cm-csound-p-field-var';

const pFieldVarDecoration = Decoration.mark({
  attributes: { class: pFieldVarCssClassName },
});

const xmlTagCssClassName = 'cm-csound-xml-tag';

const xmlTagDecoration = Decoration.mark({
  attributes: { class: xmlTagCssClassName },
});

const gotoTokenCssClassName = 'cm-csound-goto-token';

const gotoTokenDecoration = Decoration.mark({
  attributes: { class: gotoTokenCssClassName },
});

const macroTokenDecoration = Decoration.mark({
  attributes: { class: 'cm-csound-macro-token' },
});

const variableTag = Tag.define(); // acts as i-rate and fallback
const opcodeTag = Tag.define();
const xmlTag = Tag.define();
const bracketTag = Tag.define();
const defineOperatorTag = Tag.define();
const controlFlowTag = Tag.define();

const csoundTags = styleTags({
  instr: defineOperatorTag,
  endin: defineOperatorTag,
  opcode: defineOperatorTag,
  endop: defineOperatorTag,
  String: t.string,
  LineComment: t.lineComment,
  BlockComment: t.comment,
  Opcode: opcodeTag,
  init: opcodeTag,
  AmbiguousIdentifier: variableTag,
  XmlCsoundSynthesizerOpen: xmlTag,
  XmlOpen: xmlTag,
  XmlClose: xmlTag,
  ArrayBrackets: bracketTag,
  if: controlFlowTag,
  do: controlFlowTag,
  fi: controlFlowTag,
  while: controlFlowTag,
  ControlFlowDoToken: controlFlowTag,
  ControlFlowGotoToken: controlFlowTag,
  ControlFlowEndToken: controlFlowTag,
  ControlFlowElseIfToken: controlFlowTag,
  ControlFlowElseToken: controlFlowTag,
  '(': bracketTag,
  ')': bracketTag,
  '[': bracketTag,
  ']': bracketTag,
  '{': bracketTag,
  '}': bracketTag,
});

function isGlobalConstant(token: string) {
  return ['sr', 'kr', 'ksmps', '0dbfs', 'nchnls', 'nchnls_i'].includes(token);
}

function decorateAmbigiousToken(token: string, parentToken: string) {
  if (isGlobalConstant(token)) {
    return globalConstantDecoration;
  } else if (
    parentToken === 'CallbackExpression' ||
    builtinOpcodes[token.replace(/:.*/, '')]
  ) {
    return opcodeDecoration;
  } else if (['XmlOpen', 'XmlClose'].includes(parentToken)) {
    return xmlTagDecoration;
  } else if (/^p\d+$/.test(token)) {
    return pFieldVarDecoration;
  } else if (token.startsWith('a')) {
    return aRateVarDecoration;
  } else if (token.startsWith('k')) {
    return kRateVarDecoration;
  } else if (token.startsWith('S')) {
    return sRateVarDecoration;
  } else if (token.startsWith('ga')) {
    return gaRateVarDecoration;
  } else if (token.startsWith('gk')) {
    return gkRateVarDecoration;
  } else if (token.startsWith('gS')) {
    return gsRateVarDecoration;
  } else if (token.startsWith('f')) {
    return fRateVarDecoration;
  } else if (token.startsWith('gf')) {
    return gfRateVarDecoration;
  } else if (/^\$.+/.test(token)) {
    return macroTokenDecoration;
  } else if (token.startsWith('gi')) {
    return giRateVarDecoration;
  } else if (token.endsWith(':')) {
    return gotoTokenDecoration;
  } else {
    return iRateVarDecoration;
  }
}

function variableHighlighter(view: EditorView) {
  const builder = new RangeSetBuilder();
  for (const { from, to } of view.visibleRanges) {
    if (syntaxTreeAvailable(view.state, to)) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (cursor) => {
          if (cursor.name === 'AmbiguousIdentifier') {
            const tokenSlice = view.state.doc.slice(cursor.from, cursor.to);
            const token = (tokenSlice as any).text[0];
            if (cursor.node.parent?.name) {
              const maybeDecoration = decorateAmbigiousToken(
                token,
                cursor.node.parent.name,
              );
              if (maybeDecoration) {
                builder.add(cursor.from, cursor.to, maybeDecoration);
              }
            }
          }
        },
      });
    }
  }
  return builder.finish();
}

const defaultCsoundThemeStyles = new StyleModule({
  [`.${globalVarCssClassName}`]: {
    fontWeight: 700,
  },
  [`.${iRateVarCssClassName}`]: {
    color: '#29A8FF',
  },
  [`.${opcodeCssClassName}`]: {
    color: '#005cc5',
  },
  [`.${globalConstantCssClassName}`]: {
    color: '#22863a',
  },
  [`.${aRateVarCssClassName}`]: {
    color: '#6237FF',
  },
  [`.${kRateVarCssClassName}`]: {
    color: '#CF63F8',
  },
  [`.${sRateVarCssClassName}`]: {
    color: '#a11',
  },
  [`.${fRateVarCssClassName}`]: {
    color: '#004761',
  },
  [`.${pFieldVarCssClassName}`]: {
    color: '#FF9D0C',
    fontWeight: 600,
  },
  [`.${xmlTagCssClassName}`]: {
    color: '#22863a',
  },
  [`.${gotoTokenDecoration}`]: {
    color: '#59648B',
    fontWeight: 600,
  },
});

StyleModule.mount(document, defaultCsoundThemeStyles);

const defaultCsoundLightThemeTagStyles = HighlightStyle.define([
  { tag: opcodeTag, color: '#005cc5', class: `.${opcodeCssClassName}` },
  { tag: defineOperatorTag, color: '#6f42c1' },
  { tag: bracketTag, color: '#22863a' },
  { tag: controlFlowTag, color: '#22863a' },
  { tag: xmlTag, color: '#22863a', class: xmlTagCssClassName },
  { tag: t.comment, color: 'gray' },
  { tag: t.string, color: '#a11' },
]);

const defaultCsoundLightTheme = syntaxHighlighting(
  defaultCsoundLightThemeTagStyles,
  // { fallback: true },
);

console.log({
  defaultCsoundThemeStyles,
  defaultCsoundLightThemeTagStyles,
  main: defaultCsoundThemeStyles.getRules(),
});

const csoundModePlugin: Extension = ViewPlugin.fromClass(
  class {
    // public decorations: RangeSet<any> | undefined;
    public view: EditorView;
    constructor(view: EditorView) {
      this.view = view;
      // console.log(view);
      // this.decorations = () => variableHighlighter(view);
      // this.decorations = variableHighlighter(view);
    }
    get decorations() {
      return variableHighlighter(this.view);
    }
    // update(update: ViewUpdate) {
    //   if (update.docChanged || update.viewportChanged) {
    //     this.decorations = variableHighlighter(update.view);
    //     console.log(this.decorations);
    //   }
    // }
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

const findOperatorName = (view: EditorView, tree: SyntaxNode) => {
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
      // unmount();
    },
    update(update) {
      // if (update.heightChanged || update.selectionSet) {
      //   const isEmptyLine =
      //     view.lineBlockAt(view.state.selection.main.to).length < 2;
      //   if (isEmptyLine) {
      //     renderSynopsis({ root, synopsis: '' });
      //     return;
      //   }
      //   const treeRoot = syntaxTree(view.state).cursorAt(
      //     view.state.selection.main.head,
      //   );
      //   const { token: operatorName } = findOperatorName(view, treeRoot);
      //   const synopsis =
      //     operatorName &&
      //     window.csoundSynopsis.find((value) => value.opname === operatorName);
      //   const hasSynopsis =
      //     Boolean(synopsis) &&
      //     Array.isArray(synopsis.synopsis) &&
      //     synopsis.synopsis.length > 0;
      //   if (hasSynopsis) {
      //     renderSynopsis({ root, synopsis: synopsis.synopsis[0] });
      //   } else {
      //     renderSynopsis({ root, synopsis: '' });
      //   }
      // }
    },
  };
};

const csoundInfo = () => {
  return showPanel.of(csoundInfoPanel);
};

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
        InstrumentDeclaration: foldInside,
        UdoDeclaration: foldInside,
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
