/**
 * ============================================================================
 * [실행 순서 #61] src/helpers/renderMarkdown.ts — 위키링크 경로 정규화(getNormalizedPath), 마크다운 렌더러에
 * 클릭/호버 이벤트 바인딩(bindMarkdownEvents)
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 카드 본문은 Obsidian 기본 마크다운 렌더러로 HTML로 변환되지만, 그 결과로 생긴 <a> 태그들은
 * Obsidian 에디터/프리뷰 뷰가 원래 제공하는 클릭(내부 링크 이동)·호버(페이지 미리보기)·우클릭(컨텍스트 메뉴)
 * 동작을 자동으로 갖고 있지 않다. 이 파일은 칸반 뷰의 contentEl 전체에 이벤트 위임(delegation) 방식으로
 * 리스너를 한 번만 등록해, 렌더링될 때마다 새로 생기는 링크/태그 요소들에도 그 동작을 재현해 붙여준다
 * (bindMarkdownEvents). getNormalizedPath는 "root#subpath|alias" 형태의 위키링크 원문 문자열을
 * root/subpath/alias 세 부분으로 쪼개는 파서이고, applyCheckboxIndexes는 렌더링된 체크박스들에 순번을
 * 매겨 이후 클릭 이벤트가 "몇 번째 체크박스였는지"를 알 수 있게 해준다.
 * ============================================================================
 */
import { Keymap, Menu } from 'obsidian';
import { KanbanView } from 'src/KanbanView';

// 유니코드 줄바꿈 없는 공백(U+00A0). Obsidian 자동완성 등으로 링크 문자열에 섞여 들어오면
// 일반 공백(U+0020)과 다르게 취급되어 파싱이 어긋날 수 있어 미리 치환해 정규화한다.
const noBreakSpace = /\u00A0/g;

interface NormalizedPath {
  root: string;
  subpath: string;
  alias: string;
}

