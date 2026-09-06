/**
 * ============================================================================
 * [실행 순서 #79] src/components/MarkdownRenderer/MarkdownRenderer.tsx — 카드 본문 마크다운 렌더러
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 칸반 카드/리스트 제목 등에 들어있는 마크다운 문자열을, Obsidian이 노트를 볼 때 쓰는
 * 것과 동일한 표준 렌더링 엔진(obsidian 패키지의 MarkdownRenderer.render)으로 그려주는
 * 모듈입니다. 핵심은 Obsidian의 Component 생명주기를 그대로 활용하는 클래스
 * BasicMarkdownRenderer이며, 이 인스턴스는 KanbanView.tsx의 prerender()가 미리 만들어
 * view.previewCache에 캐싱해 둡니다 — 그래야 카드가 화면에 처음 나타날 때마다 매번
 * Obsidian 렌더러를 새로 돌리지 않고 이미 렌더링된 DOM을 재사용(migrate)할 수 있습니다.
 * 이 파일은 그 클래스를 Preact 컴포넌트(MarkdownRenderer)로 감싸 렌더링 사이클(마운트/
 * 언마운트/가상화에 따른 표시-숨김/검색어 하이라이트)과 연결하는 역할도 함께 합니다.
 * ============================================================================
 */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import classcat from 'classcat';
import Mark from 'mark.js'; // 검색어를 DOM 텍스트 안에서 찾아 <mark> 태그로 하이라이트해주는 라이브러리
import moment from 'moment';
import { Component, MarkdownRenderer as ObsidianRenderer, getLinkpath } from 'obsidian';
import { CSSProperties, memo, useEffect, useRef } from 'preact/compat';
import { useContext } from 'preact/hooks';
import { KanbanView } from 'src/KanbanView';
import { DndManagerContext, EntityManagerContext } from 'src/dnd/components/context';
import { PromiseCapability } from 'src/helpers/util';

import { applyCheckboxIndexes } from '../../helpers/renderMarkdown';
import { IntersectionObserverContext, KanbanContext, SortContext } from '../context';
import { c, useGetDateColorFn, useGetTagColorFn } from '../helpers';
import { DateColor, TagColor } from '../types';

interface MarkdownRendererProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  markdownString: string;
  searchQuery?: string;
  entityId?: string; // 이 마크다운을 표시하는 "개체(카드/리스트 등)"의 고유 id — 프리뷰 캐시의 키로 사용
}

// 렌더링이 끝난 DOM(wrapperEl) 안에서 Obsidian이 만든 태그 링크(a.tag)들을 찾아
// 보드 설정에 정의된 태그별 색상(TagColor)을 CSS 커스텀 프로퍼티로 적용한다.
function colorizeTags(wrapperEl: HTMLElement, getTagColor: (tag: string) => TagColor) {
  if (!wrapperEl) return;
  const tagEls = wrapperEl.querySelectorAll<HTMLAnchorElement>('a.tag');
  if (!tagEls?.length) return;

  tagEls.forEach((a) => {
    const color = getTagColor(a.getAttr('href'));
    if (!color) return;
    // CSS 변수로 지정해두면 스타일시트에서 var(--tag-color) 등으로 참조해 실제 색을 적용한다
    a.setCssProps({
      '--tag-color': color.color,
      '--tag-background': color.backgroundColor,
    });
  });
}

// 위와 같은 방식으로, 렌더링된 날짜 요소들(class="...date...")에 대해 날짜별 색상 규칙을 적용한다.
function colorizeDates(wrapperEl: HTMLElement, getDateColor: (date: moment.Moment) => DateColor) {
  if (!wrapperEl) return;
  const dateEls = wrapperEl.querySelectorAll<HTMLElement>('.' + c('date'));
  if (!dateEls?.length) return;
  dateEls.forEach((el) => {
    const dateStr = el.dataset.date;
    if (!dateStr) return;
    const parsed = moment(dateStr);
    if (!parsed.isValid()) return;
    const color = getDateColor(parsed);
    // 배경색이 지정된 경우에만 'has-background' 클래스를 토글해 배경 스타일이 켜지도록 함
    el.toggleClass('has-background', !!color?.backgroundColor);
    if (!color) return;
    el.setCssProps({
      '--date-color': color.color,
      '--date-background-color': color.backgroundColor,
    });
  });
}

