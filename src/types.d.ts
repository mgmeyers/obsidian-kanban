/**
 * ============================================================================
 * [실행 순서 #3] src/types.d.ts — Preact를 React처럼 사용하기 위한 전역 타입 보강 선언
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화
 * 이 파일은 `.d.ts`(타입 선언 전용 파일)로, 런타임에 실행되는 JS 코드를 전혀
 * 생성하지 않는다. 대신 TypeScript 컴파일러에게 "이런 전역 타입/전역 함수가
 * 존재한다"고 알려주는 역할만 한다. 파일 안에 최상위 import/export 문이 없기
 * 때문에 TypeScript가 이 파일을 모듈이 아닌 "전역 스크립트"로 취급하며, 여기서
 * declare(선언)한 것들(Fragment, h, 그리고 HTMLAttributes/Booleanish/
 * AriaAttributes 같은 타입들)은 프로젝트의 다른 모든 .ts/.tsx 파일에서 별도의
 * import 없이 곧바로 사용할 수 있게 된다. 즉 어떤 특정 파일이 이 파일을
 * import하는 것이 아니라, tsconfig에 포함되는 것만으로 프로젝트 전체 타입체크에
 * 암묵적으로 관여한다.
 *
 * 이 플러그인은 React 대신 더 가벼운 Preact를 사용하면서도, JSX 코드와 각종
 * 라이브러리 타입은 React의 관례(HTMLAttributes, ARIA 속성 등)를 그대로
 * 따르고 싶어한다. 그래서 아래 `declare function h(...)` 오버로드 2개는 JSX가
 * 컴파일될 때 호출되는 Preact의 `h(type, props, ...children)` "hyperscript"
 * 팩토리 함수(엘리먼트를 실제로 생성하는 함수, React의 `createElement`에 대응)에
 * 대해, 태그 이름 문자열로 호출하는 경우와 컴포넌트 함수/클래스로 호출하는 경우
 * 두 가지 타입 시그니처를 각각 정의해 IDE의 타입 추론과 자동완성이 정확히
 * 동작하도록 돕는다. `declare const Fragment`는 `<>...</>` 문법(여러 자식을
 * 감싸는 실체 없는 래퍼)이 참조하는 Preact의 Fragment 컴포넌트를 전역 타입으로
 * 알려주는 선언이다.
 *
 * `Booleanish` 타입은 `boolean | 'true' | 'false'`의 별칭으로, HTML의 ARIA
 * 속성들이 실제 DOM에서는 문자열 `"true"`/`"false"`로 표현되지만 JSX 코드를
 * 작성할 때는 boolean 리터럴(`true`/`false`)로도 자연스럽게 쓸 수 있도록
 * 허용 범위를 넓혀주는 타입이다. 아래 `AriaAttributes` 인터페이스는 HTML의
 * 모든 `aria-*` 속성(스크린 리더 등 접근성 보조기술이 참조하는 속성들)을
 * 타입으로 정의해 두어, JSX에서 `<div aria-hidden={true} .../>`처럼 쓸 때
 * 자동완성과 타입 검사가 되게 해준다. 이 인터페이스의 각 속성에는 이미 원본
 * JSDoc 주석이 달려 있으므로 이번 작업에서는 그대로 두었고, 개별 속성 줄에는
 * 추가로 주석을 달지 않았다. `HTMLAttributes<T>`는 Preact 자체의
 * HTMLAttributes 타입에 위 AriaAttributes를 합쳐(intersection, `&`) 만든
 * 타입으로, 모든 HTML 태그의 표준 속성 + ARIA 속성을 한 번에 다루기 위한
 * 편의 타입이다.
 * ============================================================================
 */
type HTMLAttributes<T extends EventTarget> = import('preact/compat').HTMLAttributes<T> &
  AriaAttributes;

declare const Fragment: import('preact').FunctionComponent<Record<string, never>>;

declare function h(
  type: string,
  props:
    | (import('preact/src/jsx').JSXInternal.HTMLAttributes &
        import('preact/src/jsx').JSXInternal.SVGAttributes &
        Record<string, any>)
    | null,
  ...children: import('preact').ComponentChildren[]
): import('preact').VNode<any>;
declare function h<P>(
  type: import('preact').ComponentType<P>,
  props: (import('preact').Attributes & P) | null,
  ...children: import('preact').ComponentChildren[]
): import('preact').VNode<any>;

type Booleanish = boolean | 'true' | 'false';

