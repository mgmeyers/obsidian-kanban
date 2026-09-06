/**
 * ============================================================================
 * [실행 순서 #83] src/components/Table/types.ts — 테이블 보기 모드 전용 타입 정의
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * '표(table)' 보기 모드에서 각 행(row)이 어떤 데이터 구조를 가지는지 정의하는
 * 타입 전용 파일입니다. @tanstack/react-table은 제네릭 타입 파라미터로 "행 데이터의
 * 타입"을 요구하는데, 이 파일의 TableItem이 바로 그 역할을 합니다. 즉 helpers.tsx의
 * createColumnHelper<TableItem>()와 useReactTable({ data, columns })에 전달되는
 * data 배열의 원소 타입이 TableItem입니다. TableData는 컬럼 목록을 동적으로
 * 구성하기 위해 보드 전체에서 수집한 메타데이터 키 목록을 담는 중간 결과 타입입니다.
 * ============================================================================
 */
import { StateManager } from '../../StateManager';
import { Path } from '../../dnd/types';
import { Item, Lane } from '../types';

// 표의 한 "행(row)"에 대응하는 데이터 모양.
// react-table은 원본 데이터 배열(Item/Lane 트리를 평탄화한 것)을 그대로 넘기고,
// 각 컬럼은 이 TableItem에서 필요한 값을 골라(accessor) 셀을 그린다.
export interface TableItem {
  item: Item; // 실제 칸반 카드(아이템) 데이터
  lane: Lane; // 이 카드가 속한 리스트(레인) 데이터
  path: Path; // 보드 트리 안에서의 위치 [레인 인덱스, 아이템 인덱스] — 드래그/수정 시 사용
  stateManager: StateManager; // 보드 상태를 읽고 갱신하기 위한 매니저 (셀 렌더링/정렬 로직에서 설정값 조회용)
}

// helpers.tsx의 useTableData()가 보드를 순회하며 만들어내는 결과물.
// items: 평탄화된 행 목록, 나머지 필드는 "어떤 메타데이터 컬럼을 동적으로 추가할지" 결정하는 데 쓰인다.
export interface TableData {
  items: TableItem[]; // react-table에 넘길 행 데이터 배열
  metadata: string[]; // 카드에 존재하는 내장 메타데이터 종류 (예: 'date', 'tags')
  fileMetadata: string[]; // 프론트매터 등 파일 메타데이터 키 목록 (동적 컬럼으로 추가됨)
  inlineMetadata: string[]; // 본문 인라인 메타데이터(예: 태스크 필드) 키 목록 (동적 컬럼으로 추가됨)
  metadataLabels: Map<string, string>; // 메타데이터 키 -> 사람이 읽을 수 있는 컬럼 헤더 이름 매핑
}
