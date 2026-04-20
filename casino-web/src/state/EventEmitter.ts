// Minimal typed event emitter — no external dependencies
type Handler<T = unknown> = (data: T) => void;

export class EventEmitter {
  private _listeners: Map<string, Handler[]> = new Map();

  on<T = unknown>(event: string, fn: Handler<T>): void {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event)!.push(fn as Handler);
  }

  off<T = unknown>(event: string, fn: Handler<T>): void {
    const arr = this._listeners.get(event);
    if (arr) this._listeners.set(event, arr.filter(f => f !== fn));
  }

  emit<T = unknown>(event: string, data?: T): void {
    this._listeners.get(event)?.slice().forEach(fn => fn(data as unknown));
  }
}
