/**
 * ============================================================================
 * [실행 순서 #13] src/helpers.ts — 데일리노트 이동, frontmatter 검사 등 최상위 잡다한 헬퍼 모음
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용 / 실행-저장·동기화
 * 특정 클래스나 컴포넌트에 속하지 않는 전역(top-level) 유틸리티 함수들을 모아둔 파일입니다.
 * 사용자가 단축키/커맨드로 "다음·이전 데일리노트로 이동"을 실행할 때 쓰이는 함수
 * (gotoNextDailyNote, gotoPrevDailyNote), 데일리노트를 가리키는 링크 문자열을 만들어주는 함수
 * (buildLinkToDailyNote), 그리고 "이 노트를 칸반보드로 렌더링해야 하는가"를 판별하는 frontmatter
 * 검사 함수(hasFrontmatterKey / hasFrontmatterKeyRaw)를 제공합니다.
 * hasFrontmatterKey/Raw는 #1 main.ts(뷰 확장자 등록·전환 판단)와 #15 KanbanView.tsx(파일을 열 때마다
 * 검증)에서 호출되는, 플러그인 진입 시점의 핵심 판별 로직입니다.
 * ============================================================================
 */
import { App, TFile } from 'obsidian';
import { getDailyNoteSettings, getDateFromFile } from 'obsidian-daily-notes-interface';

import { frontmatterKey } from './parsers/common';

// 현재 열려 있는 파일(daily note)을 기준으로, 그보다 미래에 있는 "실제로 존재하는" 다음 데일리노트로 이동한다.
// 사용자가 커맨드/단축키로 호출하는 상호작용성 함수.
export function gotoNextDailyNote(app: App, file: TFile) {
  // obsidian-daily-notes-interface를 이용해 파일명/경로에서 날짜(moment 객체)를 역으로 추출
  const date = getDateFromFile(file as any, 'day');

  // 파일명이 데일리노트 포맷과 일치하지 않아 날짜를 뽑아낼 수 없으면 아무 동작도 하지 않음
  if (!date || !date.isValid()) {
    return;
  }

  // Obsidian 코어에 내장된 'daily-notes' 플러그인 인스턴스를 직접 참조(공식 API가 아니므로 any 캐스팅)
  const dailyNotePlugin = (app as any).internalPlugins.plugins['daily-notes'].instance;

  // 코어 플러그인이 제공하는 "다음으로 존재하는 데일리노트 열기" 기능에 위임
  dailyNotePlugin.gotoNextExisting(date);
}

// gotoNextDailyNote와 대칭되는 함수: 현재 파일보다 과거에 있는 가장 가까운 데일리노트로 이동한다.
export function gotoPrevDailyNote(app: App, file: TFile) {
  const date = getDateFromFile(file as any, 'day');

  if (!date || !date.isValid()) {
    return;
  }

  const dailyNotePlugin = (app as any).internalPlugins.plugins['daily-notes'].instance;

  dailyNotePlugin.gotoPreviousExisting(date);
}

// 주어진 날짜 문자열(dateStr)에 대한 데일리노트로의 링크 텍스트를 생성한다.
// 카드 본문에 날짜 링크를 삽입할 때(예: 마감일 표시) 사용되며, Vault 설정에 따라
// 마크다운 링크([text](path)) 또는 위키링크([[text]]) 두 가지 포맷 중 하나를 반환한다.
export function buildLinkToDailyNote(app: App, dateStr: string) {
  const dailyNoteSettings = getDailyNoteSettings();
  // Vault 설정에서 "마크다운 링크 사용" 여부를 읽음(비공식 getConfig API라 any 캐스팅)
  const shouldUseMarkdownLinks = !!(app.vault as any).getConfig('useMarkdownLinks');

  if (shouldUseMarkdownLinks) {
    // 데일리노트 폴더 설정이 있으면 경로 접두사로 붙이고, 공백 등 특수문자는 encodeURIComponent로 이스케이프
    return `[${dateStr}](${
      dailyNoteSettings.folder ? `${encodeURIComponent(dailyNoteSettings.folder)}/` : ''
    }${encodeURIComponent(dateStr)}.md)`;
  }

  // 기본값: Obsidian 위키링크 문법
  return `[[${dateStr}]]`;
}

// 파일 내용을 "문자열 그대로"(raw text) 정규식으로 검사해서, frontmatter 블록(--- ... ---) 안에
// kanban-plugin 키가 포함되어 있는지 확인한다. metadataCache가 아직 이 파일을 인덱싱하지 않았거나
// TFile 객체 없이 순수 문자열만 가진 상황(예: 파일 스캔/마이그레이션 단계)에서 사용하는 저수준 버전이다.
export function hasFrontmatterKeyRaw(data: string) {
  if (!data) return false;

  // 파일 맨 앞의 '---'로 감싸인 frontmatter 블록을 비탐욕적으로 매칭
  const match = data.match(/---\s+([\w\W]+?)\s+---/);

  if (!match) {
    return false;
  }

  // frontmatter 블록 본문에 kanban-plugin 키 문자열이 포함되는지만 단순 검사(값은 확인하지 않음)
  if (!match[1].contains(frontmatterKey)) {
    return false;
  }

  return true;
}

// 위와 동일한 목적이지만, Obsidian이 이미 파싱해둔 metadataCache를 사용하는 "정식" 버전.
// 파일을 열 때마다(#15 KanbanView.tsx) 또는 뷰를 등록할지 결정할 때(#1 main.ts) 호출되어,
// 이 노트가 칸반보드로 렌더링되어야 하는지를 판별하는 진입점 역할을 한다.
export function hasFrontmatterKey(file: TFile) {
  if (!file) return false;
  // Obsidian이 이미 파싱해 캐싱해둔 frontmatter 객체를 조회(파일을 다시 읽지 않아 빠름)
  const cache = app.metadataCache.getFileCache(file);
  return !!cache?.frontmatter?.[frontmatterKey];
}

// 레인(리스트) 제목 뒤에 "최대 아이템 수" 설정값이 있으면 "(N)" 형태로 붙여서 표시용 제목을 만든다.
export function laneTitleWithMaxItems(title: string, maxItems?: number) {
  if (!maxItems) return title;
  return `${title} (${maxItems})`;
}
