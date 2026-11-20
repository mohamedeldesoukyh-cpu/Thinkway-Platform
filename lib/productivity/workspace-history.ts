export type UndoCommand = { owner: string; label: string; undo: () => void; redo: () => void; available?: () => boolean };

/** In-memory edit history. Never replays server side effects. */
export class WorkspaceHistory {
  past: UndoCommand[] = [];
  future: UndoCommand[] = [];
  private lastAt = 0;
  record(command: UndoCommand, now = Date.now()) {
    const last = this.past.at(-1);
    if (!this.future.length && last?.owner === command.owner && now - this.lastAt < 450) {
      this.past[this.past.length - 1] = { ...command, undo: last.undo };
    } else this.past.push(command);
    this.past = this.past.slice(-100);
    this.future = [];
    this.lastAt = now;
  }
  step(direction: 'undo' | 'redo') {
    const source = direction === 'undo' ? this.past : this.future;
    const command = source.at(-1);
    if (!command || command.available?.() === false) return false;
    command[direction]();
    source.pop();
    (direction === 'undo' ? this.future : this.past).push(command);
    this.lastAt = 0;
    return true;
  }
  remove(owner: string) {
    this.past = this.past.filter(entry => entry.owner !== owner);
    this.future = this.future.filter(entry => entry.owner !== owner);
  }
  clear() { this.past = []; this.future = []; this.lastAt = 0; }
}