// Obsidian의 Component를 상속받는 클래스. Component는 Obsidian 플러그인 전반에서 쓰이는
// "생명주기가 있는 객체" 베이스 클래스로, onload()/onunload(), addChild() 등을 통해
// 부모-자식 관계로 정리(cleanup)를 자동화해준다. 여기서는 이 클래스 자체가
// "카드 하나의 마크다운을 렌더링한 결과물(DOM + 상태)"을 캡슐화하는 역할을 한다.
// KanbanView.prerender()가 이 클래스의 인스턴스를 미리 만들어 view.previewCache에 저장해두면,
// 실제 카드가 화면에 나타날 때 매번 새로 렌더링하지 않고 캐시된 인스턴스를 재사용할 수 있다.
export class BasicMarkdownRenderer extends Component {
  containerEl: HTMLElement; // Obsidian이 마크다운을 렌더링해 넣는 실제 DOM 컨테이너
  wrapperEl: HTMLElement; // Preact 쪽에서 이 컨테이너를 붙여넣을 부모 엘리먼트(카드/셀의 래퍼)
  renderCapability: PromiseCapability; // "렌더링이 끝났다"를 외부에서 await할 수 있게 해주는 Promise 래퍼
  observer: ResizeObserver; // 렌더링된 콘텐츠의 크기 변화를 감지해 캐시 크기를 갱신하기 위함
  isVisible: boolean = false; // 현재 화면(가상화 뷰포트) 안에 실제로 보이고 있는지 여부
  mark: Mark; // 검색어 하이라이트용 mark.js 인스턴스 (containerEl 범위에 바인딩됨)

  // ResizeObserver가 보고해준 마지막 콘텐츠 크기값들 — 재표시(show) 시 레이아웃 점프를 막기 위해 사용
  lastWidth = -1;
  lastHeight = -1;
  lastRefWidth = -1;
  lastRefHeight = -1;

  constructor(
    public view: KanbanView, // 이 렌더러가 속한 칸반 뷰 (app, file 등 Obsidian 컨텍스트 접근용)
    public markdown: string // 렌더링할 원본 마크다운 문자열
  ) {
    super();
    // Obsidian이 실제 노트 미리보기에 쓰는 것과 동일한 클래스명을 부여해 테마/스타일이 일관되게 적용되게 함
    this.containerEl = createDiv(
      'markdown-preview-view markdown-rendered ' + c('markdown-preview-view')
    );
    this.mark = new Mark(this.containerEl);
    // 아직 아무도 resolve하지 않은 새 Promise 캡슐 생성 — render()가 끝나면 resolve된다
    this.renderCapability = new PromiseCapability<void>();
  }

  // Obsidian Component 생명주기 훅: load() 호출 시 자동 실행된다 (addChild()가 트리거)
  onload() {
    this.render();
  }