interface AriaAttributes {
  /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
  'aria-activedescendant'?: string | undefined;
  /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
  'aria-atomic'?: Booleanish | undefined;
  /**
   * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
   * presented if they are made.
   */
  'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both' | undefined;
  /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
  'aria-busy'?: Booleanish | undefined;
  /**
   * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
   * @see aria-pressed @see aria-selected.
   */
  'aria-checked'?: boolean | 'false' | 'mixed' | 'true' | undefined;
  /**
   * Defines the total number of columns in a table, grid, or treegrid.
   * @see aria-colindex.
   */
  'aria-colcount'?: number | undefined;
  /**
   * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
   * @see aria-colcount @see aria-colspan.
   */
  'aria-colindex'?: number | undefined;
  /**
   * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-colindex @see aria-rowspan.
   */
  'aria-colspan'?: number | undefined;
  /**
   * Identifies the element (or elements) whose contents or presence are controlled by the current element.
   * @see aria-owns.
   */
  'aria-controls'?: string | undefined;
  /** Indicates the element that represents the current item within a container or set of related elements. */
  'aria-current'?:
    | boolean
    | 'false'
    | 'true'
    | 'page'
    | 'step'
    | 'location'
    | 'date'
    | 'time'
    | undefined;
  /**
   * Identifies the element (or elements) that describes the object.
   * @see aria-labelledby
   */
  'aria-describedby'?: string | undefined;
  /**
   * Identifies the element that provides a detailed, extended description for the object.
   * @see aria-describedby.
   */
  'aria-details'?: string | undefined;
  /**
   * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
   * @see aria-hidden @see aria-readonly.
   */
  'aria-disabled'?: Booleanish | undefined;
  /**
   * Indicates what functions can be performed when a dragged object is released on the drop target.
   * @deprecated in ARIA 1.1
   */
  'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup' | undefined;
  /**
   * Identifies the element that provides an error message for the object.
   * @see aria-invalid @see aria-describedby.
   */
  'aria-errormessage'?: string | undefined;
  /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
  'aria-expanded'?: Booleanish | undefined;
  /**
   * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
   * allows assistive technology to override the general default of reading in document source order.
   */
  'aria-flowto'?: string | undefined;
  /**
   * Indicates an element's "grabbed" state in a drag-and-drop operation.
   * @deprecated in ARIA 1.1
   */
  'aria-grabbed'?: Booleanish | undefined;
  /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
  'aria-haspopup'?:
    | boolean
    | 'false'
    | 'true'
    | 'menu'
    | 'listbox'
    | 'tree'
    | 'grid'
    | 'dialog'
    | undefined;
  /**
   * Indicates whether the element is exposed to an accessibility API.
   * @see aria-disabled.
   */
  'aria-hidden'?: Booleanish | undefined;
  /**
   * Indicates the entered value does not conform to the format expected by the application.
   * @see aria-errormessage.
   */
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling' | undefined;
  /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
  'aria-keyshortcuts'?: string | undefined;
  /**
   * Defines a string value that labels the current element.
   * @see aria-labelledby.
   */
  'aria-label'?: string | undefined;
  /**
   * Identifies the element (or elements) that labels the current element.
   * @see aria-describedby.
   */
  'aria-labelledby'?: string | undefined;
  /** Defines the hierarchical level of an element within a structure. */
  'aria-level'?: number | undefined;
  /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
  'aria-live'?: 'off' | 'assertive' | 'polite' | undefined;
  /** Indicates whether an element is modal when displayed. */
  'aria-modal'?: Booleanish | undefined;
  /** Indicates whether a text box accepts multiple lines of input or only a single line. */
  'aria-multiline'?: Booleanish | undefined;
  /** Indicates that the user may select more than one item from the current selectable descendants. */
  'aria-multiselectable'?: Booleanish | undefined;
  /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
  'aria-orientation'?: 'horizontal' | 'vertical' | undefined;
  /**
   * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
   * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
   * @see aria-controls.
   */
  'aria-owns'?: string | undefined;
  /**
   * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
   * A hint could be a sample value or a brief description of the expected format.
   */
  'aria-placeholder'?: string | undefined;
  /**
   * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-setsize.
   */
  'aria-posinset'?: number | undefined;
  /**
   * Indicates the current "pressed" state of toggle buttons.
   * @see aria-checked @see aria-selected.
   */
  'aria-pressed'?: boolean | 'false' | 'mixed' | 'true' | undefined;
  /**
   * Indicates that the element is not editable, but is otherwise operable.
   * @see aria-disabled.
   */
  'aria-readonly'?: Booleanish | undefined;
  /**
   * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
   * @see aria-atomic.
   */
  'aria-relevant'?:
    | 'additions'
    | 'additions removals'
    | 'additions text'
    | 'all'
    | 'removals'
    | 'removals additions'
    | 'removals text'
    | 'text'
    | 'text additions'
    | 'text removals'
    | undefined;
  /** Indicates that user input is required on the element before a form may be submitted. */
  'aria-required'?: Booleanish | undefined;
  /** Defines a human-readable, author-localized description for the role of an element. */
  'aria-roledescription'?: string | undefined;
  /**
   * Defines the total number of rows in a table, grid, or treegrid.
   * @see aria-rowindex.
   */
  'aria-rowcount'?: number | undefined;
  /**
   * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
   * @see aria-rowcount @see aria-rowspan.
   */
  'aria-rowindex'?: number | undefined;
  /**
   * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-rowindex @see aria-colspan.
   */
  'aria-rowspan'?: number | undefined;
  /**
   * Indicates the current "selected" state of various widgets.
   * @see aria-checked @see aria-pressed.
   */
  'aria-selected'?: Booleanish | undefined;
  /**
   * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-posinset.
   */
  'aria-setsize'?: number | undefined;
  /** Indicates if items in a table or grid are sorted in ascending or descending order. */
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | undefined;
  /** Defines the maximum allowed value for a range widget. */
  'aria-valuemax'?: number | undefined;
  /** Defines the minimum allowed value for a range widget. */
  'aria-valuemin'?: number | undefined;
  /**
   * Defines the current value for a range widget.
   * @see aria-valuetext.
   */
  'aria-valuenow'?: number | undefined;
  /** Defines the human readable text alternative of aria-valuenow for a range widget. */
  'aria-valuetext'?: string | undefined;
}
