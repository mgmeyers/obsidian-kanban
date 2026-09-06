/**
 * ============================================================================
 * [실행 순서 #21] Icon.tsx — Lucide 아이콘 래퍼 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * Obsidian이 내장 제공하는 setIcon() API를 이용해 Lucide 아이콘 세트의 아이콘을
 * <span> 엘리먼트 안에 그려주는 얇은 래퍼(wrapper) 컴포넌트이다. name prop으로
 * 받은 아이콘 이름을 ref 콜백 시점에 실제 DOM 엘리먼트에 주입하며, 컴포넌트 자체는
 * 아이콘을 직접 SVG로 그리지 않고 Obsidian API에 그리기를 위임한다는 점이 특징이다.
 * ============================================================================
 */
import { setIcon } from 'obsidian';

import { c } from '../helpers';

// Icon 컴포넌트가 받는 props: 표시할 아이콘 이름(Lucide 아이콘 세트 기준)과 추가 CSS 클래스
interface IconProps {
  name: string;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <span
      data-icon={name} // 디버깅/스타일링 시 어떤 아이콘인지 식별할 수 있도록 data 속성에 이름을 남김
      className={`${c('icon')} ${className || ''}`} // BEM 클래스(c('icon'))에 전달받은 className을 덧붙임
      ref={(c) => {
        // 콜백 ref: 이 span이 실제 DOM에 마운트되는 시점(c가 null이 아닐 때)에 호출된다.
        // 주의: 여기서 매개변수 이름 c는 위에서 import한 헬퍼 함수 c()를 이 콜백 스코프 안에서
        // 가리는(shadowing) 것으로, DOM 엘리먼트 자체를 의미하며 클래스명 헬퍼 c와는 무관하다.
        if (c) {
          // Obsidian의 setIcon API가 해당 엘리먼트 내부에 Lucide 아이콘의 SVG를 직접 그려 넣는다.
          setIcon(c, name);
        }
      }}
    />
  );
}
