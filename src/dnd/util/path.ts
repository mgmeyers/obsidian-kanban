import { Path } from '../types';

export function isNextSibling(source: Path, sib: Path): boolean {
  if (source.length !== sib.length) {
    return false;
  }

  return source.every((step, i, arr) => {
    if (i === arr.length - 1) {
      return step === sib[i] - 1;
    }

    return step === sib[i];
  });
}

export function areSiblings(source: Path, sib: Path): boolean {
  if (source.length !== sib.length) {
    return false;
  }

  return source.every((step, i, arr) => {
    if (i === arr.length - 1) {
      return step !== sib[i];
    }

    return step === sib[i];
  });
}

export function isSamePath(source: Path, sib: Path): boolean {
  return source.length === sib.length && source.every((step, i) => step === sib[i]);
}

export enum SiblingDirection {
  Before,
  After,
  Self,
  NotSiblings,
}

export function getSiblingDirection(source: Path, sib: Path): SiblingDirection {
  if (isSamePath(source, sib)) {
    return SiblingDirection.Self;
  }

  if (!areSiblings(source, sib)) {
    return SiblingDirection.NotSiblings;
  }

  const lastIndex = source.length - 1;

  if (source[lastIndex] < sib[lastIndex]) {
    return SiblingDirection.After;
  }

  return SiblingDirection.Before;
}
