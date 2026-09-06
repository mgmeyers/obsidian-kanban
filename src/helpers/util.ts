/**
 * ============================================================================
 * [실행 순서 #62] src/helpers/util.ts — PromiseQueue, PromiseCapability, 로케일 인지 문자열 정렬(defaultSort)
 * ----------------------------------------------------------------------------
 * 단계: 실행-저장·동기화
 * 특정 도메인(보드/카드)과 무관한, 아주 범용적인 비동기·정렬 유틸리티 모음이다. PromiseCapability는
 * 콜백 외부에서 resolve/reject를 호출할 수 있게 Promise를 감싼 래퍼로, StateManager가 "저장이 끝날
 * 때까지 기다렸다가 다음 작업을 진행"하는 등 비동기 흐름 제어에 쓰인다. PromiseQueue는 짧은 시간 안에
 * 몰려드는 여러 비동기 작업(예: 연속된 저장 요청)을 한꺼번에 실행하되, 메인 스레드를 너무 오래 붙잡지
 * 않도록 일정 개수/시간 단위로 나누어 처리하는 배치 큐이다. defaultSort는 숫자가 섞인 문자열도
 * 자연스러운 순서로 비교하는 로케일 인지 비교 함수로, 태그/파일명 정렬 등에 재사용된다.
 * ============================================================================
 */
// Intl.Collator: 브라우저 내장 로케일 인지 문자열 비교기. usage:'sort'는 정렬 목적임을 명시하고,
// sensitivity:'base'는 대소문자·발음 구별 기호 차이를 무시하며, numeric:true는 "item2" < "item10"처럼
// 문자열 속 숫자를 실제 수치로 비교해주는(자연 정렬, natural sort) 옵션이다.
const { compare } = new Intl.Collator(undefined, {
  usage: 'sort',
  sensitivity: 'base',
  numeric: true,
});

// Array.prototype.sort 등에 그대로 넘겨 쓸 수 있는 비교 함수로 외부에 공개
export const defaultSort = compare;

// 일반적으로 `new Promise((resolve) => { ... })` 패턴은 resolve/reject 함수가 executor 콜백
// "안에서만" 존재하기 때문에, Promise를 생성한 코드 바깥(예: 다른 이벤트 핸들러, 나중에 호출되는 다른 함수)
// 에서 그 Promise를 나중에 resolve/reject 하고 싶어도 참조를 밖으로 꺼낼 방법이 없다.
// PromiseCapability는 executor 안에서 resolve/reject를 즉시 this.resolve/this.reject 필드에 대입해
// 클래스 인스턴스 바깥으로 "탈출"시켜 두는 트릭으로 이 문제를 해결한다. 즉, 이 인스턴스를 들고 있는
// 아무 코드에서나 capability.resolve(value) / capability.reject(err)를 호출해 promise를 확정지을 수 있다.
export class PromiseCapability<T = void> {
  promise: Promise<T>;

  resolve: (data: T) => void;
  reject: (reason?: any) => void;

  // 이미 resolve/reject가 호출되어 확정되었는지 외부에서 동기적으로 확인할 수 있는 플래그
  settled = false;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      // executor 내부의 진짜 resolve를 그대로 노출하지 않고, settled 플래그를 갱신하는 래퍼를 씌워
      // this.resolve에 대입한다 — 이렇게 하면 인스턴스 생성 이후 외부에서 this.resolve(...)를 호출해도
      // 클로저로 캡처된 진짜 resolve가 실행되면서 동시에 settled 상태도 함께 기록된다.
      this.resolve = (data) => {
        this.settled = true;
        resolve(data);
      };

      this.reject = (reason) => {
        this.settled = true;
        reject(reason);
      };
    });
  }
}

// 큐에 담을 수 있는 작업의 타입: 인자 없이 호출하면 Promise를 반환하는 함수
type QAble = () => Promise<any>;

// 짧은 시간에 여러 번 요청되는 비동기 작업(예: 파일 저장, 재파싱)을 순서대로 모아뒀다가,
// 한 번에 5개씩 묶어서 실행하고, 50ms 이상 쉬지 않고 실행이 이어지면 다음 macrotask로 양보(yield)해
// 브라우저/Electron 메인 스레드가 멈춘 것처럼 보이지 않도록 하는 간단한 배치 큐이다.
export class PromiseQueue {
  queue: Array<QAble> = [];
  isRunning: boolean = false;

  // 큐에 쌓인 작업이 모두 끝나 큐가 비었을 때 호출될 콜백을 생성자에서 받아둔다
  constructor(public onComplete: () => void) {}

  // 대기 중인 작업을 모두 버리고 실행 상태도 초기화한다(현재 진행 중인 배치 자체를 중단시키진 않지만,
  // run() 루프가 다음 반복에서 isRunning을 보고 스스로 멈추게 만든다)
  clear() {
    this.queue.length = 0;
    this.isRunning = false;
  }

  // 새 작업을 큐 끝에 추가하고, 아직 실행 루프가 돌고 있지 않다면 새로 시작한다
  add(item: QAble) {
    this.queue.push(item);

    if (!this.isRunning) {
      this.run();
    }
  }

  // 큐가 빌 때까지 반복하며 작업을 실행하는 메인 루프
  async run() {
    this.isRunning = true;

    const { queue } = this;
    // 마지막으로 "숨 고르기(양보)"를 한 시각을 기록해두고, 그 이후 경과 시간을 측정하는 데 사용
    let intervalStart = performance.now();

    while (queue.length) {
      // 큐 맨 앞에서 최대 5개까지 잘라내어 이번 배치로 삼는다(한 번에 너무 많이 처리하지 않도록 제한)
      const item = queue.splice(0, 5);

      try {
        // 이번 배치의 작업들을 모두 동시에(병렬로) 실행하고 전부 끝날 때까지 대기
        await Promise.all(item.map((item) => item()));
      } catch (e) {
        // 개별 작업 실패가 큐 전체를 멈추지 않도록 에러는 로그만 남기고 계속 진행
        console.error(e);
      }

      // clear()가 호출되어 isRunning이 false가 되었으면 루프를 즉시 종료(남은 큐 작업은 실행하지 않음)
      if (!this.isRunning) return;

      const now = performance.now();
      if (now - intervalStart > 50) {
        // 50ms 넘게 연속으로 작업을 처리했다면, setTimeout(res)로 다음 이벤트 루프 틱까지 한 번 양보해
        // UI가 멈춘 것처럼 보이지 않게 한 뒤(activeWindow는 Obsidian이 제공하는 현재 창의 window 참조) 이어감
        await new Promise((res) => activeWindow.setTimeout(res));
        intervalStart = now;
      }
    }

    // 큐가 완전히 비면 실행 상태를 종료 표시하고 완료 콜백을 호출
    this.isRunning = false;
    this.onComplete();
  }
}