  // eslint-disable-next-line react/require-render-return
  // 실제 마크다운 -> HTML 렌더링을 수행하는 비동기 메서드.
  async render() {
    this.containerEl.empty(); // 이전 렌더링 결과를 지우고 새로 그림 (재렌더링 시 중복 방지)

    // Obsidian 표준 API: MarkdownRenderer.render(app, markdown, containerEl, sourcePath, component)
    // - app: Obsidian 앱 인스턴스, sourcePath: 상대 링크 해석 기준이 되는 현재 파일 경로,
    // - component: 렌더링 중 생성되는 자식 컴포넌트(임베드 등)의 생명주기를 이 인스턴스에 귀속시킴
    // 즉 Obsidian의 실제 노트 렌더링과 동일한 엔진(콜아웃, 임베드, 위키링크 등 모두 지원)을 그대로 사용한다.
    await ObsidianRenderer.render(
      this.view.app,
      this.markdown,
      this.containerEl,
      this.view.file.path,
      this
    );

    // 렌더링이 끝났음을 알림 — 이 Promise를 기다리던 코드(예: 검색어 재적용 로직)가 재개된다
    this.renderCapability.resolve();
    // 렌더링 도중 이 컴포넌트나 뷰가 이미 언로드되었다면(예: 뷰가 닫힘) 후속 작업을 하지 않고 종료
    if (!(this.view as any)?._loaded || !(this as any)._loaded) return;

    const { containerEl } = this;

    this.resolveLinks(); // 내부 링크가 실제 존재하는 파일을 가리키는지 확인해 스타일 반영
    applyCheckboxIndexes(containerEl); // 체크박스 목록 항목에 순번 등 인덱스 정보를 부여

    // 렌더링된 콘텐츠의 크기가 바뀔 때마다(이미지 로드 완료 등) 마지막 크기를 기록해둔다.
    // 이 값은 카드가 화면 밖으로 나갔다 다시 들어올 때(hide/show) placeholder 크기로 재사용된다.
    this.observer = new ResizeObserver((entries) => {
      if (!entries.length) return;

      const entry = entries.first().contentBoxSize[0];
      if (entry.blockSize === 0) return; // 아직 레이아웃이 안 잡힌(높이 0) 상태는 무시

      if (this.wrapperEl) {
        const rect = this.wrapperEl.getBoundingClientRect();
        // 높이가 처음 측정되거나(-1), 유효한 값(>0)일 때만 참조 크기를 갱신
        if (this.lastRefHeight === -1 || rect.height > 0) {
          this.lastRefHeight = rect.height;
          this.lastRefWidth = rect.width;
        }
      }

      this.lastWidth = entry.inlineSize;
      this.lastHeight = entry.blockSize;
    });

    // 다음 이벤트 루프 틱으로 미뤄서 관찰 시작 (초기 레이아웃이 안정된 뒤 관찰하도록)
    containerEl.win.setTimeout(() => {
      this.observer.observe(containerEl, { box: 'border-box' });
    });

    // 체크박스 클릭 시 Obsidian의 기본 동작(파일 내용을 직접 수정)이 아니라
    // 이 플러그인만의 체크박스 처리 로직으로 대체하기 위해 캡처 단계에서 기본 동작을 막는다.
    // (임베드된 마크다운 안의 체크박스는 제외 — 그건 별개 문서이므로 정상 동작하게 둠)
    containerEl.addEventListener(
      'click',
      (evt) => {
        const { targetNode } = evt;
        if (
          targetNode.instanceOf(HTMLElement) &&
          targetNode.hasClass('task-list-item-checkbox') &&
          !targetNode.closest('.markdown-embed')
        ) {
          evt.preventDefault();
          evt.stopPropagation();
        }
      },
      { capture: true }
    );

    // 체크박스에 대한 기본 컨텍스트 메뉴(우클릭)도 동일하게 막아, 플러그인의 자체 메뉴/동작과 충돌을 방지
    containerEl.addEventListener(
      'contextmenu',
      (evt) => {
        const { targetNode } = evt;
        if (targetNode.instanceOf(HTMLElement) && targetNode.hasClass('task-list-item-checkbox')) {
          evt.preventDefault();
          evt.stopPropagation();
        }
      },
      { capture: true }
    );
  }

  // 캐시된 렌더러의 DOM(containerEl)을 새로운 부모 엘리먼트(el)로 옮겨 붙인다.
  // 카드가 리스트 사이를 이동하거나, Preact가 다른 wrapper div를 새로 만들었을 때
  // (예: 리스트 재정렬로 컴포넌트가 언마운트/재마운트될 때) 이미 렌더링된 DOM을 재사용하기 위해 필요.
  migrate(el: HTMLElement) {
    const { lastRefHeight, lastRefWidth, containerEl } = this;
    this.wrapperEl = el;
    if (lastRefHeight > 0) {
      // 새 wrapper에 옮겨붙는 순간 크기가 0으로 깜빡이지 않도록, 마지막으로 알던 크기를 임시로 고정
      el.style.width = `${lastRefWidth}px`;
      el.style.height = `${lastRefHeight}px`;
      el.win.setTimeout(() => {
        // 실제 레이아웃이 자리잡을 시간을 준 뒤(50ms) 강제 크기 지정을 해제해 자연스러운 크기로 되돌림
        el.style.width = '';
        el.style.height = '';
      }, 50);
    }
    if (containerEl.parentElement !== el) {
      el.append(containerEl); // DOM 노드를 그대로 이동(재생성 아님) — 렌더링 비용 없이 재사용
    }

    this.mark.unmark(); // 이전 wrapper에서 남아있던 검색어 하이라이트를 제거
  }

