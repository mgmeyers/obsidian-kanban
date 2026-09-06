/**
 * ============================================================================
 * [실행 순서 #47] src/parsers/extensions/types.ts — 확장 관련 타입 정의
 * ----------------------------------------------------------------------------
 * 단계: 실행-파싱
 * 앞서 #46(helpers.ts)에서 설명했듯, micromark 확장은 (1) 문자 단위로 토큰을 만드는
 * tokenizer와 (2) 그 토큰을 mdast 노드로 바꾸는 FromMarkdownExtension이라는 두 부분으로
 * 구성됩니다. 이 파일 자체에는 실행 로직이 없고, (2)번 단계에서 최종적으로 만들어지는
 * mdast 노드들의 TypeScript 타입(모양)만 선언합니다. 즉 #48(genericWrapped.ts)이
 * 공통으로 만들어내는 "값을 하나 담은 노드(ValueNode)"와, 그것을 좀 더 구체화한
 * 날짜/시간/파일 링크용 노드 타입을 정의해 두어, 다른 파일(렌더러, 파서 등)이 타입
 * 안전하게 이 노드들을 다룰 수 있게 합니다.
 * ============================================================================
 */
import { Parent } from 'mdast';
import { FileMetadata } from 'src/components/types';

import { FileAccessor } from '../helpers/parser';

/**
 * genericWrapped 확장(예: 날짜 트리거{...}, [[위키링크]] 등 "트리거+여는기호 ... 닫는기호"로
 * 감싸인 토큰)이 공통으로 만들어내는 mdast 노드의 기본 형태입니다.
 * mdast의 Parent를 확장하므로 children 배열도 가질 수 있는 구조이지만, 실제로는
 * 감싸인 기호 안쪽 텍스트를 그대로 담는 문자열 필드 value를 핵심으로 사용합니다.
 * 예: "[[내 노트]]" → value = "내 노트".
 */
export interface ValueNode extends Parent {
  value: string;
}

/**
 * 날짜 트리거(예: "@{2024-01-01}")로 감싸인 텍스트를 파싱한 결과 노드.
 * ValueNode의 value(원본 문자열) 외에, 실제로 사용할 날짜 문자열을 date 필드에
 * 별도로 저장합니다(parseMarkdown.ts의 genericWrappedFromMarkdown 콜백에서 채워짐).
 */
export interface DateNode extends ValueNode {
  date: string;
}

/**
 * 시간 트리거(예: "@@{14:30}")로 감싸인 텍스트를 파싱한 결과 노드.
 * DateNode와 마찬가지로 value 외에 time 필드를 별도로 저장합니다.
 */
export interface TimeNode extends ValueNode {
  time: string;
}

/**
 * 위키링크("[[파일]]") 또는 임베드 위키링크("![[파일]]")를 파싱한 결과 노드.
 * 링크가 실제로 가리키는 파일 정보를 담는 fileAccessor와, Obsidian의 메타데이터
 * 캐시에서 가져온 프론트매터 등 부가 정보(fileMetadata)를 함께 보관합니다.
 * fileMetadataOrder는 그 메타데이터의 키들을 화면에 표시할 때 사용할 순서를 저장합니다.
 */
export interface FileNode extends ValueNode {
  fileAccessor: FileAccessor;
  fileMetadata?: FileMetadata;
  fileMetadataOrder?: string[];
}
