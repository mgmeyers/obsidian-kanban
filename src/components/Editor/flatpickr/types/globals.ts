import { Options } from './options';
import { Instance, FlatpickrFn } from './instance';

export interface FPHTMLElement extends HTMLElement {
  flatpickr: (config?: Options) => Instance;
  _flatpickr?: Instance;
}

export interface FPNodeList extends NodeList {
  flatpickr: (config?: Options) => Instance | Instance[];
}

export interface FPHTMLCollection extends HTMLCollection {
  flatpickr: (config?: Options) => Instance | Instance[];
}

export interface FPWindow extends Window {
  flatpickr: FlatpickrFn;
}

export interface FPDate extends Date {
  fp_incr: (n: number) => Date;
}
