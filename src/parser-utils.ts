import { EditorView } from '@codemirror/view';
import { SyntaxNode } from '@lezer/common';

const CHANGEME: any[] = [];

function tokenExists(opname: string) {
  return CHANGEME.some((value) => value.opname === opname);
}

function resolveOpcodeStatement(view: EditorView, node: SyntaxNode) {
  let operator;
  let currentNode = node.firstChild;
  const inputArgs = [];
  const outputArgs = [];

  if (node && node.prevSibling && node.prevSibling.type.name === 'AssignOp') {
    let leftSideNode = node.parent?.node.firstChild ?? null;

    while (leftSideNode && leftSideNode.type.name !== 'AssignOp') {
      const tokenSlice = view.state.sliceDoc(
        leftSideNode.from,
        leftSideNode.to,
      );

      inputArgs.push(tokenSlice);
      leftSideNode = leftSideNode.nextSibling;
    }
  }

  while (currentNode) {
    const currentNodeType = currentNode.type.name;
    const tokenSlice = view.state.sliceDoc(currentNode.from, currentNode.to);

    if (!operator) {
      if (tokenExists(tokenSlice)) {
        operator = tokenSlice;
      } else {
        inputArgs.push(tokenSlice);
      }
    } else {
      if (currentNodeType !== 'LineComment') {
        outputArgs.push(tokenSlice);
      }
    }
    // console.log({ currentNodeType, currentNode, tokenSlice, view });

    currentNode = currentNode.nextSibling;

    if (
      currentNode &&
      currentNode.type &&
      currentNode.type.name &&
      currentNode.type.name === 'ArgList'
    ) {
      currentNode = currentNode.firstChild;
    }
  }

  return { inputArgs, outputArgs, operator };
}

export function resolveExpressionFromNode(view: EditorView, node: SyntaxNode) {
  const nodeType = node.type.name;

  switch (nodeType) {
    case 'CallbackExpression': {
      return {
        ...resolveOpcodeStatement(view, node),
        statementType: 'CallbackExpression',
      };
    }
    case 'OpcodeStatement': {
      return {
        ...resolveOpcodeStatement(view, node),
        statementType: 'OpcodeStatement',
      };
    }
    default: {
      return undefined;
    }
  }
}
