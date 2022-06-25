interface EventsMap {
  [event: string]: any;
}

export interface DefaultEvents extends EventsMap {
  [event: string]: (args: any) => void;
}

export interface Unsubscribe {
  (): void;
}

export interface Emitter<Events extends EventsMap = DefaultEvents> {
  events: Partial<{ [E in keyof Events]: Array<Events[E]> }>;
  on<K extends keyof Events>(
    this: this,
    event: K,
    cb: Events[K],
    id?: string
  ): Unsubscribe;
  off<K extends keyof Events>(
    this: this,
    event: K,
    cb: Events[K],
    id?: string
  ): void;
  emit<K extends keyof Events>(
    this: this,
    event: K,
    data: Parameters<Events[K]>[0],
    id?: string
  ): void;
}

export function createEmitter<
  Events extends EventsMap = DefaultEvents
>(): Emitter<Events> {
  return {
    events: {},

    emit(event, data, id) {
      const scopedKey: keyof Events = `${String(event)}${id || ''}`;

      const globalHandlers = this.events[event];
      const scopedHandlers = this.events[scopedKey];

      if (!globalHandlers && !scopedHandlers) {
        console.warn('Event emitted with no handler', event, id);
        return;
      }

      if (id && scopedHandlers) {
        scopedHandlers.forEach((i) => i(data));
      }

      if (globalHandlers) {
        globalHandlers.forEach((i) => i(data));
      }
    },

    on(event, cb, id) {
      const key: keyof Events = `${String(event)}${id || ''}`;

      let handlers = this.events[key];
      if (!handlers) this.events[key] = handlers = [];

      handlers.push(cb);

      return () => this.off(event, cb, id);
    },

    off(event, cb, id) {
      const key: keyof Events = `${String(event)}${id || ''}`;
      const handlers = this.events[key];

      if (handlers) {
        handlers.splice(handlers.indexOf(cb) >>> 0, 1);

        if (handlers.length === 0) {
          delete this.events[key];
        }
      }
    },
  };
}
