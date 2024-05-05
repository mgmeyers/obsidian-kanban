const { compare } = new Intl.Collator(undefined, {
  usage: 'sort',
  sensitivity: 'base',
  numeric: true,
});

export const defaultSort = compare;

export class PromiseCapability<T = void> {
  promise: Promise<T>;

  resolve: (data: T) => void;
  reject: (reason?: any) => void;

  settled = false;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
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

type QAble = () => Promise<any>;

export class PromiseQueue {
  queue: Array<QAble> = [];
  isRunning: boolean = false;

  constructor(public onComplete: () => void) {}

  clear() {
    this.queue.length = 0;
    this.isRunning = false;
  }

  add(item: QAble) {
    this.queue.push(item);

    if (!this.isRunning) {
      this.run();
    }
  }

  async run() {
    this.isRunning = true;

    const { queue } = this;
    let intervalStart = performance.now();

    while (queue.length) {
      const item = queue.splice(0, 5);

      try {
        await Promise.all(item.map((item) => item()));
      } catch (e) {
        console.error(e);
      }

      if (!this.isRunning) return;

      const now = performance.now();
      if (now - intervalStart > 50) {
        await new Promise((res) => activeWindow.setTimeout(res));
        intervalStart = now;
      }
    }

    this.isRunning = false;
    this.onComplete();
  }
}