  // 가상화(virtualization)에 의해 화면 안에 들어왔을 때: 감춰뒀던 containerEl을 다시 부착
  show() {
    const { wrapperEl, containerEl } = this;
    if (!wrapperEl) return;
    wrapperEl.append(containerEl);
    if (wrapperEl.style.minHeight) wrapperEl.style.minHeight = '';
    this.isVisible = true;
  }

  // 화면 밖으로 나갔을 때: 실제 DOM(containerEl)을 떼어내(detach) 브라우저 렌더링 비용을 줄이되,
  // wrapper의 최소 높이는 마지막으로 측정된 값으로 유지해 스크롤바 점프를 방지한다.
  hide() {
    const { containerEl, wrapperEl } = this;
    if (!wrapperEl) return;
    wrapperEl.style.minHeight = this.lastRefHeight + 'px';
    containerEl.detach();
    this.isVisible = false;
  }

  // 마크다운 내용이 바뀌었을 때 호출 — 완전히 새로 렌더링하기 위해 이 Component를
  // 한 번 unload() 했다가 다시 load()한다. Obsidian Component의 unload/load는
  // onunload/onload 훅을 통해 이전 렌더링 결과(및 그 안의 자식 컴포넌트)를 정리하고
  // onload()가 다시 render()를 호출하게 만든다.
  set(markdown: string) {
    if ((this as any)._loaded) {
      this.markdown = markdown;
      this.renderCapability = new PromiseCapability<void>(); // 새 렌더링 사이클을 위해 Promise 재생성
      this.unload();
      this.load();
    }
  }

  // 렌더링된 내부 링크(a.internal-link)들이 실제로 존재하는 노트를 가리키는지 검사해
  // 존재하지 않으면 'is-unresolved' 클래스를 붙인다(Obsidian에서 흔히 빨간/점선 스타일로 표시됨).
  resolveLinks() {
    const { containerEl, view } = this;
    const internalLinkEls = containerEl.findAll('a.internal-link');
    for (const internalLinkEl of internalLinkEls) {
      const href = this.getInternalLinkHref(internalLinkEl);
      if (!href) continue;

      const path = getLinkpath(href); // 링크 문자열에서 순수 경로 부분만 추출
      // metadataCache: Obsidian이 전체 볼트의 링크 그래프를 미리 인덱싱해둔 캐시.
      // 현재 파일 기준 상대 경로/별칭 등을 고려해 실제 대상 파일을 찾아준다.
      const file = view.app.metadataCache.getFirstLinkpathDest(path, view.file.path);
      internalLinkEl.toggleClass('is-unresolved', !file);
    }
  }

  getInternalLinkHref(el: HTMLElement) {
    const href = el.getAttr('data-href') || el.getAttr('href');
    if (!href) return null;
    return href;
  }
}