// "root#subpath##subsubpath|alias" 형태의 위키링크 원문을 파싱해 root/subpath/alias로 분리한다.
// 정규식의 그룹 안에 있는 `(.*)`는 탐욕적(greedy)이므로 split은 "첫 번째로 등장하는 구분자"에서만
// 한 번 나뉜다(뒤에 같은 구분자가 더 있어도 subpath/alias 쪽에 통째로 남는다).
export function getNormalizedPath(path: string): NormalizedPath {
  // 줄바꿈 없는 공백 → 일반 공백으로 치환 + 유니코드 정규화(NFC, 결합 문자 형태 통일)
  const stripped = path.replace(noBreakSpace, ' ').normalize('NFC');

  // split on first occurance of '|'
  // "root#subpath##subsubpath|alias with |# chars"
  //             0            ^        1
  // '|' 문자가 처음 나오는 지점에서만 잘라 [본문, 별칭] 두 부분으로 나눈다(별칭 안에 '|'가 더 있어도 안전)
  const splitOnAlias = stripped.split(/\|(.*)/);

  // split on first occurance of '#' (in substring)
  // "root#subpath##subsubpath"
  //   0  ^        1
  // 별칭을 뗀 나머지에서 이번엔 '#'이 처음 나오는 지점 기준으로 [파일 경로, 서브패스] 두 부분으로 나눈다
  const splitOnHash = splitOnAlias[0].split(/#(.*)/);

  return {
    root: splitOnHash[0],
    // 서브패스가 있으면 원래 형태를 보존하기 위해 '#'을 다시 붙여서 반환
    subpath: splitOnHash[1] ? '#' + splitOnHash[1] : '',
    alias: splitOnAlias[1] || '',
  };
}

// 렌더링된 마크다운 안의 체크박스(task-list-item)들을 순서대로 훑으며 각 요소의 dataset에
// 0부터 시작하는 인덱스를 심어둔다. 이후 사용자가 체크박스를 클릭했을 때, 이 인덱스로 원본 마크다운
// 텍스트에서 몇 번째 체크박스([ ] / [x])를 토글해야 하는지 역으로 찾아낼 수 있다.
export function applyCheckboxIndexes(dom: HTMLElement) {
  const checkboxes = dom.querySelectorAll('.task-list-item-checkbox');

  checkboxes.forEach((el, i) => {
    (el as HTMLElement).dataset.checkboxIndex = i.toString();
  });
}

// 칸반 뷰의 contentEl 최상위에 이벤트 위임 리스너들을 등록한다. Obsidian의 Component#on(evt, selector, cb)은
// contentEl 하위 어디에서든 나중에 새로 렌더링되는 요소라도, selector(CSS 셀렉터)에 매칭되기만 하면
// 자동으로 콜백이 호출되는 위임 패턴이다. 카드가 다시 렌더링될 때마다 매번 리스너를 새로 붙일 필요가 없다.
export function bindMarkdownEvents(view: KanbanView) {
  const { contentEl, app } = view;

  // 링크 엘리먼트에서 실제 이동할 대상(href, data-href 둘 중 있는 것)과 화면에 보이는 텍스트를 추출
  const parseLink = (el: HTMLElement) => {
    const href = el.getAttr('data-href') || el.getAttr('href');
    if (!href) return null;

    return {
      href,
      displayText: el.getText().trim(),
    };
  };

  // 내부 링크(위키링크) 클릭/보조클릭(휠클릭) 공용 핸들러
  const onLinkClick = (evt: MouseEvent, targetEl: HTMLElement) => {
    // 왼쪽 클릭(0) 또는 휠/중간 클릭(1)만 처리, 우클릭 등은 무시
    if (evt.button !== 0 && evt.button !== 1) return;

    const link = parseLink(targetEl);
    if (!link) return;

    // 브라우저의 기본 앵커 이동을 막고, Obsidian 자체 네비게이션 API로 링크를 연다
    evt.preventDefault();
    // Keymap.isModEvent(evt): Ctrl/Cmd(+Shift) 등 보조키 조합에 따라 새 탭/새 창/분할 등 열기 방식을 결정해 전달
    app.workspace.openLinkText(link.href, view.file.path, Keymap.isModEvent(evt));
  };

  contentEl.on('click', 'a.internal-link', onLinkClick);
  contentEl.on('auxclick', 'a.internal-link', onLinkClick);
  // 내부 링크를 드래그할 때 브라우저 기본 드래그(링크를 텍스트로 끄는 동작)를 막아 UX를 정리
  contentEl.on('dragstart', 'a.internal-link', (evt: DragEvent) => {
    evt.preventDefault();
  });
  // 내부 링크 우클릭 → Obsidian 표준 링크 컨텍스트 메뉴(이름 바꾸기, 다른 창에서 열기 등)를 그대로 재현
  contentEl.on('contextmenu', 'a.internal-link', (evt: PointerEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;

    const menu = new Menu();
    // addSections/handleLinkContextMenu는 공식 타입 선언에 없는 내부 API라 any로 캐스팅해서 호출
    (menu as any).addSections(['title', 'open', 'action', 'view', 'info', '', 'danger']);
    (app.workspace as any).handleLinkContextMenu(menu, link.href, view.file.path);
    menu.showAtMouseEvent(evt);
  });
  // 내부 링크 위에 마우스를 올리면 Obsidian 코어의 "페이지 미리보기(hover-link)" 기능이 동작하도록
  // 워크스페이스 이벤트를 직접 발생시켜준다(원래 에디터/프리뷰 뷰가 자동으로 하는 일을 여기서 수동으로 재현)
  contentEl.on('mouseover', 'a.internal-link', (evt: MouseEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;
    app.workspace.trigger('hover-link', {
      event: evt,
      source: 'preview',
      hoverParent: view,
      targetEl,
      linktext: link.href,
      sourcePath: view.file.path,
    });
  });
  // 외부 링크(http/https 등) 클릭 → 유효한 URL인지 검증 후 새 창/탭으로 열기
  contentEl.on('click', 'a.external-link', (evt: MouseEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;

    evt.preventDefault();

    // 공백이 섞인 값은 URL이 아닐 가능성이 높으므로 먼저 걸러냄
    if (!link.href || link.href.contains(' ')) return;
    try {
      // 실제로 파싱 가능한 URL인지 검증(실패하면 catch에서 조용히 종료)
      new URL(link.href);
    } catch (e) {
      return;
    }

    // 보조키 조합에 따라 새 탭에서 열지 등을 결정(문자열이면 탭 종류, boolean이면 기본 동작)
    const paneType = Keymap.isModEvent(evt);
    const clickTarget = typeof paneType === 'boolean' ? '' : paneType;
    window.open(link.href, clickTarget);
  });
  // 외부 링크 우클릭 → Obsidian 표준 외부 링크 컨텍스트 메뉴(복사, 브라우저에서 열기 등) 재현
  contentEl.on('contextmenu', 'a.external-link', (evt: PointerEvent, targetEl: HTMLElement) => {
    const link = parseLink(targetEl);
    if (!link) return;

    const menu = new Menu();
    (menu as any).addSections([
      'title',
      'open',
      'selection',
      'clipboard',
      'action',
      'view',
      'info',
      '',
      'danger',
    ]);
    (app.workspace as any).handleExternalLinkContextMenu(menu, link.href);
    menu.showAtMouseEvent(evt);
  });
  // 태그(#tag) 클릭 처리: 플러그인 설정(tag-action)에 따라 동작이 갈린다
  contentEl.on('click', 'a.tag', (evt: MouseEvent, targetEl: HTMLElement) => {
    if (evt.button !== 0) return;

    const tag = targetEl.getText();
    const searchPlugin = (app as any).internalPlugins.getPluginById('global-search');
    const stateManager = view.plugin.getStateManager(view.file);
    const tagAction = stateManager.getSetting('tag-action');

    if (tagAction === 'kanban') {
      // 칸반 보드 자체 검색을 열도록 뷰의 이벤트 버스(emitter)에 'hotkey' 이벤트를 발행
      view.emitter.emit('hotkey', { commandId: 'editor:open-search', data: tag });
    } else if (searchPlugin) {
      // 그렇지 않고 코어 전역 검색 플러그인이 활성화되어 있으면 해당 태그로 전역 검색을 실행
      searchPlugin.instance.openGlobalSearch(`tag:${tag}`);
    }
  });
}