// BasicMarkdownRenderer(Obsidian Component, 명령형 DOM 조작)를 Preact 컴포넌트로 감싸는 어댑터.
// memo로 감싸 props가 얕은 비교로 동일하면 리렌더링을 건너뛴다.
// 이 컴포넌트는 "렌더링을 직접 하지 않고" BasicMarkdownRenderer 인스턴스의 생명주기를
// React/Preact의 마운트-업데이트-언마운트 사이클에 연결해주는 다리 역할만 한다.
export const MarkdownRenderer = memo(function MarkdownPreviewRenderer({
  entityId,
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownRendererProps) {
  const { view, stateManager } = useContext(KanbanContext);
  const entityManager = useContext(EntityManagerContext); // 드래그앤드롭 대상(카드/리스트)의 매니저
  const dndManager = useContext(DndManagerContext);
  const sortContext = useContext(SortContext); // 정렬 순서가 바뀌었는지 감지하기 위한 컨텍스트
  // Table.tsx가 제공하는 컨텍스트 — 있으면 "화면 교차 여부"로 가상화를 적용한다(표 보기 모드 전용)
  const intersectionContext = useContext(IntersectionObserverContext);
  const getTagColor = useGetTagColorFn(stateManager);
  const getDateColor = useGetDateColorFn(stateManager);

  const renderer = useRef<BasicMarkdownRenderer>(); // 현재 이 Preact 노드가 소유/재사용 중인 렌더러 인스턴스
  const elRef = useRef<HTMLDivElement>(); // 렌더러의 DOM을 붙일 래퍼 div

  // 이 개체(entity)가 관리형 엔티티(드래그 가능한 카드/리스트)이고, 정렬 순서(sortContext)가
  // 바뀌었다면, 가상 스크롤의 크기 측정 노드를 강제로 재관찰시켜 위치 정보를 갱신한다.
  useEffect(() => {
    if (!entityManager || !entityId || !renderer.current) return;

    const observer = entityManager?.scrollParent?.observer;
    if (!observer) return;

    observer.unobserve(entityManager.measureNode);
    observer.observe(entityManager.measureNode);
  }, [sortContext]);

  // intersectionContext가 있다면(예: 표 보기 모드) IntersectionObserver 기반으로
  // 화면에 보일 때만 show(), 안 보이면 hide()를 호출하도록 핸들러를 등록한다.
  useEffect(() => {
    if (!intersectionContext || !elRef.current) return;

    intersectionContext.registerHandler(elRef.current, (entry) => {
      if (entry.isIntersecting) renderer.current?.show();
      else renderer.current?.hide();
    });

    return () => {
      if (elRef.current) {
        intersectionContext?.unregisterHandler(elRef.current);
      }
    };
  }, []);

  // 칸반 보기(가상 스크롤)에서는 드래그앤드롭 엔티티 매니저가 "이 카드가 화면에 보이는지"를
  // 이벤트로 알려준다. 단, 지금 드래그 중인 카드(또는 그 부모 리스트) 자신은 무시해서
  // 드래그 중 깜빡이거나 사라지는 현상을 방지한다.
  useEffect(() => {
    const onVisibilityChange = (isVisible: boolean) => {
      const preview = renderer.current;
      if (!preview || !entityManager?.parent) return;

      const { dragManager } = dndManager;
      if (dragManager.dragEntityId === entityManager.entityId) return;
      if (dragManager.dragEntityId === entityManager.parent.entityId) return;

      if (preview.isVisible && !isVisible) {
        preview.hide();
      } else if (!preview.isVisible && isVisible) {
        preview.show();
      }
    };

    // 핵심 캐시 재사용 로직: 이 entityId에 대한 렌더러가 이미 KanbanView의 previewCache에
    // 있다면(즉 KanbanView.prerender()가 미리 만들어 두었거나, 이전 마운트에서 만든 것이라면)
    // 새로 만들지 않고 그 인스턴스를 재사용(migrate)한다 — 무거운 마크다운 파싱/렌더링을
    // 반복하지 않기 위한 핵심 최적화.
    if (entityId && view.previewCache.has(entityId)) {
      const preview = view.previewCache.get(entityId);

      renderer.current = preview;
      preview.migrate(elRef.current); // 캐시된 DOM을 이번에 마운트된 wrapper div로 옮겨붙임

      entityManager?.emitter.on('visibility-change', onVisibilityChange);
      return () => entityManager?.emitter.off('visibility-change', onVisibilityChange);
    }

    // 캐시에 없다면 새 BasicMarkdownRenderer를 만든다
    const markdownRenderer = new BasicMarkdownRenderer(view, markdownString);
    markdownRenderer.wrapperEl = elRef.current;

    // view.addChild(): Obsidian Component 계층에 자식으로 등록 — 이 시점에 onload()가 호출되어
    // 실제 render()가 시작되고, view가 언로드될 때 이 렌더러도 자동으로 함께 언로드(정리)된다.
    const preview = (renderer.current = view.addChild(markdownRenderer));
    if (entityId) view.previewCache.set(entityId, preview); // 다음 마운트를 위해 캐시에 등록

    elRef.current.empty();
    elRef.current.append(preview.containerEl);
    colorizeTags(elRef.current, getTagColor);
    colorizeDates(elRef.current, getDateColor);

    entityManager?.emitter.on('visibility-change', onVisibilityChange);

    return () => {
      // 언마운트 시: 아직 진행 중일 수 있는 렌더링 Promise를 강제로 resolve해
      // 그것을 기다리던 코드가 무한 대기하지 않도록 함(렌더러 자체는 캐시에 남아 계속 존재)
      renderer.current?.renderCapability.resolve();
      entityManager?.emitter.off('visibility-change', onVisibilityChange);
    };
  }, [view, entityId, entityManager]);

  // 상위에서 내려오는 markdownString이 바뀌면(카드 내용 수정 등) 렌더러에 새 내용을 반영.
  // 렌더링이 비동기이므로, 완료(renderCapability.promise)된 후에 태그/날짜 색상을 재적용한다.
  useEffect(() => {
    const preview = renderer.current;
    if (!preview || markdownString === preview.markdown) return;

    preview.renderCapability.resolve(); // 이전 렌더링을 기다리던 곳이 있다면 우선 풀어줌(중복 대기 방지)

    preview.set(markdownString);
    preview.renderCapability.promise.then(() => {
      colorizeTags(elRef.current, getTagColor);
      colorizeDates(elRef.current, getDateColor);
    });
  }, [markdownString]);

  // 태그/날짜 색상 규칙 자체가 바뀌면(설정 변경) 다시 색칠만 수행 (재렌더링은 하지 않음)
  useEffect(() => {
    if (!renderer.current) return;
    colorizeTags(elRef.current, getTagColor);
    colorizeDates(elRef.current, getDateColor);
  }, [getTagColor, getDateColor]);

  // 검색어가 바뀌면 mark.js로 이전 하이라이트를 지우고 새 검색어로 다시 하이라이트한다.
  useEffect(() => {
    const preview = renderer.current;
    if (!preview) return;
    preview.mark.unmark();
    if (searchQuery && searchQuery.trim()) {
      preview.mark.mark(searchQuery);
    }
  }, [searchQuery]);

  // 컴포넌트가 처음 마운트된 시점에 이미 renderer.current가 있는데(예: 부모가 먼저 세팅한 경우)
  // 그 wrapperEl이 지금의 elRef와 다르다면 DOM을 옮겨 붙여 동기화한다.
  useEffect(() => {
    const preview = renderer.current;
    if (elRef.current && preview && preview.wrapperEl !== elRef.current) {
      preview.migrate(elRef.current);
    }
  }, []);

  // 아직 renderer.current가 설정되기 전(초기 렌더 프레임)이라도, previewCache에 이미
  // 크기 정보가 있다면 그 크기를 인라인 style로 미리 지정해 레이아웃이 갑자기 변하는 것을 방지
  let styles: CSSProperties | undefined = undefined;
  if (!renderer.current && view.previewCache.has(entityId)) {
    const preview = view.previewCache.get(entityId);
    if (preview.lastRefHeight > 0) {
      styles = {
        width: `${preview.lastRefWidth}px`,
        height: `${preview.lastRefHeight}px`,
      };
    }
  }

  return (
    <div
      style={styles}
      ref={elRef}
      className={classcat([c('markdown-preview-wrapper'), className])}
      {...divProps}
    />
  );
});

// 드래그 중 보여주는 "드래그 프리뷰(고스트 이미지)"처럼, 실제 렌더러를 다시 만들지 않고
// 이미 캐시된 렌더링 결과의 DOM을 통째로 복제(cloneNode)해서 보여주기만 하는 가벼운 컴포넌트.
// (원본 렌더러의 상태나 이벤트 리스너와는 완전히 분리된 정적 스냅샷)
export const MarkdownClonedPreviewRenderer = memo(function MarkdownClonedPreviewRenderer({
  entityId,
  className,
  ...divProps
}: MarkdownRendererProps) {
  const { view } = useContext(KanbanContext);
  const elRef = useRef<HTMLDivElement>();
  const preview = view.previewCache.get(entityId);

  let styles: CSSProperties | undefined = undefined;
  if (preview && preview.lastRefHeight > 0) {
    styles = {
      width: `${preview.lastRefWidth}px`,
      height: `${preview.lastRefHeight}px`,
    };
  }

  return (
    <div
      style={styles}
      ref={(el) => {
        elRef.current = el;
        // 아직 자식이 없는 빈 wrapper에 처음 붙일 때만 clone을 삽입 (재실행 시 중복 삽입 방지)
        if (el && preview && el.childElementCount === 0) {
          el.append(preview.containerEl.cloneNode(true));
        }
      }}
      className={classcat([c('markdown-preview-wrapper'), className])}
      {...divProps}
    />
  );
});
